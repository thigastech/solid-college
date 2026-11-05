import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  ViewChild,
  inject,
} from '@angular/core';

/** Contorno 2D (unidades da peça) que é "impresso" camada por camada. */
type Contorno = [number, number][];

interface Modelo {
  contorno: Contorno;
  camadas: number;
  /** Rotação (rad) acumulada por camada: dá o efeito de peça torcida. */
  torcao: number;
}

interface Peca {
  modelo: Modelo;
  /** Posição na tela em fração da largura/altura. */
  fx: number;
  fy: number;
  /** Progresso em segmentos impressos (camadas × pontos do contorno). */
  progresso: number;
  /** Tempo (s) parado após terminar, antes de sumir e recomeçar. */
  espera: number;
  opacidade: number;
}

const COS30 = Math.cos(Math.PI / 6);
const SEGMENTOS_POR_SEGUNDO = 70;
const ALTURA_CAMADA = 0.045;
const FPS_MAX = 30;
/** Opacidade geral: o fundo acompanha, não disputa atenção com o conteúdo. */
const INTENSIDADE = 0.7;

function circulo(r: number, n: number): Contorno {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
}

function engrenagem(dentes: number, rInterno: number, rExterno: number): Contorno {
  const pts: Contorno = [];
  for (let i = 0; i < dentes; i++) {
    const base = (2 * Math.PI * i) / dentes;
    const passo = (2 * Math.PI) / dentes;
    for (const [frac, r] of [
      [0, rInterno],
      [0.2, rExterno],
      [0.5, rExterno],
      [0.7, rInterno],
    ] as const) {
      const a = base + frac * passo;
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
  }
  return pts;
}

function retanguloArredondado(w: number, h: number, r: number): Contorno {
  const pts: Contorno = [];
  const cantos: [number, number, number][] = [
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, 90],
    [-w / 2 + r, -h / 2 + r, 180],
    [w / 2 - r, -h / 2 + r, 270],
  ];
  for (const [cx, cy, a0] of cantos) {
    for (let i = 0; i <= 6; i++) {
      const a = ((a0 + (90 * i) / 6) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return pts;
}

const MODELOS: Modelo[] = [
  { contorno: engrenagem(14, 0.82, 1), camadas: 9, torcao: 0 },
  { contorno: circulo(0.7, 6), camadas: 30, torcao: 0.035 },
  { contorno: circulo(0.62, 48), camadas: 26, torcao: 0 },
  { contorno: retanguloArredondado(1.6, 1.1, 0.18), camadas: 14, torcao: 0 },
  { contorno: circulo(0.75, 5), camadas: 24, torcao: -0.03 },
];

/** Posições pelas bordas da tela, longe do texto principal. */
const VAGAS: [number, number][] = [
  [0.1, 0.82],
  [0.9, 0.28],
  [0.72, 0.9],
  [0.28, 0.2],
];

/**
 * Fundo animado: peças sendo impressas em 3D, camada por camada, em projeção
 * isométrica. Canvas único fora da zona do Angular, limitado a 30 fps,
 * pausado com a aba oculta e estático com prefers-reduced-motion.
 * As cores vêm dos tokens do tema e são relidas quando o tema muda.
 */
@Component({
  selector: 'app-fundo-animado',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #tela class="pointer-events-none fixed inset-0 -z-10 h-full w-full" aria-hidden="true"></canvas>`,
})
export class FundoAnimadoComponent implements AfterViewInit {
  @ViewChild('tela', { static: true }) private tela!: ElementRef<HTMLCanvasElement>;

  private readonly zone = inject(NgZone);
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly janela = this.doc.defaultView;

  private ctx: CanvasRenderingContext2D | null = null;
  private largura = 0;
  private altura = 0;
  private escala = 1;
  private cores = { linha: '38 37 35', destaque: '242 106 27' };
  private pecas: Peca[] = [];
  private quadro = 0;
  private ultimo = 0;
  private proximoModelo = 0;
  private readonly estatico =
    this.janela?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  ngAfterViewInit(): void {
    this.ctx = this.tela.nativeElement.getContext('2d');
    if (!this.ctx || !this.janela) return;

    this.zone.runOutsideAngular(() => {
      this.lerCores();
      this.redimensionar();
      this.pecas = VAGAS.map(([fx, fy], i) => this.novaPeca(fx, fy, i * 0.22));

      const aoRedimensionar = () => {
        this.redimensionar();
        if (this.estatico) this.desenhar();
      };
      this.janela!.addEventListener('resize', aoRedimensionar);

      // Tema mudou → relê as cores dos tokens.
      const observador = new MutationObserver(() => {
        this.lerCores();
        if (this.estatico) this.desenhar();
      });
      observador.observe(this.doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

      if (this.estatico) {
        for (const p of this.pecas) p.progresso = this.total(p.modelo);
        this.desenhar();
      } else {
        this.quadro = this.janela!.requestAnimationFrame((t) => this.passo(t));
      }

      this.destroyRef.onDestroy(() => {
        this.janela?.cancelAnimationFrame(this.quadro);
        this.janela?.removeEventListener('resize', aoRedimensionar);
        observador.disconnect();
      });
    });
  }

  private novaPeca(fx: number, fy: number, progressoInicial = 0): Peca {
    const modelo = MODELOS[this.proximoModelo++ % MODELOS.length];
    return { modelo, fx, fy, progresso: progressoInicial * this.total(modelo), espera: 0, opacidade: 1 };
  }

  private total(m: Modelo): number {
    return m.camadas * m.contorno.length;
  }

  private passo(agora: number): void {
    this.quadro = this.janela!.requestAnimationFrame((t) => this.passo(t));
    const dt = (agora - this.ultimo) / 1000;
    if (dt < 1 / FPS_MAX) return;
    this.ultimo = agora;
    const delta = Math.min(dt, 0.1); // evita salto ao voltar de uma aba oculta

    this.pecas = this.pecas.map((p) => {
      const total = this.total(p.modelo);
      if (p.progresso < total) {
        p.progresso = Math.min(total, p.progresso + SEGMENTOS_POR_SEGUNDO * delta);
      } else if (p.espera < 5) {
        p.espera += delta;
      } else if (p.opacidade > 0) {
        p.opacidade = Math.max(0, p.opacidade - delta / 1.5);
      } else {
        return this.novaPeca(p.fx, p.fy);
      }
      return p;
    });
    this.desenhar();
  }

  private desenhar(): void {
    const ctx = this.ctx!;
    ctx.clearRect(0, 0, this.largura, this.altura);
    const tamanho = Math.max(56, Math.min(this.largura, this.altura) * 0.1);
    // Em telas estreitas, só as peças dos cantos inferiores/superiores externos.
    const pecas = this.largura < 768 ? this.pecas.filter((_, i) => i % 2 === 1) : this.pecas;
    for (const p of pecas) this.desenharPeca(ctx, p, tamanho);
  }

  private desenharPeca(ctx: CanvasRenderingContext2D, p: Peca, tamanho: number): void {
    const { contorno, camadas, torcao } = p.modelo;
    const n = contorno.length;
    const ox = p.fx * this.largura;
    const oy = p.fy * this.altura;
    const proj = (x: number, y: number, z: number): [number, number] => [
      ox + (x - y) * COS30 * tamanho,
      oy + ((x + y) * 0.5 - z) * tamanho,
    ];
    const ponto = (camada: number, i: number) => {
      const [x, y] = contorno[i % n];
      const a = camada * torcao;
      const c = Math.cos(a);
      const s = Math.sin(a);
      return proj(x * c - y * s, x * s + y * c, camada * ALTURA_CAMADA);
    };

    ctx.save();
    ctx.globalAlpha = p.opacidade * INTENSIDADE;
    ctx.lineJoin = 'round';

    // Mesa de impressão.
    ctx.strokeStyle = `rgb(${this.cores.linha} / 0.07)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [x, y] of [
      [-1.4, -1.4],
      [1.4, -1.4],
      [1.4, 1.4],
      [-1.4, 1.4],
    ] as const) {
      const [sx, sy] = proj(x, y, -0.02);
      ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.stroke();

    const camadaAtual = Math.floor(p.progresso / n);
    const fracao = p.progresso - camadaAtual * n;

    // Camadas concluídas: grafite; as últimas ficam em laranja (material "quente").
    for (let k = 0; k < Math.min(camadaAtual, camadas); k++) {
      const recente = camadaAtual - k <= 2 && p.progresso < this.total(p.modelo);
      ctx.strokeStyle = recente ? `rgb(${this.cores.destaque} / 0.45)` : `rgb(${this.cores.linha} / 0.12)`;
      ctx.lineWidth = recente ? 1.4 : 1;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const [sx, sy] = ponto(k, i);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Camada em impressão + bico.
    if (camadaAtual < camadas) {
      ctx.strokeStyle = `rgb(${this.cores.destaque} / 0.8)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const inteiro = Math.floor(fracao);
      for (let i = 0; i <= inteiro; i++) {
        const [sx, sy] = ponto(camadaAtual, i);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      const [ax, ay] = ponto(camadaAtual, inteiro);
      const [bx, by] = ponto(camadaAtual, inteiro + 1);
      const t = fracao - inteiro;
      const bico: [number, number] = [ax + (bx - ax) * t, ay + (by - ay) * t];
      ctx.lineTo(bico[0], bico[1]);
      ctx.stroke();

      // Bico: haste curta + ponto.
      ctx.strokeStyle = `rgb(${this.cores.linha} / 0.35)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bico[0], bico[1] - 3);
      ctx.lineTo(bico[0], bico[1] - 16);
      ctx.stroke();
      ctx.fillStyle = `rgb(${this.cores.destaque})`;
      ctx.beginPath();
      ctx.arc(bico[0], bico[1], 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private redimensionar(): void {
    const canvas = this.tela.nativeElement;
    this.escala = Math.min(this.janela!.devicePixelRatio || 1, 1.5);
    this.largura = this.janela!.innerWidth;
    this.altura = this.janela!.innerHeight;
    canvas.width = Math.round(this.largura * this.escala);
    canvas.height = Math.round(this.altura * this.escala);
    this.ctx!.setTransform(this.escala, 0, 0, this.escala, 0, 0);
  }

  private lerCores(): void {
    const estilo = this.janela!.getComputedStyle(this.doc.documentElement);
    this.cores = {
      linha: estilo.getPropertyValue('--c-fg').trim() || this.cores.linha,
      destaque: estilo.getPropertyValue('--c-accent').trim() || this.cores.destaque,
    };
  }
}

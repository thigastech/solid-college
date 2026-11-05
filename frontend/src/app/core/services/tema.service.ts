import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type Tema = 'claro' | 'escuro';

/** Mesma chave usada pelo script inline do index.html (evita "piscar" o tema). */
export const CHAVE_TEMA = 'solid-tema';

type DocumentoComTransicao = Document & {
  startViewTransition?: (atualizar: () => void) => { ready: Promise<void>; };
};

/**
 * Tema claro/escuro. Sem escolha salva, segue a preferência do sistema
 * (e acompanha mudanças dela). A escolha explícita fica no localStorage.
 *
 * A troca usa a View Transitions API: o navegador tira um "retrato" da página
 * e revela o novo tema num círculo a partir do botão, tudo na GPU. Assim as
 * centenas de superfícies com backdrop-filter não são animadas uma a uma.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly doc = inject(DOCUMENT) as DocumentoComTransicao;
  private readonly janela = this.doc.defaultView;
  private readonly midia = this.janela?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  private escolhaExplicita = this.lerEscolha() !== null;

  readonly tema = signal<Tema>(this.lerEscolha() ?? (this.midia?.matches ? 'escuro' : 'claro'));

  constructor() {
    this.aplicarNoDom(this.tema());
    this.midia?.addEventListener?.('change', (e) => {
      if (!this.escolhaExplicita) this.definir(e.matches ? 'escuro' : 'claro');
    });
  }

  /** Alterna o tema. Com o evento de clique, a revelação parte do botão. */
  alternar(evento?: MouseEvent): Promise<void> {
    const proximo: Tema = this.tema() === 'escuro' ? 'claro' : 'escuro';
    this.escolhaExplicita = true;
    try {
      localStorage.setItem(CHAVE_TEMA, proximo);
    } catch {
      /* armazenamento indisponível (modo privado): mantém só na sessão */
    }

    const reduzMovimento = this.janela?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!this.doc.startViewTransition || reduzMovimento) {
      this.semTransicoes(() => this.definir(proximo));
      return Promise.resolve();
    }

    // Resolve quando o tema já foi aplicado, sem depender do fim da animação
    // (que o navegador pode pular ou atrasar em abas ocultas).
    let aplicado!: () => void;
    const pronto = new Promise<void>((resolve) => (aplicado = resolve));
    const transicao = this.doc.startViewTransition(() => {
      this.definir(proximo);
      aplicado();
    });
    const x = evento?.clientX ?? (this.janela?.innerWidth ?? 0) - 40;
    const y = evento?.clientY ?? 32;
    const raio = Math.hypot(
      Math.max(x, (this.janela?.innerWidth ?? 0) - x),
      Math.max(y, (this.janela?.innerHeight ?? 0) - y),
    );
    transicao.ready
      .then(() =>
        this.doc.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${raio}px at ${x}px ${y}px)`] },
          { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
        ),
      )
      .catch(() => undefined);
    return pronto;
  }

  private definir(tema: Tema): void {
    this.tema.set(tema);
    // Aplicado na hora (não via effect) para a View Transition capturar o estado novo.
    this.aplicarNoDom(tema);
  }

  private aplicarNoDom(tema: Tema): void {
    const escuro = tema === 'escuro';
    this.doc.documentElement.setAttribute('data-theme', escuro ? 'dark' : 'light');
    this.doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#121110' : '#F6F2EA');
  }

  /** Troca instantânea sem transições CSS (evita dezenas de transições simultâneas). */
  private semTransicoes(atualizar: () => void): void {
    const raiz = this.doc.documentElement;
    raiz.classList.add('trocando-tema');
    atualizar();
    void raiz.offsetWidth;
    this.janela?.requestAnimationFrame(() => raiz.classList.remove('trocando-tema'));
  }

  private lerEscolha(): Tema | null {
    try {
      const valor = localStorage.getItem(CHAVE_TEMA);
      return valor === 'claro' || valor === 'escuro' ? valor : null;
    } catch {
      return null;
    }
  }
}

import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ChevronLeft, ChevronRight, LucideAngularModule, Pause, Play } from 'lucide-angular';

import { Produto } from '../../core/models/produto.model';
import { CatalogoStore } from '../../core/services/catalogo.store';
import { DetalheProdutoService } from '../../core/services/detalhe-produto.service';
import { NavegacaoService } from '../../core/services/navegacao.service';
import { SelecaoProdutoService } from '../../core/services/selecao-produto.service';
import { LogoComponent } from '../../core/layout/logo.component';

const MAX_DESTAQUES = 8;
export const INTERVALO_VITRINE_MS = 6000;

/**
 * Vitrine do topo: carrossel com os produtos reais do catálogo (API).
 * Segue o padrão de carrossel do WAI-ARIA: botão de pausa, pausa ao passar o
 * mouse ou focar, anúncio só quando parado e sem rotação com movimento reduzido.
 * Transição simples (fade): o produto é o destaque, não o efeito.
 */
@Component({
  selector: 'app-vitrine',
  standalone: true,
  imports: [LucideAngularModule, LogoComponent],
  styles: `
    .vitrine-progresso {
      transform-origin: left;
      animation: vitrine-progresso var(--duracao) linear forwards;
    }
    .vitrine-progresso.pausado {
      animation-play-state: paused;
    }
    @keyframes vitrine-progresso {
      from { transform: scaleX(0); }
      to { transform: scaleX(1); }
    }
    .slide {
      transition: opacity 0.35s ease;
    }
  `,
  template: `
    @switch (estado()) {
      @case ('carregando') {
        <div class="card overflow-hidden" aria-busy="true">
          <p class="sr-only" role="status">Carregando produtos em destaque…</p>
          <div class="aspect-[4/3] animate-pulse bg-surface-2"></div>
          <div class="h-32 border-t border-border"></div>
        </div>
      }
      @case ('vazio') {
        <div class="card flex aspect-[4/3] flex-col items-center justify-center p-8 text-center">
          <app-logo [tamanho]="56" [comSlogan]="false" />
          <p class="mt-5 max-w-xs text-sm leading-relaxed text-muted">
            Os produtos em destaque aparecem aqui assim que o catálogo estiver disponível.
          </p>
          <a href="/#contato" (click)="irContato($event)" class="btn btn-secondary btn-sm mt-5">Fale sobre seu projeto</a>
        </div>
      }
      @default {
        <div
          class="card overflow-hidden"
          role="region"
          aria-roledescription="carrossel"
          aria-label="Produtos em destaque"
          (mouseenter)="interagindo.set(true)"
          (mouseleave)="interagindo.set(false)"
          (focusin)="interagindo.set(true)"
          (focusout)="aoSairFoco($event)"
          (keydown.arrowleft)="anterior()"
          (keydown.arrowright)="proximo()"
        >
          <!-- Palco -->
          <div class="vitrine-palco relative aspect-[4/3] overflow-hidden border-b border-border">
            @for (produto of destaques(); track produto.id; let i = $index) {
              <div
                class="slide absolute inset-0 flex items-center justify-center p-6 sm:p-10"
                role="group"
                aria-roledescription="slide"
                [attr.aria-label]="(i + 1) + ' de ' + destaques().length + ': ' + produto.nome"
                [attr.aria-hidden]="i !== indice()"
                [attr.inert]="i !== indice() ? '' : null"
                [style.opacity]="i === indice() ? 1 : 0"
              >
                @if (produto.imagem_url) {
                  <img
                    [src]="produto.imagem_url"
                    width="800"
                    height="600"
                    [attr.loading]="i < 2 ? 'eager' : 'lazy'"
                    [attr.fetchpriority]="i === 0 ? 'high' : null"
                    decoding="async"
                    [alt]="'Imagem ilustrativa: ' + produto.nome"
                    class="h-full w-full object-contain"
                  />
                } @else {
                  <app-logo [tamanho]="72" [comSlogan]="false" />
                }
              </div>
            }

            <span
              class="absolute left-3 top-3 rounded-[4px] bg-surface/90 px-2 py-1 font-mono text-[0.7rem] tabular-nums text-muted"
              aria-hidden="true"
            >
              {{ doisDigitos(indice() + 1) }}/{{ doisDigitos(destaques().length) }}
            </span>

            @if (destaques().length > 1 && !reduzMovimento) {
              <div class="absolute inset-x-0 bottom-0 h-0.5 bg-fg/10" aria-hidden="true">
                @for (produto of destaques(); track produto.id; let i = $index) {
                  @if (i === indice()) {
                    <div
                      class="vitrine-progresso h-full w-full bg-accent"
                      [class.pausado]="!rodando()"
                      [style.--duracao]="intervalo + 'ms'"
                      (animationend)="proximo()"
                    ></div>
                  }
                }
              </div>
            }
          </div>

          <!-- Produto ativo + controles -->
          @if (ativo(); as p) {
            <div class="p-4 sm:p-5">
              <p class="sr-only" [attr.aria-live]="rodando() ? 'off' : 'polite'" aria-atomic="true">
                Produto {{ indice() + 1 }} de {{ destaques().length }}: {{ p.nome }}
              </p>
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <p class="text-xs font-medium text-muted">{{ p.categoria || 'Sem categoria' }}</p>
                  <h2 class="mt-1 line-clamp-2 text-lg font-bold text-fg">{{ p.nome }}</h2>
                </div>
                <div class="-mr-2 -mt-1 flex shrink-0 items-center">
                  @if (!reduzMovimento && destaques().length > 1) {
                    <button
                      type="button"
                      class="btn-icon h-9 w-9"
                      [attr.aria-label]="pausadoPeloUsuario() ? 'Retomar rotação automática' : 'Pausar rotação automática'"
                      (click)="pausadoPeloUsuario.set(!pausadoPeloUsuario())"
                    >
                      <lucide-icon [img]="pausadoPeloUsuario() ? icones.Play : icones.Pause" [size]="16" aria-hidden="true" />
                    </button>
                  }
                  <button type="button" class="btn-icon h-9 w-9" aria-label="Produto anterior" (click)="anterior()">
                    <lucide-icon [img]="icones.ChevronLeft" [size]="18" aria-hidden="true" />
                  </button>
                  <button type="button" class="btn-icon h-9 w-9" aria-label="Próximo produto" (click)="proximo()">
                    <lucide-icon [img]="icones.ChevronRight" [size]="18" aria-hidden="true" />
                  </button>
                </div>
              </div>

              @if (p.especificacao_tecnica.length > 0) {
                <dl class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Especificações principais">
                  @for (spec of p.especificacao_tecnica.slice(0, 3); track spec.rotulo) {
                    <div class="flex gap-1.5">
                      <dt class="text-muted">{{ spec.rotulo }}</dt>
                      <dd class="font-medium text-fg">{{ spec.valor }}</dd>
                    </div>
                  }
                </dl>
              }

              <div class="mt-4 flex flex-wrap gap-2">
                <button type="button" class="btn btn-primary btn-sm" (click)="orcamento(p)">
                  Orçamento<span class="sr-only"> de {{ p.nome }}</span>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" (click)="detalhe.abrir(p)">
                  Detalhes<span class="sr-only"> de {{ p.nome }}</span>
                </button>
              </div>
            </div>
          }

          <!-- Miniaturas -->
          <ul
            class="flex gap-px overflow-x-auto border-t border-border bg-border [scrollbar-width:none]"
            aria-label="Escolher produto em destaque"
          >
            @for (produto of destaques(); track produto.id; let i = $index) {
              <li class="min-w-[3.5rem] flex-1">
                <button
                  type="button"
                  class="relative flex h-14 w-full items-center justify-center bg-surface transition-colors hover:bg-surface-2"
                  [class.!bg-surface-2]="i === indice()"
                  [attr.aria-current]="i === indice() ? 'true' : null"
                  [attr.aria-label]="'Mostrar ' + produto.nome"
                  (click)="irPara(i)"
                >
                  @if (produto.imagem_url) {
                    <img [src]="produto.imagem_url" width="64" height="48" alt="" loading="lazy" class="h-full w-full object-contain p-1.5" />
                  }
                  @if (i === indice()) {
                    <span class="absolute inset-x-0 top-0 h-0.5 bg-accent" aria-hidden="true"></span>
                  }
                </button>
              </li>
            }
          </ul>
        </div>
      }
    }
  `,
})
export class VitrineComponent {
  private readonly store = inject(CatalogoStore);
  private readonly selecao = inject(SelecaoProdutoService);
  private readonly nav = inject(NavegacaoService);
  private readonly doc = inject(DOCUMENT);
  readonly detalhe = inject(DetalheProdutoService);

  readonly icones = { ChevronLeft, ChevronRight, Pause, Play };
  readonly intervalo = INTERVALO_VITRINE_MS;
  readonly reduzMovimento = this.doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  readonly destaques = computed(() => this.store.produtos().slice(0, MAX_DESTAQUES));
  readonly estado = computed(() => {
    const estado = this.store.estado();
    if (estado === 'pronto') return this.destaques().length > 0 ? 'pronto' : 'vazio';
    return estado === 'erro' ? 'vazio' : 'carregando';
  });

  readonly indice = signal(0);
  readonly ativo = computed<Produto | undefined>(() => this.destaques()[this.indice()]);

  readonly pausadoPeloUsuario = signal(this.reduzMovimento);
  readonly interagindo = signal(false);
  private readonly paginaVisivel = signal(!this.doc.hidden);
  readonly rodando = computed(
    () => !this.pausadoPeloUsuario() && !this.interagindo() && this.paginaVisivel() && this.destaques().length > 1,
  );

  constructor() {
    const aoMudarVisibilidade = () => this.paginaVisivel.set(!this.doc.hidden);
    this.doc.addEventListener('visibilitychange', aoMudarVisibilidade);
    inject(DestroyRef).onDestroy(() => this.doc.removeEventListener('visibilitychange', aoMudarVisibilidade));
  }

  proximo(): void {
    const n = this.destaques().length;
    if (n > 0) this.indice.update((i) => (i + 1) % n);
  }

  anterior(): void {
    const n = this.destaques().length;
    if (n > 0) this.indice.update((i) => (i - 1 + n) % n);
  }

  irPara(i: number): void {
    this.indice.set(i);
  }

  aoSairFoco(evento: FocusEvent): void {
    const destino = evento.relatedTarget as Node | null;
    if (!destino || !(evento.currentTarget as HTMLElement).contains(destino)) this.interagindo.set(false);
  }

  orcamento(produto: Produto): void {
    this.selecao.selecionar(produto);
    this.nav.irPara('contato', 'nome_cliente');
  }

  irContato(evento: Event): void {
    evento.preventDefault();
    this.nav.irPara('contato');
  }

  doisDigitos(n: number): string {
    return n.toString().padStart(2, '0');
  }
}

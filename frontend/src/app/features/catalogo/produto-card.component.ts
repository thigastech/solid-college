import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ArrowUpRight, Box, LucideAngularModule } from 'lucide-angular';

import { Produto } from '../../core/models/produto.model';

@Component({
  selector: 'app-produto-card',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <article
      class="card group flex w-full flex-col overflow-hidden transition-colors hover:border-fg/30"
      [attr.aria-labelledby]="'produto-' + produto.id"
    >
      <div class="vitrine-palco relative aspect-[4/3] overflow-hidden border-b border-border">
        @if (produto.imagem_url) {
          <img
            [src]="produto.imagem_url"
            width="800"
            height="600"
            [attr.loading]="prioridade ? 'eager' : 'lazy'"
            decoding="async"
            [alt]="'Imagem ilustrativa: ' + produto.nome"
            class="h-full w-full object-contain p-4"
          />
        } @else {
          <div class="flex h-full flex-col items-center justify-center gap-2 text-muted" role="img" [attr.aria-label]="'Sem imagem para ' + produto.nome">
            <lucide-icon [img]="Box" [size]="32" [strokeWidth]="1.25" aria-hidden="true" />
            <span class="text-xs">Imagem não disponível</span>
          </div>
        }
      </div>

      <div class="flex flex-1 flex-col p-5">
        <p class="text-xs font-medium text-muted">{{ produto.categoria || 'Sem categoria' }}</p>
        <h3 [id]="'produto-' + produto.id" class="mt-2 text-lg font-bold leading-snug text-fg">{{ produto.nome }}</h3>
        @if (produto.descricao) {
          <p class="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{{ produto.descricao }}</p>
        }

        @if (especificacoes.length > 0) {
          <dl class="mt-4 grid grid-cols-2 gap-2">
            @for (spec of especificacoes; track spec.rotulo) {
              <div class="rounded-[4px] bg-surface-2/70 px-3 py-2">
                <dt class="text-[0.68rem] uppercase tracking-wider text-muted">{{ spec.rotulo }}</dt>
                <dd class="mt-0.5 truncate text-sm font-medium text-fg" [title]="spec.valor">{{ spec.valor }}</dd>
              </div>
            }
          </dl>
        }

        <div class="mt-auto flex flex-wrap items-center gap-2 pt-5">
          <button type="button" class="btn btn-secondary btn-sm flex-1" (click)="detalhes.emit(produto)">
            Ver detalhes
            <span class="sr-only">de {{ produto.nome }}</span>
          </button>
          <button type="button" class="btn btn-primary btn-sm flex-1" (click)="orcamento.emit(produto)">
            Solicitar orçamento
            <span class="sr-only">de {{ produto.nome }}</span>
            <lucide-icon [img]="ArrowUpRight" [size]="16" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  `,
})
export class ProdutoCardComponent {
  @Input({ required: true }) produto!: Produto;
  /** Primeiras imagens visíveis carregam sem lazy loading. */
  @Input() prioridade = false;
  @Output() readonly detalhes = new EventEmitter<Produto>();
  @Output() readonly orcamento = new EventEmitter<Produto>();

  readonly Box = Box;
  readonly ArrowUpRight = ArrowUpRight;

  get especificacoes() {
    return this.produto.especificacao_tecnica.slice(0, 2);
  }
}

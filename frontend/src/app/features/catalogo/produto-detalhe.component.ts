import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { ArrowRight, Box, LucideAngularModule, X } from 'lucide-angular';

import { Produto } from '../../core/models/produto.model';

/**
 * Diálogo de detalhes baseado no elemento nativo <dialog> (showModal):
 * foco preso no diálogo, fundo inerte, Escape fecha e o foco volta ao gatilho.
 */
@Component({
  selector: 'app-produto-detalhe',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <dialog
      #dialogo
      class="m-auto w-[calc(100%-2rem)] max-w-4xl overflow-hidden glass-forte rounded-xl p-0 text-fg backdrop:bg-transparent"
      aria-labelledby="detalhe-titulo"
      (cancel)="aoCancelar($event)"
      (close)="aoFechar()"
      (click)="aoClicarFora($event)"
    >
      @if (atual; as p) {
        <div class="grid max-h-[88vh] overflow-y-auto md:grid-cols-2 md:overflow-hidden">
          <div class="vitrine-palco relative aspect-[16/10] md:aspect-auto md:h-full">
            @if (p.imagem_url) {
              <img [src]="p.imagem_url" width="800" height="600" [alt]="'Imagem ilustrativa ampliada: ' + p.nome" class="relative h-full w-full object-contain p-6" />
            } @else {
              <div class="flex h-full min-h-56 flex-col items-center justify-center gap-2 text-muted">
                <lucide-icon [img]="icones.Box" [size]="40" [strokeWidth]="1.25" aria-hidden="true" />
                <span class="text-sm">Imagem não disponível</span>
              </div>
            }
          </div>

          <div class="flex flex-col p-6 sm:p-8 md:max-h-[88vh] md:overflow-y-auto">
            <div class="flex items-start justify-between gap-4">
              <p class="badge">{{ p.categoria || 'Sem categoria' }}</p>
              <button #botaoFechar type="button" class="btn-icon -mr-2 -mt-2" aria-label="Fechar detalhes" (click)="fechar.emit()">
                <lucide-icon [img]="icones.X" [size]="20" aria-hidden="true" />
              </button>
            </div>
            <h2 id="detalhe-titulo" class="mt-4 text-2xl font-extrabold tracking-tight">{{ p.nome }}</h2>
            <p class="mt-3 whitespace-pre-line text-[0.95rem] leading-relaxed text-muted">
              {{ p.descricao || 'Descrição não informada.' }}
            </p>

            <h3 class="mt-7 text-sm font-semibold text-fg">Especificações técnicas</h3>
            @if (p.especificacao_tecnica.length > 0) {
              <dl class="mt-3 divide-y divide-border rounded-md border border-border">
                @for (spec of p.especificacao_tecnica; track spec.rotulo) {
                  <div class="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
                    <dt class="text-muted">{{ spec.rotulo }}</dt>
                    <dd class="text-right font-medium">{{ spec.valor }}</dd>
                  </div>
                }
              </dl>
            } @else {
              <p class="mt-3 text-sm text-muted">Não informado. Detalhes técnicos podem ser combinados no orçamento.</p>
            }

            <div class="mt-auto flex flex-col gap-2 pt-8 sm:flex-row">
              <button type="button" class="btn btn-primary flex-1" (click)="orcamento.emit(p)">
                Solicitar orçamento deste produto
                <lucide-icon [img]="icones.ArrowRight" [size]="18" aria-hidden="true" />
              </button>
              <button type="button" class="btn btn-secondary" (click)="fechar.emit()">Fechar</button>
            </div>
          </div>
        </div>
      }
    </dialog>
  `,
})
export class ProdutoDetalheComponent {
  @Output() readonly fechar = new EventEmitter<void>();
  @Output() readonly orcamento = new EventEmitter<Produto>();
  @ViewChild('dialogo', { static: true }) private dialogo!: ElementRef<HTMLDialogElement>;
  @ViewChild('botaoFechar') private botaoFechar?: ElementRef<HTMLButtonElement>;
  private readonly cdr = inject(ChangeDetectorRef);

  readonly icones = { X, Box, ArrowRight };
  atual: Produto | null = null;
  private gatilho: HTMLElement | null = null;

  @Input() set produto(valor: Produto | null) {
    const el = this.dialogo?.nativeElement;
    if (valor) {
      this.atual = valor;
      if (el && !el.open) {
        this.gatilho = document.activeElement as HTMLElement | null;
        // Renderiza o conteúdo antes de abrir, para o foco cair no botão de fechar.
        this.cdr.detectChanges();
        if (typeof el.showModal === 'function') el.showModal();
        else el.setAttribute('open', '');
        this.botaoFechar?.nativeElement.focus();
      }
    } else if (el?.open) {
      el.close();
    }
  }

  aoCancelar(evento: Event): void {
    evento.preventDefault();
    this.fechar.emit();
  }

  aoFechar(): void {
    if (this.atual) this.fechar.emit();
    this.atual = null;
    const gatilho = this.gatilho;
    this.gatilho = null;
    if (gatilho?.isConnected) gatilho.focus({ preventScroll: true });
  }

  aoClicarFora(evento: MouseEvent): void {
    // Cliques no backdrop chegam com o próprio <dialog> como alvo.
    if (evento.target === this.dialogo.nativeElement) this.fechar.emit();
  }
}

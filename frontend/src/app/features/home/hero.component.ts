import { Component, inject } from '@angular/core';
import { ArrowRight, LucideAngularModule } from 'lucide-angular';

import { NavegacaoService, Secao } from '../../core/services/navegacao.service';
import { VitrineComponent } from './vitrine.component';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [LucideAngularModule, VitrineComponent],
  template: `
    <section id="inicio" aria-labelledby="hero-titulo">
      <div class="page-container grid items-center gap-10 pb-16 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14 lg:pb-24 lg:pt-16 2xl:gap-20 2xl:pb-28 2xl:pt-20">
        <div class="max-w-xl">
          <p class="eyebrow">Impressão 3D sob encomenda</p>
          <h1
            id="hero-titulo"
            tabindex="-1"
            class="mt-4 text-balance text-[2.5rem] font-extrabold leading-[1.05] tracking-tight text-fg outline-none sm:text-[3.4rem] 2xl:text-[4.2rem]"
          >
            Da ideia à peça.
            <span class="text-marca block">Precisão em cada camada.</span>
          </h1>
          <p class="mt-6 text-pretty text-lg leading-relaxed text-muted">
            Peças funcionais, componentes personalizados e soluções em impressão 3D desenvolvidas para transformar
            projetos em produtos reais.
          </p>
          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="/#catalogo" (click)="ir($event, 'catalogo')" class="btn btn-primary">
              Ver catálogo
              <lucide-icon [img]="ArrowRight" [size]="17" aria-hidden="true" />
            </a>
            <a href="/#contato" (click)="ir($event, 'contato')" class="btn btn-secondary">Solicitar orçamento</a>
          </div>
        </div>

        <div class="w-full min-w-0">
          <app-vitrine />
        </div>
      </div>
    </section>
  `,
})
export class HeroComponent {
  private readonly nav = inject(NavegacaoService);
  readonly ArrowRight = ArrowRight;

  ir(evento: Event, secao: Secao): void {
    evento.preventDefault();
    this.nav.irPara(secao);
  }
}

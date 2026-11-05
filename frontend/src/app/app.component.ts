import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { FooterComponent } from './core/layout/footer.component';
import { FundoAnimadoComponent } from './core/layout/fundo-animado.component';
import { HeaderComponent } from './core/layout/header.component';
import { WhatsappFlutuanteComponent } from './core/layout/whatsapp-flutuante.component';
import { TemaService } from './core/services/tema.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, FundoAnimadoComponent, WhatsappFlutuanteComponent],
  template: `
    <!-- Fundo: peças sendo impressas camada por camada (canvas). -->
    <app-fundo-animado />

    <a
      href="#conteudo"
      (click)="pularParaConteudo($event)"
      class="sr-only-focusable fixed left-4 top-3 z-50 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent"
      >Pular para o conteúdo</a
    >
    @if (!areaAdmin()) {
      <app-header />
    }
    <main #conteudo id="conteudo" tabindex="-1" class="focus:outline-none">
      <router-outlet />
    </main>
    @if (!areaAdmin()) {
      <app-footer />
      <app-whatsapp-flutuante />
    }
  `,
})
export class AppComponent {
  @ViewChild('conteudo', { static: true }) private conteudo!: ElementRef<HTMLElement>;

  constructor() {
    // Instancia cedo para aplicar o tema e acompanhar a preferência do sistema.
    inject(TemaService);
  }

  private readonly router = inject(Router);
  /** A área administrativa tem cabeçalho próprio e não exibe o site público. */
  readonly areaAdmin = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.startsWith('/admin')),
    ),
    { initialValue: false },
  );

  /** Evita que o link de âncora seja tratado como navegação para outra rota. */
  pularParaConteudo(evento: Event): void {
    evento.preventDefault();
    this.conteudo.nativeElement.focus();
  }
}

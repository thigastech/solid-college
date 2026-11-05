import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SITE_CONFIG, linkInstagram, linkWhatsapp } from '../config/site.config';
import { NavegacaoService, Secao } from '../services/navegacao.service';
import { LogoComponent } from './logo.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, LogoComponent],
  template: `
    <footer class="glass rounded-none border-x-0 border-b-0">
      <div class="page-container grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <app-logo />
          <p class="mt-4 max-w-sm text-sm leading-relaxed text-muted">{{ config.descricaoInstitucional }}</p>
        </div>

        <nav aria-label="Rodapé">
          <h2 class="text-sm font-semibold text-fg">Navegação</h2>
          <ul class="mt-4 space-y-2.5 text-sm">
            @for (link of links; track link.secao) {
              <li>
                <a [href]="'/#' + link.secao" (click)="irPara($event, link.secao)" class="text-fg/90 hover:text-accent-ink">{{
                  link.rotulo
                }}</a>
              </li>
            }
            <li><a routerLink="/privacidade" class="text-fg/90 hover:text-accent-ink">Aviso de privacidade</a></li>
          </ul>
        </nav>

        <div>
          <h2 class="text-sm font-semibold text-fg">Contato</h2>
          <ul class="mt-4 space-y-2.5 text-sm">
            @if (config.emailContato) {
              <li>
                <a [href]="'mailto:' + config.emailContato" class="text-fg/90 hover:text-accent-ink">{{ config.emailContato }}</a>
              </li>
            }
            @if (whatsapp) {
              <li>
                <a [href]="whatsapp" target="_blank" rel="noopener noreferrer" class="text-fg/90 hover:text-accent-ink">WhatsApp comercial</a>
              </li>
            }
            @if (instagram) {
              <li>
                <a [href]="instagram" target="_blank" rel="noopener noreferrer" class="text-fg/90 hover:text-accent-ink">Instagram</a>
              </li>
            }
            <li>
              <a href="/#contato" (click)="irPara($event, 'contato')" class="text-fg/90 hover:text-accent-ink">Formulário de contato</a>
            </li>
          </ul>
        </div>
      </div>

      <div class="border-t border-border">
        <div class="page-container flex flex-col gap-2 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {{ ano }} {{ config.nomeMarca }}. Todos os direitos reservados.</p>
          <p>
            Os dados enviados pelo formulário são usados apenas para responder ao seu contato.
            <a routerLink="/privacidade" class="underline underline-offset-2 hover:text-fg">Saiba mais</a>.
          </p>
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  private readonly nav = inject(NavegacaoService);
  readonly config = inject(SITE_CONFIG);
  readonly ano = new Date().getFullYear();
  readonly instagram = linkInstagram(this.config);
  readonly whatsapp = linkWhatsapp(this.config);

  readonly links: { secao: Secao; rotulo: string }[] = [
    { secao: 'inicio', rotulo: 'Início' },
    { secao: 'catalogo', rotulo: 'Catálogo' },
    { secao: 'contato', rotulo: 'Contato' },
  ];

  irPara(evento: Event, secao: Secao): void {
    evento.preventDefault();
    this.nav.irPara(secao);
  }
}

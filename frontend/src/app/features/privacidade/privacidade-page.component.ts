import { Component, OnInit, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule } from 'lucide-angular';

import { SITE_CONFIG } from '../../core/config/site.config';

/**
 * Aviso de privacidade proporcional ao MVP.
 * IMPORTANTE: texto-base. Deve ser revisado pelo responsável pelo tratamento
 * dos dados antes da publicação; não representa garantia de conformidade legal.
 */
@Component({
  selector: 'app-privacidade-page',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  template: `
    <article class="page-container max-w-3xl py-16 sm:py-20">
      <a routerLink="/" class="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <lucide-icon [img]="ArrowLeft" [size]="16" aria-hidden="true" /> Voltar ao início
      </a>
      <h1 class="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl">Aviso de privacidade</h1>
      <p class="mt-4 text-muted">
        Este aviso explica como {{ config.nomeMarca }} trata os dados enviados pelo formulário de contato deste site.
      </p>

      <div class="card mt-10 space-y-8 p-6 text-[0.95rem] leading-relaxed text-fg/90 sm:p-10">
        <section>
          <h2 class="text-lg font-semibold text-fg">Quais dados coletamos</h2>
          <p class="mt-2 text-muted">
            Apenas o que você informa no formulário: nome, e-mail, telefone (opcional), tipo de demanda,
            assunto, mensagem e, se escolhida, a peça do catálogo. Também registramos a data e a hora do envio. Não solicitamos CPF, CNPJ, endereço, dados
            financeiros nem outros documentos.
          </p>
        </section>
        <section>
          <h2 class="text-lg font-semibold text-fg">Para que usamos</h2>
          <p class="mt-2 text-muted">
            Exclusivamente para responder à sua mensagem, tirar dúvidas e elaborar orçamentos solicitados por você. Não
            vendemos nem compartilhamos esses dados para fins de marketing.
          </p>
        </section>
        <section>
          <h2 class="text-lg font-semibold text-fg">Como armazenamos</h2>
          <p class="mt-2 text-muted">
            As mensagens ficam em um banco de dados de acesso restrito e não são exibidas publicamente no site. Os
            registros técnicos do servidor não guardam o conteúdo das mensagens nem os e-mails enviados.
          </p>
        </section>
        <section>
          <h2 class="text-lg font-semibold text-fg">Seus direitos</h2>
          <p class="mt-2 text-muted">
            Você pode pedir acesso, correção ou exclusão dos seus dados.
            @if (config.emailPrivacidade) {
              Envie sua solicitação para
              <a [href]="'mailto:' + config.emailPrivacidade" class="text-accent-ink underline underline-offset-2">{{ config.emailPrivacidade }}</a>.
            } @else {
              Para isso, utilize o formulário de contato do site, informando no assunto “Privacidade”.
            }
          </p>
        </section>
      </div>
    </article>
  `,
})
export class PrivacidadePageComponent implements OnInit {
  readonly config = inject(SITE_CONFIG);
  private readonly title = inject(Title);
  readonly ArrowLeft = ArrowLeft;

  ngOnInit(): void {
    this.title.setTitle(`Aviso de privacidade · ${this.config.nomeMarca}`);
  }
}

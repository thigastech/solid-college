import { Component, inject } from '@angular/core';

import { SITE_CONFIG } from '../../core/config/site.config';

@Component({
  selector: 'app-diferenciais',
  standalone: true,
  template: `
    <section aria-labelledby="diferenciais-titulo" class="glass rounded-none border-x-0">
      <div class="page-container">
        <h2 id="diferenciais-titulo" class="sr-only">Como trabalhamos</h2>
        <ol class="grid divide-y divide-border sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0 lg:grid-cols-4 lg:gap-x-0 lg:divide-x">
          @for (item of config.diferenciais; track item.titulo; let i = $index) {
            <li class="py-6 sm:py-8 lg:px-6 lg:first:pl-0 lg:last:pr-0">
              <p class="font-mono text-xs text-muted">{{ '0' + (i + 1) }}</p>
              <h3 class="mt-2 font-bold text-fg">{{ item.titulo }}</h3>
              <p class="mt-1 text-sm leading-relaxed text-muted">{{ item.descricao }}</p>
            </li>
          }
        </ol>
      </div>
    </section>
  `,
})
export class DiferenciaisComponent {
  readonly config = inject(SITE_CONFIG);
}

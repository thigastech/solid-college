import { Component, Input, inject } from '@angular/core';

import { SITE_CONFIG } from '../config/site.config';

/**
 * Marca SOLID: impressora 3D (moldura laranja, mesa e peça em impressão) +
 * nome em grafite. As cores vêm dos tokens, então acompanham o tema.
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  template: `
    <span class="flex items-center gap-2.5">
      <svg [attr.width]="tamanho" [attr.height]="tamanho" viewBox="0 0 31 30" aria-hidden="true" class="shrink-0" stroke-linejoin="round">
        <rect x="3" y="3" width="22" height="23" rx="1.2" fill="none" stroke="rgb(var(--c-accent))" stroke-width="2.6" />
        <rect x="3" y="20" width="22" height="6" fill="rgb(var(--c-accent))" />
        <path d="M3 7.5h22" stroke="rgb(var(--c-fg))" stroke-width="1.6" />
        <path d="M12.5 7.5h4v2.6l-2 1.8-2-1.8z" fill="rgb(var(--c-fg))" />
        <rect x="11" y="12.5" width="6.5" height="6" fill="rgb(var(--c-accent))" stroke="rgb(var(--c-fg))" stroke-width="1.5" />
        <path d="M6.5 19.2h15" stroke="rgb(var(--c-fg))" stroke-width="1.8" stroke-linecap="round" />
        <path d="M5 28h3M20 28h3" stroke="rgb(var(--c-fg))" stroke-width="2.2" stroke-linecap="round" />
        <circle cx="27.6" cy="13" r="2.6" fill="none" stroke="rgb(var(--c-fg))" stroke-width="1.4" />
      </svg>
      <span class="flex flex-col leading-none">
        <span class="text-[1.15rem] font-black tracking-[0.04em] text-fg">{{ config.nomeMarca }}</span>
        @if (comSlogan && config.slogan) {
          <span class="mt-1 text-[0.55rem] font-bold uppercase tracking-[0.2em] text-accent-ink">{{ config.slogan }}</span>
        }
      </span>
    </span>
  `,
})
export class LogoComponent {
  readonly config = inject(SITE_CONFIG);
  @Input() tamanho = 32;
  @Input() comSlogan = true;
}

import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

export type Secao = 'inicio' | 'catalogo' | 'contato';

/** Navegação por âncoras que funciona tanto na landing quanto em outras rotas. */
@Injectable({ providedIn: 'root' })
export class NavegacaoService {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  irPara(secao: Secao, focarEm?: string): void {
    const naHome = this.router.url.split(/[?#]/)[0] === '/';
    if (!naHome) {
      void this.router.navigate(['/'], { fragment: secao }).then(() => this.rolar(secao, focarEm));
      return;
    }
    this.rolar(secao, focarEm);
    this.document.defaultView?.history.replaceState(null, '', `/#${secao}`);
  }

  rolar(secao: string, focarEm?: string): void {
    const view = this.document.defaultView;
    const executar = () => {
      const alvo = this.document.getElementById(secao);
      if (!alvo) return;
      const reduzir = view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      alvo.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' });
      // Move o foco para leitores de tela e teclado sem provocar novo salto.
      const foco = (focarEm ? this.document.getElementById(focarEm) : null) ?? alvo.querySelector<HTMLElement>('h1, h2');
      foco?.focus({ preventScroll: true });
    };
    if (view) view.requestAnimationFrame(executar);
    else executar();
  }
}

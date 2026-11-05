import { Component, ElementRef, HostListener, ViewChild, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Instagram, LucideAngularModule, Menu, Moon, Sun, X } from 'lucide-angular';

import { SITE_CONFIG, linkInstagram } from '../config/site.config';
import { NavegacaoService, Secao } from '../services/navegacao.service';
import { TemaService } from '../services/tema.service';
import { LogoComponent } from './logo.component';

interface LinkNav {
  secao: Secao;
  rotulo: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [LucideAngularModule, LogoComponent],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  private readonly nav = inject(NavegacaoService);
  readonly config = inject(SITE_CONFIG);
  readonly tema = inject(TemaService);
  readonly icones = { Menu, X, Sun, Moon, Instagram };
  readonly instagram = linkInstagram(this.config);

  readonly links: LinkNav[] = [
    { secao: 'inicio', rotulo: 'Início' },
    { secao: 'catalogo', rotulo: 'Catálogo' },
    { secao: 'contato', rotulo: 'Contato' },
  ];

  readonly menuAberto = signal(false);
  readonly rolou = signal(false);

  @ViewChild('botaoMenu') private botaoMenu?: ElementRef<HTMLButtonElement>;

  constructor() {
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationStart) this.menuAberto.set(false);
    });
  }

  @HostListener('window:scroll')
  aoRolar(): void {
    this.rolou.set(window.scrollY > 8);
  }

  @HostListener('document:keydown.escape')
  aoPressionarEscape(): void {
    if (this.menuAberto()) {
      this.menuAberto.set(false);
      this.botaoMenu?.nativeElement.focus();
    }
  }

  alternarMenu(): void {
    this.menuAberto.update((v) => !v);
  }

  irPara(evento: Event, secao: Secao): void {
    evento.preventDefault();
    this.menuAberto.set(false);
    this.nav.irPara(secao);
  }
}

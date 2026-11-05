import { AfterViewInit, Component, OnInit, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

import { SITE_CONFIG } from '../../core/config/site.config';
import { CatalogoStore } from '../../core/services/catalogo.store';
import { NavegacaoService } from '../../core/services/navegacao.service';
import { CatalogoComponent } from '../catalogo/catalogo.component';
import { ContatoFormComponent } from '../contato/contato-form.component';
import { DiferenciaisComponent } from './diferenciais.component';
import { HeroComponent } from './hero.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [HeroComponent, DiferenciaisComponent, CatalogoComponent, ContatoFormComponent],
  template: `
    <app-hero />
    <app-diferenciais />
    <app-catalogo />
    <app-contato-form />
  `,
})
export class HomePageComponent implements OnInit, AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly nav = inject(NavegacaoService);
  private readonly store = inject(CatalogoStore);
  private readonly config = inject(SITE_CONFIG);
  private readonly title = inject(Title);

  ngOnInit(): void {
    this.title.setTitle(`${this.config.nomeMarca} · Peças e soluções em impressão 3D`);
    this.store.carregarSeNecessario();
  }

  ngAfterViewInit(): void {
    const fragmento = this.route.snapshot.fragment;
    if (fragmento) this.nav.rolar(fragmento);
  }
}

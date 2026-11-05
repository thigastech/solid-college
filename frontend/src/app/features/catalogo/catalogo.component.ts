import { Component, computed, inject, signal } from '@angular/core';
import { AlertTriangle, LucideAngularModule, RotateCw, Search, SearchX, X } from 'lucide-angular';

import { Produto } from '../../core/models/produto.model';
import { CatalogoStore } from '../../core/services/catalogo.store';
import { DetalheProdutoService } from '../../core/services/detalhe-produto.service';
import { NavegacaoService } from '../../core/services/navegacao.service';
import { SelecaoProdutoService } from '../../core/services/selecao-produto.service';
import { normalizar } from '../../shared/utils/texto';
import { ProdutoCardComponent } from './produto-card.component';
import { ProdutoDetalheComponent } from './produto-detalhe.component';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [LucideAngularModule, ProdutoCardComponent, ProdutoDetalheComponent],
  templateUrl: './catalogo.component.html',
})
export class CatalogoComponent {
  readonly store = inject(CatalogoStore);
  private readonly selecao = inject(SelecaoProdutoService);
  private readonly nav = inject(NavegacaoService);
  readonly detalhe = inject(DetalheProdutoService);

  readonly icones = { Search, SearchX, X, AlertTriangle, RotateCw };
  readonly esqueletos = Array.from({ length: 6 }, (_, i) => i);

  readonly busca = signal('');
  readonly categoria = signal<string | null>(null);

  readonly filtrados = computed(() => {
    const termo = normalizar(this.busca());
    const categoria = this.categoria();
    return this.store.produtos().filter((p) => {
      if (categoria && p.categoria !== categoria) return false;
      if (!termo) return true;
      return normalizar(p.nome).includes(termo) || normalizar(p.descricao).includes(termo);
    });
  });

  readonly temFiltro = computed(() => this.busca().trim() !== '' || this.categoria() !== null);

  readonly textoResultados = computed(() => {
    const n = this.filtrados().length;
    if (n === 0) return 'Nenhuma peça encontrada';
    return n === 1 ? '1 peça encontrada' : `${n} peças encontradas`;
  });

  aoDigitar(evento: Event): void {
    this.busca.set((evento.target as HTMLInputElement).value);
  }

  escolherCategoria(categoria: string | null): void {
    this.categoria.set(categoria);
  }

  limparFiltros(): void {
    this.busca.set('');
    this.categoria.set(null);
  }

  tentarNovamente(): void {
    this.store.carregar();
  }

  abrirDetalhes(produto: Produto): void {
    this.detalhe.abrir(produto);
  }

  fecharDetalhes(): void {
    this.detalhe.fechar();
  }

  solicitarOrcamento(produto: Produto): void {
    this.detalhe.fechar();
    this.selecao.selecionar(produto);
    this.nav.irPara('contato', 'nome_cliente');
  }
}

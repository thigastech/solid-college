import { Injectable, computed, inject, signal } from '@angular/core';

import { Produto } from '../models/produto.model';
import { interpretarErroApi } from './api-erro';
import { ProdutoService } from './produto.service';

export type EstadoCatalogo = 'ocioso' | 'carregando' | 'pronto' | 'erro';

/**
 * Estado compartilhado do catálogo (lista de produtos ativos vinda da API).
 * Usado pela vitrine e pelo campo "Produto de interesse" do formulário.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoStore {
  private readonly service = inject(ProdutoService);

  readonly estado = signal<EstadoCatalogo>('ocioso');
  readonly produtos = signal<Produto[]>([]);
  readonly categorias = signal<string[]>([]);
  readonly mensagemErro = signal<string | null>(null);
  readonly carregado = computed(() => this.estado() === 'pronto');

  carregar(): void {
    if (this.estado() === 'carregando') return;
    this.estado.set('carregando');
    this.mensagemErro.set(null);
    this.service.listar().subscribe({
      next: ({ produtos, categorias }) => {
        this.produtos.set(produtos);
        this.categorias.set(categorias);
        this.estado.set('pronto');
      },
      error: (erro: unknown) => {
        const { status, mensagem } = interpretarErroApi(erro);
        this.mensagemErro.set(
          status === 0 ? 'Não foi possível carregar o catálogo agora. Verifique sua conexão.' : mensagem,
        );
        this.estado.set('erro');
      },
    });
  }

  carregarSeNecessario(): void {
    if (this.estado() === 'ocioso') this.carregar();
  }

  buscarPorId(id: number): Produto | undefined {
    return this.produtos().find((p) => p.id === id);
  }
}

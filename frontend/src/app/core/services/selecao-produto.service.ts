import { Injectable, signal } from '@angular/core';

import { Produto } from '../models/produto.model';

/** Produto escolhido no catálogo para pré-preencher o formulário de contato. */
@Injectable({ providedIn: 'root' })
export class SelecaoProdutoService {
  private readonly _selecionado = signal<Produto | null>(null);
  readonly selecionado = this._selecionado.asReadonly();

  selecionar(produto: Produto | null): void {
    this._selecionado.set(produto);
  }

  limpar(): void {
    this._selecionado.set(null);
  }
}

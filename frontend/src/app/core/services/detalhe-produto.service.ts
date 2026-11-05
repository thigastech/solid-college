import { Injectable, signal } from '@angular/core';

import { Produto } from '../models/produto.model';

/** Produto exibido no diálogo de detalhes (aberto pelo catálogo ou pela vitrine do topo). */
@Injectable({ providedIn: 'root' })
export class DetalheProdutoService {
  private readonly _aberto = signal<Produto | null>(null);
  readonly aberto = this._aberto.asReadonly();

  abrir(produto: Produto): void {
    this._aberto.set(produto);
  }

  fechar(): void {
    this._aberto.set(null);
  }
}

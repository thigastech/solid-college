import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiSucesso } from '../models/api.model';
import { Catalogo, Produto, ProdutosMeta } from '../models/produto.model';

@Injectable({ providedIn: 'root' })
export class ProdutoService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** Lista todos os produtos ativos. A API já exclui os inativos. */
  listar(): Observable<Catalogo> {
    return this.http
      .get<ApiSucesso<Produto[], ProdutosMeta>>(`${this.base}/api/produtos`)
      .pipe(
        map((resp) => ({
          produtos: resp.data.map((p) => ({ ...p, imagem_url: this.resolverImagem(p.imagem_url) })),
          categorias: resp.meta?.categorias ?? [],
        })),
      );
  }

  /** Caminhos relativos (/static/...) são servidos pelo backend. */
  private resolverImagem(url: string | null): string | null {
    if (!url) return null;
    return url.startsWith('/') ? `${this.base}${url}` : url;
  }
}

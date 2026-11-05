import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ContatoAdmin, ContatosAdminMeta, FiltroContatosAdmin } from '../models/admin.model';
import { ApiSucesso } from '../models/api.model';

export const POR_PAGINA_ADMIN = 20;

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/api/admin/contatos`;

  listarContatos(
    token: string,
    filtro: FiltroContatosAdmin,
  ): Observable<{ contatos: ContatoAdmin[]; meta: ContatosAdminMeta }> {
    let params = new HttpParams().set('pagina', filtro.pagina).set('por_pagina', POR_PAGINA_ADMIN);
    const busca = filtro.busca?.trim();
    if (busca) params = params.set('busca', busca);
    if (filtro.produto_id) params = params.set('produto_id', filtro.produto_id);
    if (filtro.demanda) params = params.set('demanda', filtro.demanda);

    return this.http
      .get<ApiSucesso<ContatoAdmin[], ContatosAdminMeta>>(this.url, {
        params,
        headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
      })
      .pipe(map((r) => ({ contatos: r.data, meta: r.meta as ContatosAdminMeta })));
  }
}

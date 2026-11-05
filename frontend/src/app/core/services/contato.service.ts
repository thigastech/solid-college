import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiSucesso } from '../models/api.model';
import { ContatoCriado, ContatoPayload, DesafioCaptcha } from '../models/contato.model';

@Injectable({ providedIn: 'root' })
export class ContatoService {
  private readonly http = inject(HttpClient);

  desafioCaptcha(): Observable<ApiSucesso<DesafioCaptcha>> {
    return this.http.get<ApiSucesso<DesafioCaptcha>>(`${environment.apiBaseUrl}/api/contatos/captcha`);
  }

  enviar(payload: ContatoPayload): Observable<ApiSucesso<ContatoCriado>> {
    return this.http.post<ApiSucesso<ContatoCriado>>(`${environment.apiBaseUrl}/api/contatos`, payload);
  }
}

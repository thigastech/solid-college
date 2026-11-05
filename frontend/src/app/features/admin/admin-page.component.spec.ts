import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ContatoAdmin, ContatosAdminMeta } from '../../core/models/admin.model';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AdminPageComponent } from './admin-page.component';

const TOKEN = 'k'.repeat(40);
const CONTATOS: ContatoAdmin[] = [
  {
    id: 2,
    nome_cliente: 'Ana Teste',
    email_cliente: 'ana@example.com',
    telefone: '11912345678',
    demanda: 'peca_catalogo',
    assunto: 'Orçamento de engrenagem',
    mensagem: 'Preciso de 10 unidades.',
    data_envio: '2026-10-27T14:00:00+00:00',
    produto: { id: 1, nome: 'Engrenagem reta', status: 'ativo' },
  },
  {
    id: 1,
    nome_cliente: 'Bruno Teste',
    email_cliente: 'bruno@example.com',
    telefone: null,
    demanda: 'prototipagem',
    assunto: 'Dúvida geral',
    mensagem: 'Vocês fazem peças em resina?',
    data_envio: '2026-10-26T10:00:00+00:00',
    produto: null,
  },
];
const META: ContatosAdminMeta = {
  total: 2,
  pagina: 1,
  por_pagina: 20,
  paginas: 1,
  produtos: [{ id: 1, nome: 'Engrenagem reta', status: 'ativo' }],
};

describe('AdminPageComponent', () => {
  let fixture: ComponentFixture<AdminPageComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const criar = () => {
    fixture = TestBed.createComponent(AdminPageComponent);
    http = TestBed.inject(HttpTestingController);
    el = fixture.nativeElement;
    fixture.detectChanges();
  };

  const entrarCom = (token: string) => {
    const input = el.querySelector<HTMLInputElement>('#token')!;
    input.value = token;
    input.dispatchEvent(new Event('input'));
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  const requisicao = () => http.expectOne((r) => r.url.endsWith('/api/admin/contatos'));
  const nao401 = { status: 401, statusText: 'Unauthorized' };

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [AdminPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('exige o token e não consulta a API com valor curto demais', () => {
    criar();
    entrarCom('curto');
    http.expectNone((r) => r.url.endsWith('/api/admin/contatos'));
    expect(el.querySelector('#token-erro')?.textContent).toContain('pelo menos 32');
  });

  it('mostra erro para token inválido e continua deslogado', () => {
    criar();
    entrarCom('x'.repeat(40));
    requisicao().flush({ success: false, message: 'Token de acesso inválido.' }, nao401);
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Token inválido');
    expect(TestBed.inject(AdminAuthService).autenticado()).toBeFalse();
    expect(sessionStorage.getItem('solid-admin-token')).toBeNull();
  });

  it('envia o token no cabeçalho, lista os contatos e guarda a sessão só na aba', () => {
    criar();
    entrarCom(TOKEN);
    const req = requisicao();
    expect(req.request.headers.get('Authorization')).toBe('Bearer ' + TOKEN);
    expect(req.request.urlWithParams).not.toContain(TOKEN);
    req.flush({ success: true, data: CONTATOS, meta: META });
    fixture.detectChanges();

    const assuntos = Array.from(el.querySelectorAll('li.card .font-bold')).map((e) => e.textContent?.trim());
    expect(assuntos).toEqual(['Orçamento de engrenagem', 'Dúvida geral']);
    expect(el.textContent).toContain('2 contatos no total');
    expect(sessionStorage.getItem('solid-admin-token')).toBe(TOKEN);
    expect(localStorage.getItem('solid-admin-token')).toBeNull();
  });

  it('expande um contato mostrando a mensagem e o link de resposta', () => {
    sessionStorage.setItem('solid-admin-token', TOKEN);
    criar();
    requisicao().flush({ success: true, data: CONTATOS, meta: META });
    fixture.detectChanges();

    const botao = el.querySelector<HTMLButtonElement>('li.card button[aria-expanded]')!;
    botao.click();
    fixture.detectChanges();

    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('#contato-2')?.textContent).toContain('Preciso de 10 unidades.');
    expect(el.querySelector('#contato-2')?.textContent).toContain('Peça do catálogo');
    expect(el.querySelector('#contato-2')?.textContent).toContain('11912345678');
    const link = el.querySelector<HTMLAnchorElement>('#contato-2 a[href^="mailto:"]')!;
    expect(link.getAttribute('href')).toBe('mailto:ana@example.com?subject=Re%3A%20Or%C3%A7amento%20de%20engrenagem');
  });

  it('aplica a busca com atraso e volta para a primeira página', fakeAsync(() => {
    sessionStorage.setItem('solid-admin-token', TOKEN);
    criar();
    requisicao().flush({ success: true, data: CONTATOS, meta: META });
    fixture.detectChanges();

    const busca = el.querySelector<HTMLInputElement>('#busca-admin')!;
    busca.value = 'ana';
    busca.dispatchEvent(new Event('input'));
    tick(400);

    const req = requisicao();
    expect(req.request.params.get('busca')).toBe('ana');
    expect(req.request.params.get('pagina')).toBe('1');
    req.flush({ success: true, data: [CONTATOS[0]], meta: { ...META, total: 1 } });
    fixture.detectChanges();
    expect(el.textContent).toContain('1 contato encontrado com os filtros atuais');
  }));

  it('encerra a sessão quando a API responde 401 durante o uso', fakeAsync(() => {
    sessionStorage.setItem('solid-admin-token', TOKEN);
    criar();
    requisicao().flush({ success: false, message: 'Token de acesso inválido.' }, nao401);
    fixture.detectChanges();
    tick();

    expect(sessionStorage.getItem('solid-admin-token')).toBeNull();
    expect(el.querySelector('#token')).not.toBeNull();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('sessão expirou');
  }));

  it('sair apaga o token da aba', fakeAsync(() => {
    sessionStorage.setItem('solid-admin-token', TOKEN);
    criar();
    requisicao().flush({ success: true, data: [], meta: { ...META, total: 0, produtos: [] } });
    fixture.detectChanges();
    expect(el.textContent).toContain('Nenhum contato recebido ainda');

    Array.from(el.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.includes('Sair'))!
      .click();
    fixture.detectChanges();
    tick();
    expect(sessionStorage.getItem('solid-admin-token')).toBeNull();
    expect(el.querySelector('#token')).not.toBeNull();
  }));
});

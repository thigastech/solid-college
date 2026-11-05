import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Produto } from '../../core/models/produto.model';
import { CatalogoStore } from '../../core/services/catalogo.store';
import { SelecaoProdutoService } from '../../core/services/selecao-produto.service';
import { ContatoFormComponent } from './contato-form.component';

const PRODUTO: Produto = {
  id: 7,
  nome: 'Polia com flanges',
  descricao: null,
  especificacao_tecnica: [],
  imagem_url: null,
  categoria: 'Componentes mecânicos',
};

describe('ContatoFormComponent', () => {
  let fixture: ComponentFixture<ContatoFormComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const preencher = (id: string, valor: string) => {
    const campo = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('blur'));
  };

  const escolher = (id: string, valor: string) => {
    const select = el.querySelector<HTMLSelectElement>(`#${id}`)!;
    select.value = valor;
    select.dispatchEvent(new Event('change'));
    select.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  };

  const urlCaptcha = (r: { url: string }) => r.url.endsWith('/api/contatos/captcha');
  const responderDesafio = (token = 'token-1') =>
    http.expectOne(urlCaptcha).flush({ success: true, data: { pergunta: 'Quanto é 2 + 3?', token } });

  const preencherValido = () => {
    preencher('nome_cliente', 'Maria Teste');
    preencher('email_cliente', 'maria@example.com');
    escolher('demanda', 'prototipagem');
    preencher('assunto', 'Orçamento de peça');
    preencher('mensagem', 'Preciso de 10 unidades desta peça.');
    preencher('captcha_resposta', '5');
    fixture.detectChanges();
  };

  const botaoEnviar = () => el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const enviar = () => {
    botaoEnviar().click();
    fixture.detectChanges();
  };
  const erroDo = (id: string) => el.querySelector(`#${id}-erro`)?.textContent?.trim();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ContatoFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const store = TestBed.inject(CatalogoStore);
    store.produtos.set([PRODUTO]);
    store.estado.set('pronto');

    fixture = TestBed.createComponent(ContatoFormComponent);
    http = TestBed.inject(HttpTestingController);
    el = fixture.nativeElement;
    responderDesafio();
    fixture.detectChanges();
  });

  afterEach(() => {
    http.match(urlCaptcha).forEach((r) => r.flush({ success: true, data: { pergunta: 'Quanto é 1 + 1?', token: 't' } }));
    http.verify();
  });

  it('valida campos obrigatórios e formato de e-mail sem chamar a API', () => {
    preencher('email_cliente', 'maria@x');
    enviar();

    expect(erroDo('nome_cliente')).toBe('Campo obrigatório.');
    expect(erroDo('email_cliente')).toContain('Informe um e-mail válido');
    expect(erroDo('demanda')).toBe('Selecione o tipo de demanda.');
    expect(erroDo('assunto')).toBe('Campo obrigatório.');
    expect(erroDo('mensagem')).toBe('Campo obrigatório.');
    expect(erroDo('captcha_resposta')).toBe('Campo obrigatório.');
    expect(erroDo('telefone')).toBeUndefined();
    expect(el.querySelector('#nome_cliente')?.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#nome_cliente')?.getAttribute('aria-describedby')).toBe('nome_cliente-erro');
    http.expectNone(() => true);
  });

  it('aplica limites de tamanho', () => {
    preencher('mensagem', 'curta');
    preencher('nome_cliente', 'x'.repeat(101));
    fixture.detectChanges();
    expect(erroDo('mensagem')).toBe('Informe ao menos 10 caracteres.');
    expect(erroDo('nome_cliente')).toBe('Use no máximo 100 caracteres.');
  });

  it('desabilita o botão durante o envio e evita submissões duplicadas', () => {
    preencherValido();
    enviar();

    expect(botaoEnviar().disabled).toBeTrue();
    expect(botaoEnviar().textContent).toContain('Enviando');

    fixture.componentInstance.enviar();
    const reqs = http.match((r) => r.url.endsWith('/api/contatos'));
    expect(reqs.length).toBe(1);
    expect(reqs[0].request.method).toBe('POST');
    reqs[0].flush({ success: true, message: 'ok', data: { id: 1, data_envio: '2026-01-01T00:00:00Z', produto_id: null } }, { status: 201, statusText: 'Created' });
  });

  it('valida o telefone só quando informado', () => {
    preencher('telefone', '123');
    fixture.detectChanges();
    expect(erroDo('telefone')).toBe('Informe um telefone válido com DDD.');

    preencher('telefone', '');
    fixture.detectChanges();
    expect(erroDo('telefone')).toBeUndefined();
  });

  it('mostra a pergunta de verificação e, se o servidor recusar, troca por uma nova', () => {
    expect(el.querySelector('label[for="captcha_resposta"]')?.textContent).toContain('Quanto é 2 + 3?');

    preencherValido();
    enviar();
    http.expectOne((r) => r.url.endsWith('/api/contatos')).flush(
      { success: false, message: 'Verifique os campos enviados.', errors: { captcha_resposta: ['Resposta incorreta ou expirada. Responda à nova pergunta.'] } },
      { status: 422, statusText: 'Unprocessable' },
    );
    responderDesafio('token-2');
    fixture.detectChanges();

    expect(erroDo('captcha_resposta')).toContain('Resposta incorreta');
    expect(el.querySelector<HTMLInputElement>('#captcha_resposta')!.value).toBe('');
    expect(el.querySelector<HTMLInputElement>('#nome_cliente')!.value).toBe('Maria Teste');
    expect(fixture.componentInstance.desafio()?.token).toBe('token-2');
  });

  it('não envia sem desafio carregado e permite tentar de novo', () => {
    fixture.componentInstance.carregarDesafio();
    http.expectOne(urlCaptcha).flush({ success: false, message: 'Erro' }, { status: 500, statusText: 'Erro' });
    fixture.detectChanges();
    expect(el.textContent).toContain('Não foi possível carregar a pergunta');

    preencherValido();
    enviar();
    http.expectNone((r) => r.url.endsWith('/api/contatos'));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Seus dados foram mantidos');
    responderDesafio('token-3');
  });

  it('só mostra sucesso após resposta 201 e então limpa o formulário', () => {
    preencherValido();
    preencher('telefone', '(11) 91234-5678');
    fixture.detectChanges();
    enviar();
    expect(el.querySelector('[role="status"]')).toBeNull();

    const req = http.expectOne((r) => r.url.endsWith('/api/contatos'));
    expect(req.request.body).toEqual(
      jasmine.objectContaining({
        nome_cliente: 'Maria Teste',
        email_cliente: 'maria@example.com',
        demanda: 'prototipagem',
        assunto: 'Orçamento de peça',
        telefone: '(11) 91234-5678',
        produto_id: null,
        website: '',
        captcha_token: 'token-1',
        captcha_resposta: '5',
      }),
    );
    req.flush(
      { success: true, message: 'Mensagem recebida.', data: { id: 1, data_envio: '2026-01-01T00:00:00Z', produto_id: null } },
      { status: 201, statusText: 'Created' },
    );
    fixture.detectChanges();

    expect(el.querySelector('[role="status"]')?.textContent).toContain('Mensagem recebida.');
    expect(el.querySelector<HTMLInputElement>('#nome_cliente')!.value).toBe('');
    expect(erroDo('nome_cliente')).toBeUndefined();
    expect(botaoEnviar().disabled).toBeFalse();
  });

  it('mantém os dados e mostra erro quando a API falha', () => {
    preencherValido();
    enviar();
    http
      .expectOne((r) => r.url.endsWith('/api/contatos'))
      .flush({ success: false, message: 'Erro interno.' }, { status: 500, statusText: 'Erro' });
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Seus dados foram mantidos');
    expect(el.querySelector<HTMLInputElement>('#nome_cliente')!.value).toBe('Maria Teste');
    expect(el.querySelector<HTMLTextAreaElement>('#mensagem')!.value).toBe('Preciso de 10 unidades desta peça.');
    expect(el.querySelector('[role="status"]')).toBeNull();
    expect(botaoEnviar().disabled).toBeFalse();
  });

  it('exibe erros de validação do servidor junto ao campo', () => {
    preencherValido();
    enviar();
    http.expectOne((r) => r.url.endsWith('/api/contatos')).flush(
      { success: false, message: 'Verifique os campos enviados.', errors: { email_cliente: ['Informe um e-mail válido.'] } },
      { status: 422, statusText: 'Unprocessable' },
    );
    fixture.detectChanges();

    expect(erroDo('email_cliente')).toBe('Informe um e-mail válido.');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Corrija os campos destacados');
  });

  it('só mostra a escolha de peça na demanda "Peça do catálogo" e sugere o assunto pela demanda', () => {
    expect(el.querySelector('#produto_id')).toBeNull();

    escolher('demanda', 'producao_lote');
    expect(el.querySelector('#produto_id')).toBeNull();
    expect(el.querySelector<HTMLInputElement>('#assunto')!.value).toBe('Impressão em lote (larga escala)');

    escolher('demanda', 'peca_catalogo');
    expect(el.querySelector('#produto_id')).not.toBeNull();
  });

  it('ao trocar de demanda, descarta a peça escolhida no catálogo', () => {
    TestBed.inject(SelecaoProdutoService).selecionar(PRODUTO);
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.produto_id.value).toBe(7);

    escolher('demanda', 'modelagem_3d');
    expect(fixture.componentInstance.form.controls.produto_id.value).toBeNull();
    expect(TestBed.inject(SelecaoProdutoService).selecionado()).toBeNull();
    expect(el.querySelector('#produto_id')).toBeNull();
  });

  it('preenche demanda, peça e assunto a partir da seleção no catálogo e envia o produto_id', () => {
    TestBed.inject(SelecaoProdutoService).selecionar(PRODUTO);
    fixture.detectChanges();

    expect(el.querySelector<HTMLSelectElement>('#demanda')!.value).toBe('peca_catalogo');

    const select = el.querySelector<HTMLSelectElement>('#produto_id')!;
    expect(select.selectedOptions[0].textContent?.trim()).toBe('Polia com flanges');
    expect(el.querySelector<HTMLInputElement>('#assunto')!.value).toBe('Orçamento: Polia com flanges');

    preencher('nome_cliente', 'Maria Teste');
    preencher('email_cliente', 'maria@example.com');
    preencher('mensagem', 'Preciso de 10 unidades desta peça.');
    preencher('captcha_resposta', '5');
    fixture.detectChanges();
    enviar();

    const req = http.expectOne((r) => r.url.endsWith('/api/contatos'));
    expect(req.request.body.produto_id).toBe(7);
    expect(req.request.body.demanda).toBe('peca_catalogo');
    req.flush({ success: true, data: { id: 1, data_envio: '2026-01-01T00:00:00Z', produto_id: 7 } }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();
    expect(TestBed.inject(SelecaoProdutoService).selecionado()).toBeNull();
  });
});

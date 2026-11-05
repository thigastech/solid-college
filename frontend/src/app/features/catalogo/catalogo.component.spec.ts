import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Produto } from '../../core/models/produto.model';
import { CatalogoStore } from '../../core/services/catalogo.store';
import { SelecaoProdutoService } from '../../core/services/selecao-produto.service';
import { CatalogoComponent } from './catalogo.component';

const PRODUTOS: Produto[] = [
  {
    id: 1,
    nome: 'Engrenagem reta',
    descricao: 'Peça para mecanismos leves',
    especificacao_tecnica: [{ rotulo: 'Processo', valor: 'FDM' }],
    imagem_url: '/static/produtos/engrenagem.svg',
    categoria: 'Componentes mecânicos',
  },
  {
    id: 2,
    nome: 'Vaso torcido',
    descricao: 'Decoração com camadas aparentes',
    especificacao_tecnica: [],
    imagem_url: null,
    categoria: 'Decoração',
  },
];

describe('CatalogoComponent', () => {
  let fixture: ComponentFixture<CatalogoComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const responderComSucesso = () =>
    http.expectOne((r) => r.url.endsWith('/api/produtos')).flush({
      success: true,
      data: PRODUTOS,
      meta: { total: 2, categorias: ['Componentes mecânicos', 'Decoração'] },
    });

  const cardsVisiveis = () => Array.from(el.querySelectorAll('app-produto-card h3')).map((h) => h.textContent?.trim());

  const digitarBusca = (texto: string) => {
    const input = el.querySelector<HTMLInputElement>('#busca-catalogo')!;
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CatalogoComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(CatalogoComponent);
    http = TestBed.inject(HttpTestingController);
    el = fixture.nativeElement;
    TestBed.inject(CatalogoStore).carregar();
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('exibe o estado de carregamento enquanto a API não responde', () => {
    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(el.textContent).toContain('Carregando catálogo');
    responderComSucesso();
  });

  it('renderiza os cards retornados pela API com contagem de resultados', () => {
    responderComSucesso();
    fixture.detectChanges();
    expect(cardsVisiveis()).toEqual(['Engrenagem reta', 'Vaso torcido']);
    expect(el.textContent).toContain('2 peças encontradas');
    expect(el.querySelector('img')?.getAttribute('src')).toContain('/static/produtos/engrenagem.svg');
  });

  it('exibe erro amigável e permite tentar novamente sem usar dados fictícios', () => {
    http.expectOne((r) => r.url.endsWith('/api/produtos')).flush({ success: false, message: 'Erro interno.' }, { status: 500, statusText: 'Erro' });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível carregar o catálogo');
    expect(cardsVisiveis()).toEqual([]);

    const botao = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Tentar novamente'))!;
    botao.click();
    fixture.detectChanges();
    responderComSucesso();
    fixture.detectChanges();
    expect(cardsVisiveis().length).toBe(2);
  });

  it('pesquisa por nome e descrição ignorando acentos e maiúsculas', () => {
    responderComSucesso();
    fixture.detectChanges();

    digitarBusca('ENGRENÁGEM');
    expect(cardsVisiveis()).toEqual(['Engrenagem reta']);

    digitarBusca('camadas');
    expect(cardsVisiveis()).toEqual(['Vaso torcido']);
    expect(el.textContent).toContain('1 peça encontrada');
  });

  it('filtra por categoria e marca o filtro ativo', () => {
    responderComSucesso();
    fixture.detectChanges();

    const filtro = Array.from(el.querySelectorAll<HTMLButtonElement>('.filtro')).find((b) => b.textContent?.trim() === 'Decoração')!;
    filtro.click();
    fixture.detectChanges();

    expect(filtro.getAttribute('aria-pressed')).toBe('true');
    expect(cardsVisiveis()).toEqual(['Vaso torcido']);
  });

  it('mostra estado vazio e limpa os filtros', () => {
    responderComSucesso();
    fixture.detectChanges();

    digitarBusca('inexistente');
    expect(el.textContent).toContain('Nenhuma peça corresponde à sua busca');

    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Limpar filtros'))!.click();
    fixture.detectChanges();
    expect(cardsVisiveis().length).toBe(2);
  });

  it('seleciona o produto para o formulário ao solicitar orçamento', () => {
    responderComSucesso();
    fixture.detectChanges();

    const botao = Array.from(el.querySelectorAll('app-produto-card button')).find((b) =>
      b.textContent?.includes('Solicitar orçamento de Vaso torcido'),
    ) as HTMLButtonElement;
    botao.click();

    expect(TestBed.inject(SelecaoProdutoService).selecionado()?.id).toBe(2);
  });
});

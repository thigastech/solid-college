import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Produto } from '../../core/models/produto.model';
import { CatalogoStore } from '../../core/services/catalogo.store';
import { DetalheProdutoService } from '../../core/services/detalhe-produto.service';
import { SelecaoProdutoService } from '../../core/services/selecao-produto.service';
import { VitrineComponent } from './vitrine.component';

const produto = (id: number, nome: string): Produto => ({
  id,
  nome,
  descricao: null,
  especificacao_tecnica: [{ rotulo: 'Processo', valor: 'FDM' }],
  imagem_url: '/static/produtos/p' + id + '.svg',
  categoria: 'Teste',
});
const PRODUTOS = [produto(1, 'Engrenagem'), produto(2, 'Polia'), produto(3, 'Knob')];

describe('VitrineComponent', () => {
  let fixture: ComponentFixture<VitrineComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const nomeAtivo = () => el.querySelector('h2')?.textContent?.trim();
  const botao = (rotulo: string) => el.querySelector<HTMLButtonElement>('button[aria-label="' + rotulo + '"]')!;
  const clicar = (b: HTMLElement) => {
    b.click();
    fixture.detectChanges();
  };

  const responder = (produtos: Produto[]) => {
    http.expectOne((r) => r.url.endsWith('/api/produtos')).flush({
      success: true,
      data: produtos,
      meta: { total: produtos.length, categorias: ['Teste'] },
    });
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VitrineComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(VitrineComponent);
    http = TestBed.inject(HttpTestingController);
    el = fixture.nativeElement;
    TestBed.inject(CatalogoStore).carregar();
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('mostra esqueleto enquanto carrega e depois o primeiro produto da API', () => {
    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
    responder(PRODUTOS);
    expect(el.querySelector('[aria-roledescription="carrossel"]')).not.toBeNull();
    expect(nomeAtivo()).toBe('Engrenagem');
  });

  it('navega com próximo, anterior (circular) e miniaturas', () => {
    responder(PRODUTOS);
    clicar(botao('Próximo produto'));
    expect(nomeAtivo()).toBe('Polia');
    clicar(botao('Produto anterior'));
    clicar(botao('Produto anterior'));
    expect(nomeAtivo()).toBe('Knob');
    clicar(botao('Mostrar Polia'));
    expect(nomeAtivo()).toBe('Polia');
    expect(botao('Mostrar Polia').getAttribute('aria-current')).toBe('true');
  });

  it('só o slide ativo fica exposto à tecnologia assistiva', () => {
    responder(PRODUTOS);
    const slides = Array.from(el.querySelectorAll('[aria-roledescription="slide"]'));
    expect(slides.map((s) => s.getAttribute('aria-hidden'))).toEqual(['false', 'true', 'true']);
    expect(slides[1].hasAttribute('inert')).toBeTrue();
  });

  it('avança sozinho ao fim da barra de progresso e pode ser pausado', () => {
    responder(PRODUTOS);
    const progresso = () => el.querySelector('.vitrine-progresso');
    if (!progresso()) {
      pending('Navegador de teste com movimento reduzido: rotação automática desativada.');
      return;
    }
    progresso()!.dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
    expect(nomeAtivo()).toBe('Polia');

    clicar(botao('Pausar rotação automática'));
    expect(progresso()!.classList).toContain('pausado');
    expect(botao('Retomar rotação automática')).not.toBeNull();
    expect(el.querySelector('[aria-live="polite"]')?.textContent).toContain('Produto 2 de 3: Polia');
  });

  it('pausa enquanto o usuário interage com o carrossel', () => {
    responder(PRODUTOS);
    const vitrine = fixture.componentInstance;
    // O estado inicial depende do navegador de teste (aba visível, movimento reduzido).
    const antes = vitrine.rodando();
    const regiao = el.querySelector('[aria-roledescription="carrossel"]')!;
    regiao.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(vitrine.interagindo()).toBeTrue();
    expect(vitrine.rodando()).toBeFalse();
    regiao.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(vitrine.interagindo()).toBeFalse();
    expect(vitrine.rodando()).toBe(antes);
  });

  it('abre os detalhes e seleciona o produto para orçamento', () => {
    responder(PRODUTOS);
    const botoes = Array.from(el.querySelectorAll<HTMLButtonElement>('button'));
    clicar(botoes.find((b) => b.textContent?.includes('Detalhes'))!);
    expect(TestBed.inject(DetalheProdutoService).aberto()?.id).toBe(1);

    clicar(botoes.find((b) => b.textContent?.includes('Orçamento'))!);
    expect(TestBed.inject(SelecaoProdutoService).selecionado()?.id).toBe(1);
  });

  it('não inventa produtos quando o catálogo falha', () => {
    http.expectOne((r) => r.url.endsWith('/api/produtos')).flush(null, { status: 500, statusText: 'Erro' });
    fixture.detectChanges();
    expect(el.querySelector('[aria-roledescription="carrossel"]')).toBeNull();
    expect(el.textContent).toContain('assim que o catálogo estiver disponível');
  });
});

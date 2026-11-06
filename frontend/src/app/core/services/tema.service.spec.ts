import { TestBed } from '@angular/core/testing';

import { CHAVE_TEMA, TemaService } from './tema.service';

type DocumentoComTransicao = Document & { startViewTransition?: unknown };

describe('TemaService', () => {
  const doc = document as DocumentoComTransicao;

  // Uma View Transition real derruba o Chrome headless sem GPU (CI): o processo
  // de renderização fecha e o Karma perde a conexão. Nos testes, a API é sempre
  // substituída (propriedade própria que encobre a do protótipo).
  function definirViewTransition(valor: unknown): void {
    Object.defineProperty(doc, 'startViewTransition', { value: valor, configurable: true, writable: true });
  }

  beforeEach(() => {
    localStorage.removeItem(CHAVE_TEMA);
    definirViewTransition(undefined);
  });
  afterEach(() => {
    delete (doc as { startViewTransition?: unknown }).startViewTransition;
    localStorage.removeItem(CHAVE_TEMA);
    document.documentElement.setAttribute('data-theme', 'light');
  });

  it('respeita a escolha salva e alterna entre claro e escuro', async () => {
    localStorage.setItem(CHAVE_TEMA, 'escuro');
    const tema = TestBed.inject(TemaService);
    expect(tema.tema()).toBe('escuro');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    await tema.alternar();
    expect(tema.tema()).toBe('claro');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('claro');
  });

  it('com View Transitions disponível, aplica o tema dentro da transição', async () => {
    const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const transicao = jasmine.createSpy('startViewTransition').and.callFake((atualizar: () => void) => {
      atualizar();
      return { ready: new Promise<void>(() => undefined) }; // animação nunca começa no teste
    });
    definirViewTransition(transicao);

    localStorage.setItem(CHAVE_TEMA, 'claro');
    const tema = TestBed.inject(TemaService);
    await tema.alternar();

    expect(tema.tema()).toBe('escuro');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('escuro');
    expect(transicao).toHaveBeenCalledTimes(reduzMovimento ? 0 : 1);
  });

  it('sem escolha salva segue a preferência do sistema', () => {
    const prefereEscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const tema = TestBed.inject(TemaService);
    expect(tema.tema()).toBe(prefereEscuro ? 'escuro' : 'claro');
    expect(localStorage.getItem(CHAVE_TEMA)).toBeNull();
  });
});

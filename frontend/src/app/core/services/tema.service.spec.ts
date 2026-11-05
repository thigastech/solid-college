import { TestBed } from '@angular/core/testing';

import { CHAVE_TEMA, TemaService } from './tema.service';

describe('TemaService', () => {
  beforeEach(() => localStorage.removeItem(CHAVE_TEMA));
  afterEach(() => {
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

  it('sem escolha salva segue a preferência do sistema', () => {
    const prefereEscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const tema = TestBed.inject(TemaService);
    expect(tema.tema()).toBe(prefereEscuro ? 'escuro' : 'claro');
    expect(localStorage.getItem(CHAVE_TEMA)).toBeNull();
  });
});

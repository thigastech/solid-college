import { Injectable, computed, signal } from '@angular/core';

const CHAVE = 'solid-admin-token';

/**
 * Guarda o token administrativo só no sessionStorage: some ao fechar a aba
 * e nunca é gravado em localStorage, cookies ou na URL.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly _token = signal<string | null>(this.ler());
  readonly token = this._token.asReadonly();
  readonly autenticado = computed(() => this._token() !== null);

  entrar(token: string): void {
    this._token.set(token);
    try {
      sessionStorage.setItem(CHAVE, token);
    } catch {
      /* armazenamento indisponível: vale só enquanto a página estiver aberta */
    }
  }

  sair(): void {
    this._token.set(null);
    try {
      sessionStorage.removeItem(CHAVE);
    } catch {
      /* nada a limpar */
    }
  }

  private ler(): string | null {
    try {
      return sessionStorage.getItem(CHAVE);
    } catch {
      return null;
    }
  }
}

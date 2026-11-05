import { HttpErrorResponse } from '@angular/common/http';

import { ApiFalha } from '../models/api.model';

export interface ErroApi {
  status: number;
  mensagem: string;
  campos: Record<string, string[]>;
}

function ehApiFalha(corpo: unknown): corpo is ApiFalha {
  return (
    typeof corpo === 'object' &&
    corpo !== null &&
    (corpo as ApiFalha).success === false &&
    typeof (corpo as ApiFalha).message === 'string'
  );
}

/** Converte qualquer falha HTTP em uma mensagem amigável e erros por campo. */
export function interpretarErroApi(erro: unknown): ErroApi {
  if (erro instanceof HttpErrorResponse) {
    if (erro.status === 0) {
      return {
        status: 0,
        mensagem: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
        campos: {},
      };
    }
    if (ehApiFalha(erro.error)) {
      return { status: erro.status, mensagem: erro.error.message, campos: erro.error.errors ?? {} };
    }
    return { status: erro.status, mensagem: 'Ocorreu um erro inesperado. Tente novamente em instantes.', campos: {} };
  }
  return { status: -1, mensagem: 'Ocorreu um erro inesperado. Tente novamente em instantes.', campos: {} };
}

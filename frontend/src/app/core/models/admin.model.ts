import { Demanda } from './contato.model';

export interface ProdutoResumo {
  id: number;
  nome: string;
  status: 'ativo' | 'inativo';
}

/** Contato completo, disponível apenas na área administrativa autenticada. */
export interface ContatoAdmin {
  id: number;
  nome_cliente: string;
  email_cliente: string;
  telefone: string | null;
  demanda: Demanda;
  assunto: string;
  mensagem: string;
  data_envio: string;
  produto: ProdutoResumo | null;
}

export interface ContatosAdminMeta {
  total: number;
  pagina: number;
  por_pagina: number;
  paginas: number;
  produtos: ProdutoResumo[];
}

export interface FiltroContatosAdmin {
  pagina: number;
  busca?: string;
  produto_id?: number | null;
  demanda?: Demanda | null;
}

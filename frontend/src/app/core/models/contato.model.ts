/** Limites espelhados de backend/app/schemas/contato.py. */
export const LIMITES_CONTATO = {
  nomeMin: 2,
  nomeMax: 100,
  emailMax: 254,
  telefoneMax: 20,
  telefoneDigitosMin: 10,
  telefoneDigitosMax: 13,
  assuntoMin: 3,
  assuntoMax: 120,
  mensagemMin: 10,
  mensagemMax: 2000,
} as const;

/** Tipos de demanda aceitos pelo backend (backend/app/models/contato.py). */
export const DEMANDAS = [
  { valor: 'orcamento_projeto', rotulo: 'Orçamento de projeto' },
  { valor: 'prototipagem', rotulo: 'Prototipagem' },
  { valor: 'producao_lote', rotulo: 'Impressão em lote (larga escala)' },
  { valor: 'modelagem_3d', rotulo: 'Modelagem 3D' },
  { valor: 'peca_catalogo', rotulo: 'Peça do catálogo' },
  { valor: 'reposicao', rotulo: 'Peça de reposição ou adaptação' },
  { valor: 'outro', rotulo: 'Outro assunto' },
] as const;

export type Demanda = (typeof DEMANDAS)[number]['valor'];

export function rotuloDemanda(valor: string): string {
  return DEMANDAS.find((d) => d.valor === valor)?.rotulo ?? valor;
}

export interface ContatoPayload {
  nome_cliente: string;
  email_cliente: string;
  telefone: string | null;
  demanda: Demanda;
  assunto: string;
  mensagem: string;
  produto_id: number | null;
  /** Honeypot anti-spam: deve ir vazio. */
  website: string;
  captcha_token: string;
  captcha_resposta: string;
}

export interface DesafioCaptcha {
  pergunta: string;
  token: string;
}

export interface ContatoCriado {
  id: number;
  data_envio: string;
  demanda: Demanda;
  produto_id: number | null;
}

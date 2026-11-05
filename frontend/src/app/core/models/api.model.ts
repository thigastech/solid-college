/** Contrato de resposta da API Flask (ver README → API REST). */
export interface ApiSucesso<T, M = undefined> {
  success: true;
  data: T;
  message?: string;
  meta?: M;
}

export interface ApiFalha {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

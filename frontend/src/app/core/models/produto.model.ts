export interface EspecificacaoItem {
  rotulo: string;
  valor: string;
}

export interface Produto {
  id: number;
  nome: string;
  descricao: string | null;
  especificacao_tecnica: EspecificacaoItem[];
  imagem_url: string | null;
  categoria: string | null;
}

export interface ProdutosMeta {
  total: number;
  categorias: string[];
}

export interface Catalogo {
  produtos: Produto[];
  categorias: string[];
}

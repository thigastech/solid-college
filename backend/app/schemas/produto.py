from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

TextoCurto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class EspecificacaoItem(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    rotulo: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    valor: TextoCurto


class ProdutoOut(BaseModel):
    """Representação pública: não expõe status nem relacionamentos internos."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    descricao: str | None
    especificacao_tecnica: list[EspecificacaoItem]
    imagem_url: str | None
    categoria: str | None


class ProdutoFiltro(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    categoria: Annotated[str | None, Field(default=None, max_length=80)] = None
    busca: Annotated[str | None, Field(default=None, max_length=100)] = None


class ProdutoSeed(BaseModel):
    """Valida os registros do arquivo de dados demonstrativos antes da gravação."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    nome: TextoCurto
    descricao: str | None = None
    especificacao_tecnica: list[EspecificacaoItem] = Field(default_factory=list)
    imagem_url: Annotated[str | None, Field(default=None, max_length=500)] = None
    categoria: Annotated[str | None, Field(default=None, max_length=80)] = None
    status: Literal["ativo", "inativo"] = "ativo"

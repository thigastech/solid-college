from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.schemas.contato import Demanda

POR_PAGINA_PADRAO = 20
POR_PAGINA_MAX = 100


class ContatoAdminFiltro(BaseModel):
    """Parâmetros de GET /api/admin/contatos (query string)."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    pagina: Annotated[int, Field(ge=1, le=100_000)] = 1
    por_pagina: Annotated[int, Field(ge=1, le=POR_PAGINA_MAX)] = POR_PAGINA_PADRAO
    busca: Annotated[str | None, Field(max_length=100)] = None
    produto_id: Annotated[int | None, Field(gt=0)] = None
    demanda: Demanda | None = None


class ProdutoResumo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    status: str


class ContatoAdminOut(BaseModel):
    """Contato completo: exposto SOMENTE na área administrativa autenticada."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nome_cliente: str
    email_cliente: str
    telefone: str | None
    demanda: str
    assunto: str
    mensagem: str
    data_envio: datetime
    produto: ProdutoResumo | None

    @field_serializer("data_envio")
    def _em_utc(self, valor: datetime) -> str:
        if valor.tzinfo is None:
            valor = valor.replace(tzinfo=timezone.utc)
        return valor.isoformat()

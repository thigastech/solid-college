from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Literal

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr, field_serializer, field_validator
from pydantic_core import PydanticCustomError

from app.models.contato import DEMANDAS

# Limites compartilhados com o frontend (frontend/src/app/core/models/contato.model.ts).
NOME_MIN, NOME_MAX = 2, 100
EMAIL_MAX = 254
TELEFONE_MAX_ENTRADA = 20
TELEFONE_DIGITOS_MIN, TELEFONE_DIGITOS_MAX = 10, 13
ASSUNTO_MIN, ASSUNTO_MAX = 3, 120
MENSAGEM_MIN, MENSAGEM_MAX = 10, 2000

Demanda = Literal[DEMANDAS]  # type: ignore[valid-type]


class ContatoCreate(BaseModel):
    """Payload aceito em POST /api/contatos.

    Tipos estritos: o cliente precisa enviar strings e inteiros reais em JSON;
    campos desconhecidos são rejeitados.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    nome_cliente: Annotated[StrictStr, Field(min_length=NOME_MIN, max_length=NOME_MAX)]
    email_cliente: Annotated[StrictStr, Field(min_length=1, max_length=EMAIL_MAX)]
    telefone: StrictStr | None = None
    demanda: Demanda
    assunto: Annotated[StrictStr, Field(min_length=ASSUNTO_MIN, max_length=ASSUNTO_MAX)]
    mensagem: Annotated[StrictStr, Field(min_length=MENSAGEM_MIN, max_length=MENSAGEM_MAX)]
    produto_id: Annotated[StrictInt | None, Field(gt=0)] = None

    @field_validator("email_cliente")
    @classmethod
    def _validar_email(cls, valor: str) -> str:
        try:
            resultado = validate_email(valor, check_deliverability=False)
        except EmailNotValidError:
            raise PydanticCustomError("email_invalido", "Informe um e-mail válido.") from None
        return resultado.normalized

    @field_validator("telefone")
    @classmethod
    def _validar_telefone(cls, valor: str | None) -> str | None:
        """Guarda só os dígitos; vazio equivale a não informado."""
        if not valor:
            return None
        digitos = "".join(c for c in valor if c.isdigit())
        if (
            len(valor) > TELEFONE_MAX_ENTRADA
            or not all(c.isdigit() or c in "+()- " for c in valor)
            or not TELEFONE_DIGITOS_MIN <= len(digitos) <= TELEFONE_DIGITOS_MAX
        ):
            raise PydanticCustomError("telefone_invalido", "Informe um telefone válido com DDD.")
        return digitos


class ContatoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    data_envio: datetime
    demanda: str
    produto_id: int | None

    @field_serializer("data_envio")
    def _em_utc(self, valor: datetime) -> str:
        # O SQLite não guarda fuso horário; o valor é sempre gravado em UTC.
        if valor.tzinfo is None:
            valor = valor.replace(tzinfo=timezone.utc)
        return valor.isoformat()

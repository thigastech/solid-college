from __future__ import annotations

import enum
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, CheckConstraint, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db

if TYPE_CHECKING:
    from app.models.contato import Contato


class StatusProduto(str, enum.Enum):
    ATIVO = "ativo"
    INATIVO = "inativo"


class Produto(db.Model):
    __tablename__ = "produto"
    __table_args__ = (
        CheckConstraint("status IN ('ativo', 'inativo')", name="ck_produto_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text)
    # Lista de pares {"rotulo": str, "valor": str}, validada por ProdutoSeed/EspecificacaoItem.
    especificacao_tecnica: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    imagem_url: Mapped[str | None] = mapped_column(String(500))
    categoria: Mapped[str | None] = mapped_column(String(80), index=True)
    status: Mapped[str] = mapped_column(
        String(10), nullable=False, default=StatusProduto.ATIVO.value, index=True
    )

    contatos: Mapped[list["Contato"]] = relationship(back_populates="produto", passive_deletes=True)

    def __repr__(self) -> str:
        return f"<Produto id={self.id} status={self.status}>"

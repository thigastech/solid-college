from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db

if TYPE_CHECKING:
    from app.models.produto import Produto


# Tipo de demanda escolhido no formulário. Rótulos de exibição ficam no frontend
# (frontend/src/app/core/models/contato.model.ts).
DEMANDAS = (
    "orcamento_projeto",
    "prototipagem",
    "producao_lote",
    "modelagem_3d",
    "peca_catalogo",
    "reposicao",
    "outro",
)
DEMANDA_PADRAO = "outro"


def _agora_utc() -> datetime:
    return datetime.now(timezone.utc)


class Contato(db.Model):
    __tablename__ = "contato"
    __table_args__ = (
        CheckConstraint(
            "demanda IN (" + ", ".join(f"'{d}'" for d in DEMANDAS) + ")",
            name="ck_contato_demanda",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome_cliente: Mapped[str] = mapped_column(String(100), nullable=False)
    email_cliente: Mapped[str] = mapped_column(String(254), nullable=False)
    telefone: Mapped[str | None] = mapped_column(String(13), nullable=True)
    demanda: Mapped[str] = mapped_column(
        String(30), nullable=False, default=DEMANDA_PADRAO, server_default=DEMANDA_PADRAO, index=True
    )
    assunto: Mapped[str] = mapped_column(String(120), nullable=False)
    mensagem: Mapped[str] = mapped_column(Text, nullable=False)
    # Registrada pelo servidor (UTC); nunca aceita do cliente.
    data_envio: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_agora_utc)
    # RESTRICT: um produto com contatos não pode ser excluído; deve ser desativado.
    produto_id: Mapped[int | None] = mapped_column(
        ForeignKey("produto.id", ondelete="RESTRICT"), nullable=True, index=True
    )

    produto: Mapped["Produto | None"] = relationship(back_populates="contatos")

    def __repr__(self) -> str:
        return f"<Contato id={self.id} demanda={self.demanda} produto_id={self.produto_id}>"

from __future__ import annotations

import unicodedata

from sqlalchemy import func, or_, select

from app.extensions import db
from app.models import Produto, StatusProduto
from app.schemas import ProdutoFiltro


def escapar_like(texto: str) -> str:
    return texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def normalizar(texto: str | None) -> str | None:
    """Remove acentos e converte para minúsculas ("Organização" -> "organizacao")."""
    if texto is None:
        return None
    decomposto = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in decomposto if not unicodedata.combining(c)).casefold()


def padrao_busca(texto: str) -> str:
    """Padrão LIKE (com escape) já normalizado, para comparar com func.normalizar(coluna)."""
    return f"%{escapar_like(normalizar(texto))}%"


def contem(coluna, padrao: str):
    return func.normalizar(coluna).like(padrao, escape="\\")


def listar_ativos(filtro: ProdutoFiltro) -> list[Produto]:
    consulta = select(Produto).where(Produto.status == StatusProduto.ATIVO.value)

    if filtro.categoria:
        consulta = consulta.where(func.lower(Produto.categoria) == filtro.categoria.lower())

    if filtro.busca:
        padrao = padrao_busca(filtro.busca)
        consulta = consulta.where(
            or_(
                contem(Produto.nome, padrao),
                contem(Produto.descricao, padrao),
            )
        )

    consulta = consulta.order_by(Produto.categoria, Produto.nome)
    return list(db.session.scalars(consulta))


def listar_categorias_ativas() -> list[str]:
    consulta = (
        select(Produto.categoria)
        .where(Produto.status == StatusProduto.ATIVO.value, Produto.categoria.is_not(None))
        .distinct()
        .order_by(Produto.categoria)
    )
    return [c for c in db.session.scalars(consulta) if c]


def obter_ativo(produto_id: int) -> Produto | None:
    consulta = select(Produto).where(
        Produto.id == produto_id, Produto.status == StatusProduto.ATIVO.value
    )
    return db.session.scalars(consulta).first()

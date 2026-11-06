from __future__ import annotations

from math import ceil

from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import Contato, Produto
from app.schemas.admin import ContatoAdminFiltro
from app.services.produto_service import contem, padrao_busca


def listar_contatos(filtro: ContatoAdminFiltro) -> tuple[list[Contato], dict[str, int]]:
    """Contatos mais recentes primeiro, com paginação e busca por nome, e-mail ou assunto."""
    condicoes = []
    if filtro.busca:
        padrao = padrao_busca(filtro.busca)
        condicoes.append(
            or_(
                contem(Contato.nome_cliente, padrao),
                contem(Contato.email_cliente, padrao),
                contem(Contato.assunto, padrao),
            )
        )
    if filtro.produto_id:
        condicoes.append(Contato.produto_id == filtro.produto_id)
    if filtro.demanda:
        condicoes.append(Contato.demanda == filtro.demanda)

    total = db.session.scalar(select(func.count(Contato.id)).where(*condicoes)) or 0
    consulta = (
        select(Contato)
        .where(*condicoes)
        .options(joinedload(Contato.produto))
        .order_by(Contato.data_envio.desc(), Contato.id.desc())
        .limit(filtro.por_pagina)
        .offset((filtro.pagina - 1) * filtro.por_pagina)
    )
    contatos = list(db.session.scalars(consulta))
    meta = {
        "total": total,
        "pagina": filtro.pagina,
        "por_pagina": filtro.por_pagina,
        "paginas": max(1, ceil(total / filtro.por_pagina)),
    }
    return contatos, meta


def listar_produtos_com_contatos() -> list[Produto]:
    """Produtos (ativos ou não) que têm ao menos um contato, para o filtro da listagem."""
    consulta = (
        select(Produto)
        .where(Produto.id.in_(select(Contato.produto_id).where(Contato.produto_id.is_not(None))))
        .order_by(Produto.nome)
    )
    return list(db.session.scalars(consulta))

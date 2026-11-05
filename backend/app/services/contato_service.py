from __future__ import annotations

import logging

from sqlalchemy.exc import SQLAlchemyError

from app.errors import ApiError
from app.extensions import db
from app.models import Contato
from app.schemas import ContatoCreate
from app.services.produto_service import obter_ativo

logger = logging.getLogger(__name__)


def criar_contato(dados: ContatoCreate) -> Contato:
    """Grava o contato e só retorna depois do commit confirmado."""
    if dados.produto_id is not None and obter_ativo(dados.produto_id) is None:
        raise ApiError(
            422,
            "Verifique os campos enviados.",
            {"produto_id": ["O produto selecionado não está disponível."]},
        )

    contato = Contato(
        nome_cliente=dados.nome_cliente,
        email_cliente=dados.email_cliente,
        telefone=dados.telefone,
        demanda=dados.demanda,
        assunto=dados.assunto,
        mensagem=dados.mensagem,
        produto_id=dados.produto_id,
    )
    try:
        db.session.add(contato)
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        # Sem dados pessoais no log: apenas o tipo do erro.
        logger.error("Falha ao gravar contato: %s", type(exc).__name__)
        raise ApiError(500, "Não foi possível registrar sua mensagem agora. Tente novamente em instantes.") from None

    logger.info(
        "Contato registrado id=%s demanda=%s produto_id=%s", contato.id, contato.demanda, contato.produto_id
    )
    return contato

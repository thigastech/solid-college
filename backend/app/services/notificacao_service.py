"""Notificação por e-mail (SMTP) de novos contatos.

Desligada por padrão (NOTIFICACAO_ATIVA=0). O envio é "melhor esforço": qualquer
falha é registrada no log e nunca interrompe o registro do contato.
"""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from flask import current_app

from app.models import Contato

logger = logging.getLogger(__name__)


def _configurado(cfg) -> bool:
    return bool(cfg["NOTIFICACAO_ATIVA"] and cfg["SMTP_HOST"] and cfg["NOTIFICACAO_DESTINO"])


def montar_mensagem(contato: Contato, remetente: str, destino: list[str]) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = f"Novo contato: {contato.assunto}"
    msg["From"] = remetente
    msg["To"] = ", ".join(destino)
    msg["Reply-To"] = contato.email_cliente
    msg.set_content(
        "\n".join(
            [
                f"Nome: {contato.nome_cliente}",
                f"E-mail: {contato.email_cliente}",
                f"Telefone: {contato.telefone or '-'}",
                f"Demanda: {contato.demanda}",
                f"Produto: {contato.produto_id or '-'}",
                f"Assunto: {contato.assunto}",
                "",
                contato.mensagem,
            ]
        )
    )
    return msg


def notificar_novo_contato(contato: Contato) -> bool:
    """Envia o aviso. Retorna True se enviou; False se desligado ou se falhou."""
    cfg = current_app.config
    if not _configurado(cfg):
        return False

    remetente = cfg["SMTP_REMETENTE"] or cfg["SMTP_USUARIO"] or cfg["NOTIFICACAO_DESTINO"][0]
    msg = montar_mensagem(contato, remetente, cfg["NOTIFICACAO_DESTINO"])
    try:
        classe = smtplib.SMTP_SSL if cfg["SMTP_SSL"] else smtplib.SMTP
        with classe(cfg["SMTP_HOST"], cfg["SMTP_PORTA"], timeout=cfg["SMTP_TIMEOUT"]) as smtp:
            if cfg["SMTP_STARTTLS"] and not cfg["SMTP_SSL"]:
                smtp.starttls()
            if cfg["SMTP_USUARIO"]:
                smtp.login(cfg["SMTP_USUARIO"], cfg["SMTP_SENHA"])
            smtp.send_message(msg)
    except Exception as exc:  # noqa: BLE001 - nenhuma falha de envio pode derrubar a requisição
        logger.warning("Falha ao notificar contato id=%s: %s", contato.id, type(exc).__name__)
        return False

    logger.info("Notificação enviada para contato id=%s", contato.id)
    return True

"""Área administrativa somente leitura: consulta de contatos recebidos.

Autenticação por token compartilhado (ADMIN_TOKEN) no cabeçalho
"Authorization: Bearer <token>". Sem token configurado, a área fica desativada.
"""
from __future__ import annotations

import hmac
import logging
from functools import wraps

from flask import Blueprint, current_app, request

from app.errors import ApiError
from app.schemas.admin import ContatoAdminFiltro, ContatoAdminOut, ProdutoResumo
from app.services import admin_service
from app.services.rate_limit import limitador_admin

logger = logging.getLogger(__name__)

bp = Blueprint("admin", __name__, url_prefix="/admin")

TOKEN_TAMANHO_MINIMO = 32


def _token_configurado() -> str | None:
    token = current_app.config.get("ADMIN_TOKEN") or ""
    return token if len(token) >= TOKEN_TAMANHO_MINIMO else None


def exigir_admin(view):
    @wraps(view)
    def _envoltorio(*args, **kwargs):
        esperado = _token_configurado()
        if esperado is None:
            raise ApiError(503, "Área administrativa não configurada.")

        cfg = current_app.config
        ip = request.remote_addr or "desconhecido"
        cabecalho = request.headers.get("Authorization", "")
        esquema, _, recebido = cabecalho.partition(" ")
        valido = esquema.lower() == "bearer" and hmac.compare_digest(
            recebido.strip().encode(), esperado.encode()
        )
        if not valido:
            # Só tentativas inválidas contam para o limite.
            if not limitador_admin.permitir(ip, cfg["ADMIN_FALHAS_LIMITE"], cfg["ADMIN_FALHAS_JANELA"]):
                logger.warning("Acesso administrativo bloqueado por excesso de tentativas")
                raise ApiError(429, "Muitas tentativas inválidas. Aguarde alguns minutos.")
            logger.warning("Tentativa de acesso administrativo com token inválido")
            raise ApiError(401, "Token de acesso inválido.")
        return view(*args, **kwargs)

    return _envoltorio


@bp.get("/contatos")
@exigir_admin
def listar_contatos():
    filtro = ContatoAdminFiltro.model_validate(request.args.to_dict())
    contatos, meta = admin_service.listar_contatos(filtro)
    produtos = admin_service.listar_produtos_com_contatos()
    # Registra apenas a consulta, nunca o conteúdo dos contatos.
    logger.info("Consulta administrativa de contatos (pagina=%s, total=%s)", meta["pagina"], meta["total"])
    return {
        "success": True,
        "data": [ContatoAdminOut.model_validate(c).model_dump(mode="json") for c in contatos],
        "meta": {
            **meta,
            "produtos": [ProdutoResumo.model_validate(p).model_dump() for p in produtos],
        },
    }

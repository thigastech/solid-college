"""Contrato único de respostas de erro e tradução dos erros do Pydantic.

Formato de erro:
    {"success": false, "message": str, "errors": {campo: [mensagens]}}
"errors" só aparece quando há erros por campo.
"""
from __future__ import annotations

import logging
from typing import Any

from flask import Flask, jsonify
from pydantic import ValidationError
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(self, status: int, message: str, errors: dict[str, list[str]] | None = None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.errors = errors


MENSAGENS_HTTP = {
    400: "Requisição inválida.",
    401: "Acesso não autorizado.",
    404: "Recurso não encontrado.",
    405: "Método não permitido para este endereço.",
    413: "O conteúdo enviado é grande demais.",
    415: "Envie os dados no formato JSON (Content-Type: application/json).",
    429: "Muitas solicitações em pouco tempo. Aguarde alguns minutos e tente novamente.",
    500: "Erro interno. Tente novamente mais tarde.",
}


def erro_json(status: int, message: str, errors: dict[str, list[str]] | None = None):
    corpo: dict[str, Any] = {"success": False, "message": message}
    if errors:
        corpo["errors"] = errors
    return jsonify(corpo), status


def _mensagem_pydantic(erro: dict[str, Any]) -> str:
    tipo = erro.get("type", "")
    ctx = erro.get("ctx") or {}
    if tipo == "missing":
        return "Campo obrigatório."
    if tipo == "string_too_short":
        minimo = ctx.get("min_length", 1)
        return "Campo obrigatório." if minimo <= 1 else f"Informe ao menos {minimo} caracteres."
    if tipo == "string_too_long":
        return f"Use no máximo {ctx.get('max_length')} caracteres."
    if tipo == "string_type":
        return "Deve ser um texto."
    if tipo in {"int_type", "int_parsing"}:
        return "Deve ser um número inteiro."
    if tipo == "greater_than":
        return "Valor inválido."
    if tipo == "literal_error":
        return "Selecione uma opção válida."
    if tipo == "extra_forbidden":
        return "Campo não permitido."
    if tipo == "email_invalido":
        return erro.get("msg", "Informe um e-mail válido.")
    if tipo == "telefone_invalido":
        return erro.get("msg", "Informe um telefone válido com DDD.")
    return "Valor inválido."


def erros_por_campo(exc: ValidationError) -> dict[str, list[str]]:
    resultado: dict[str, list[str]] = {}
    for erro in exc.errors():
        loc = erro.get("loc") or ("_",)
        campo = str(loc[0])
        resultado.setdefault(campo, []).append(_mensagem_pydantic(erro))
    return resultado


def registrar_handlers(app: Flask) -> None:
    @app.errorhandler(ApiError)
    def _api_error(exc: ApiError):
        return erro_json(exc.status, exc.message, exc.errors)

    @app.errorhandler(ValidationError)
    def _validation_error(exc: ValidationError):
        return erro_json(422, "Verifique os campos enviados.", erros_por_campo(exc))

    @app.errorhandler(HTTPException)
    def _http_error(exc: HTTPException):
        status = exc.code or 500
        return erro_json(status, MENSAGENS_HTTP.get(status, exc.name or "Erro na requisição."))

    @app.errorhandler(Exception)
    def _erro_inesperado(exc: Exception):
        # Detalhes vão apenas para o log do servidor, nunca para o cliente.
        logger.exception("Erro não tratado: %s", type(exc).__name__)
        return erro_json(500, MENSAGENS_HTTP[500])

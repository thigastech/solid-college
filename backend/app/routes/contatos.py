from flask import Blueprint, current_app, jsonify, request

from app.errors import ApiError
from app.schemas import ContatoCreate, ContatoOut
from app.services import captcha_service, contato_service
from app.services.rate_limit import limitador_contatos

bp = Blueprint("contatos", __name__, url_prefix="/contatos")

# Campo invisível no formulário: pessoas não o preenchem, robôs costumam preencher.
CAMPO_HONEYPOT = "website"


@bp.get("/captcha")
def captcha():
    resposta = jsonify({"success": True, "data": captcha_service.gerar_desafio()})
    resposta.headers["Cache-Control"] = "no-store"
    return resposta


@bp.post("")
def criar():
    if not request.is_json:
        raise ApiError(415, "Envie os dados no formato JSON (Content-Type: application/json).")

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise ApiError(400, "JSON inválido ou malformado.")

    if payload.pop(CAMPO_HONEYPOT, None):
        raise ApiError(400, "Não foi possível processar o envio.")

    cfg = current_app.config
    if not limitador_contatos.permitir(
        request.remote_addr or "desconhecido", cfg["CONTATO_RATE_LIMIT"], cfg["CONTATO_RATE_WINDOW"]
    ):
        raise ApiError(429, "Muitas mensagens em pouco tempo. Aguarde alguns minutos e tente novamente.")

    token_captcha = payload.pop("captcha_token", None)
    resposta_captcha = payload.pop("captcha_resposta", None)
    # Validar os campos antes evita gastar o desafio em um envio já inválido.
    dados = ContatoCreate.model_validate(payload)
    if cfg["CAPTCHA_ATIVO"] and not captcha_service.validar(token_captcha, resposta_captcha):
        raise ApiError(
            422,
            "Verifique os campos enviados.",
            {"captcha_resposta": ["Resposta incorreta ou expirada. Responda à nova pergunta."]},
        )
    contato = contato_service.criar_contato(dados)
    return {
        "success": True,
        "message": "Mensagem recebida. Retornaremos pelo e-mail informado.",
        "data": ContatoOut.model_validate(contato).model_dump(mode="json"),
    }, 201

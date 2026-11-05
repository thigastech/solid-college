import re
import time

import pytest

from app.models import Contato


@pytest.fixture()
def com_captcha(app):
    app.config["CAPTCHA_ATIVO"] = True


def desafio(client):
    resp = client.get("/api/contatos/captcha")
    assert resp.status_code == 200
    assert resp.headers["Cache-Control"] == "no-store"
    dados = resp.get_json()["data"]
    a, b = map(int, re.findall(r"\d+", dados["pergunta"]))
    return dados["token"], str(a + b)


def enviar(client, contato, token, resposta):
    return client.post("/api/contatos", json={**contato, "captcha_token": token, "captcha_resposta": resposta})


def erro_captcha(resp):
    assert resp.status_code == 422
    return resp.get_json()["errors"]["captcha_resposta"]


def test_token_nao_expoe_a_resposta(client, com_captcha):
    token, resposta = desafio(client)
    assert token.split(".")[2] != resposta
    assert len(token.split(".")[2]) == 64


def test_resposta_correta_grava_o_contato(client, com_captcha, contato_valido):
    token, resposta = desafio(client)
    assert enviar(client, contato_valido, token, f" {resposta} ").status_code == 201
    assert Contato.query.count() == 1


def test_sem_captcha_nao_grava(client, com_captcha, contato_valido):
    assert erro_captcha(client.post("/api/contatos", json=contato_valido))
    assert Contato.query.count() == 0


def test_resposta_errada_gasta_o_desafio(client, com_captcha, contato_valido):
    token, resposta = desafio(client)
    assert erro_captcha(enviar(client, contato_valido, token, str(int(resposta) + 1)))
    assert erro_captcha(enviar(client, contato_valido, token, resposta))
    assert Contato.query.count() == 0


def test_desafio_nao_pode_ser_reutilizado(client, com_captcha, contato_valido):
    token, resposta = desafio(client)
    assert enviar(client, contato_valido, token, resposta).status_code == 201
    assert erro_captcha(enviar(client, contato_valido, token, resposta))
    assert Contato.query.count() == 1


def test_desafio_expirado(app, client, com_captcha, contato_valido):
    app.config["CAPTCHA_VALIDADE"] = -1
    token, resposta = desafio(client)
    assert erro_captcha(enviar(client, contato_valido, token, resposta))


@pytest.mark.parametrize("token", ["", "abc", "1.2.3", f"{int(time.time()) + 60}.x.ç", f"{int(time.time()) + 60}.x.{'0' * 64}", 123, None])
def test_token_invalido_ou_forjado(client, com_captcha, contato_valido, token):
    assert erro_captcha(enviar(client, contato_valido, token, "5"))


def test_campo_invalido_nao_gasta_o_desafio(client, com_captcha, contato_valido):
    token, resposta = desafio(client)
    assert enviar(client, {**contato_valido, "mensagem": "curta"}, token, resposta).status_code == 422
    assert enviar(client, contato_valido, token, resposta).status_code == 201

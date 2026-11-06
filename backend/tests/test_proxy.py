import pytest

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.services.rate_limit import limitador_contatos


def _app(proxies):
    return create_app(TestConfig, {"TRUSTED_PROXIES": proxies, "CONTATO_RATE_LIMIT": 1})


@pytest.fixture()
def contexto():
    apps = []

    def criar(proxies):
        app = _app(proxies)
        ctx = app.app_context()
        ctx.push()
        db.create_all()
        apps.append(ctx)
        return app.test_client()

    yield criar
    for ctx in apps:
        db.session.remove()
        db.drop_all()
        ctx.pop()
    limitador_contatos.limpar()


def _enviar(client, contato, ip):
    return client.post("/api/contatos", json=contato, headers={"X-Forwarded-For": ip}).status_code


def test_com_proxy_confiavel_limite_e_por_ip_real(contexto, contato_valido):
    client = contexto(1)
    assert _enviar(client, contato_valido, "203.0.113.1") == 201
    assert _enviar(client, contato_valido, "203.0.113.2") == 201
    assert _enviar(client, contato_valido, "203.0.113.1") == 429


def test_proxy_fix_usa_ip_informado_pelo_proxy(contexto):
    client = contexto(1)
    app = client.application

    @app.get("/_ip")
    def _ip():
        from flask import request

        return request.remote_addr or ""

    resp = client.get("/_ip", headers={"X-Forwarded-For": "198.51.100.7"})
    assert resp.get_data(as_text=True) == "198.51.100.7"


def test_sem_proxy_ignora_x_forwarded_for(contexto, contato_valido):
    client = contexto(0)
    assert _enviar(client, contato_valido, "203.0.113.1") == 201
    # Trocar o cabeçalho não burla o limite: vale o IP da conexão.
    assert _enviar(client, contato_valido, "203.0.113.2") == 429

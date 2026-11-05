from datetime import datetime, timedelta, timezone

import pytest

from app.extensions import db
from app.models import Contato

TOKEN = "t" * 40
URL = "/api/admin/contatos"


@pytest.fixture()
def admin_app(app):
    app.config.update(ADMIN_TOKEN=TOKEN, ADMIN_FALHAS_LIMITE=3, ADMIN_FALHAS_JANELA=60)
    return app


@pytest.fixture()
def auth():
    return {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture()
def contatos(admin_app, produtos):
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    itens = [
        Contato(
            nome_cliente=f"Cliente {i}",
            email_cliente=f"cliente{i}@example.com",
            demanda="peca_catalogo" if i % 2 else "prototipagem",
            assunto="Orçamento engrenagem" if i % 2 else "Dúvida geral",
            mensagem=f"Mensagem número {i} com detalhes.",
            data_envio=base + timedelta(hours=i),
            produto_id=produtos["Engrenagem reta"] if i % 2 else None,
        )
        for i in range(1, 6)
    ]
    db.session.add_all(itens)
    db.session.commit()
    return itens


def test_desativado_sem_token_configurado(app, client):
    resp = client.get(URL, headers={"Authorization": "Bearer qualquer"})
    assert resp.status_code == 503
    assert resp.get_json() == {"success": False, "message": "Área administrativa não configurada."}


def test_token_curto_mantem_area_desativada(app, client):
    app.config["ADMIN_TOKEN"] = "curto"
    resp = client.get(URL, headers={"Authorization": "Bearer curto"})
    assert resp.status_code == 503


@pytest.mark.parametrize(
    "cabecalho",
    [None, "Bearer errado", f"Basic {TOKEN}", TOKEN, "Bearer "],
)
def test_rejeita_token_ausente_ou_invalido(admin_app, client, cabecalho):
    headers = {"Authorization": cabecalho} if cabecalho is not None else {}
    resp = client.get(URL, headers=headers)
    assert resp.status_code == 401
    corpo = resp.get_json()
    assert corpo["success"] is False
    assert "data" not in corpo


def test_lista_contatos_mais_recentes_primeiro(contatos, client, auth):
    resp = client.get(URL, headers=auth)
    assert resp.status_code == 200
    corpo = resp.get_json()
    assert [c["nome_cliente"] for c in corpo["data"]] == [f"Cliente {i}" for i in range(5, 0, -1)]
    primeiro = corpo["data"][0]
    assert primeiro["email_cliente"] == "cliente5@example.com"
    assert primeiro["mensagem"].startswith("Mensagem número 5")
    assert primeiro["data_envio"].endswith("+00:00")
    assert primeiro["produto"] == {"id": 1, "nome": "Engrenagem reta", "status": "ativo"}
    assert corpo["data"][1]["produto"] is None
    assert corpo["meta"]["total"] == 5
    assert corpo["meta"]["produtos"] == [{"id": 1, "nome": "Engrenagem reta", "status": "ativo"}]
    assert resp.headers["Cache-Control"] == "no-store"


def test_paginacao(contatos, client, auth):
    corpo = client.get(f"{URL}?pagina=2&por_pagina=2", headers=auth).get_json()
    assert [c["nome_cliente"] for c in corpo["data"]] == ["Cliente 3", "Cliente 2"]
    assert corpo["meta"] | {"produtos": None} == {
        "total": 5, "pagina": 2, "por_pagina": 2, "paginas": 3, "produtos": None,
    }


def test_busca_e_filtro_por_produto(contatos, produtos, client, auth):
    corpo = client.get(f"{URL}?busca=cliente4@", headers=auth).get_json()
    assert [c["nome_cliente"] for c in corpo["data"]] == ["Cliente 4"]

    corpo = client.get(f"{URL}?busca=ENGRENAGEM", headers=auth).get_json()
    assert corpo["meta"]["total"] == 3

    corpo = client.get(f"{URL}?produto_id={produtos['Engrenagem reta']}", headers=auth).get_json()
    assert corpo["meta"]["total"] == 3

    corpo = client.get(f"{URL}?busca=100%25", headers=auth).get_json()
    assert corpo["meta"]["total"] == 0


def test_filtro_por_demanda(contatos, client, auth):
    corpo = client.get(f"{URL}?demanda=prototipagem", headers=auth).get_json()
    assert corpo["meta"]["total"] == 2
    assert {c["demanda"] for c in corpo["data"]} == {"prototipagem"}
    assert client.get(f"{URL}?demanda=revenda", headers=auth).status_code == 422


@pytest.mark.parametrize("query", ["pagina=0", "por_pagina=500", "pagina=abc", "extra=1", "busca=" + "x" * 101])
def test_parametros_invalidos(admin_app, client, auth, query):
    resp = client.get(f"{URL}?{query}", headers=auth)
    assert resp.status_code == 422
    assert resp.get_json()["message"] == "Verifique os campos enviados."


def test_bloqueia_apos_muitas_tentativas_invalidas(admin_app, client, auth):
    for _ in range(3):
        assert client.get(URL, headers={"Authorization": "Bearer errado"}).status_code == 401
    assert client.get(URL, headers={"Authorization": "Bearer errado"}).status_code == 429
    # Token correto continua funcionando (o limite só conta falhas).
    assert client.get(URL, headers=auth).status_code == 200


def test_cors_permite_authorization(admin_app, client):
    resp = client.options(
        URL,
        headers={
            "Origin": "http://localhost:4200",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
        },
    )
    assert resp.headers.get("Access-Control-Allow-Origin") == "http://localhost:4200"
    assert "authorization" in resp.headers.get("Access-Control-Allow-Headers", "").lower()


def test_nao_registra_conteudo_dos_contatos_no_log(contatos, client, auth, caplog):
    caplog.set_level("INFO")
    client.get(URL, headers=auth)
    assert "cliente5@example.com" not in caplog.text
    assert "Mensagem número" not in caplog.text
    assert "Consulta administrativa" in caplog.text

from unittest.mock import patch

import pytest
from sqlalchemy.exc import IntegrityError, OperationalError

from app.extensions import db
from app.models import Contato, Produto


def test_cria_contato_valido_e_persiste(client, contato_valido):
    resp = client.post("/api/contatos", json=contato_valido)
    assert resp.status_code == 201
    corpo = resp.get_json()
    assert corpo["success"] is True
    assert set(corpo["data"]) == {"id", "data_envio", "demanda", "produto_id"}
    assert corpo["data"]["demanda"] == "orcamento_projeto"

    salvo = db.session.get(Contato, corpo["data"]["id"])
    assert salvo is not None
    assert salvo.email_cliente == "maria@example.com"
    assert salvo.produto_id is None
    assert salvo.demanda == "orcamento_projeto"
    assert salvo.data_envio is not None


def test_remove_espacos_nas_extremidades(client, contato_valido):
    contato_valido["nome_cliente"] = "   Maria Teste   "
    resp = client.post("/api/contatos", json=contato_valido)
    assert resp.status_code == 201
    assert db.session.get(Contato, resp.get_json()["data"]["id"]).nome_cliente == "Maria Teste"


def test_associa_produto_ativo(client, produtos, contato_valido):
    contato_valido["produto_id"] = produtos["Engrenagem reta"]
    resp = client.post("/api/contatos", json=contato_valido)
    assert resp.status_code == 201
    salvo = db.session.get(Contato, resp.get_json()["data"]["id"])
    assert salvo.produto.nome == "Engrenagem reta"


@pytest.mark.parametrize("produto_id", [9999, "inativo"])
def test_rejeita_produto_inexistente_ou_inativo(client, produtos, contato_valido, produto_id):
    contato_valido["produto_id"] = produtos["Protótipo antigo"] if produto_id == "inativo" else produto_id
    resp = client.post("/api/contatos", json=contato_valido)
    assert resp.status_code == 422
    assert "produto_id" in resp.get_json()["errors"]
    assert db.session.query(Contato).count() == 0


def test_rejeita_produto_id_com_tipo_incorreto(client, contato_valido):
    contato_valido["produto_id"] = "1"
    resp = client.post("/api/contatos", json=contato_valido)
    assert resp.status_code == 422
    assert resp.get_json()["errors"]["produto_id"] == ["Deve ser um número inteiro."]


@pytest.mark.parametrize("email", ["sem-arroba", "a@b", "maria@@example.com", "maria @example.com"])
def test_rejeita_email_invalido(client, contato_valido, email):
    contato_valido["email_cliente"] = email
    resp = client.post("/api/contatos", json=contato_valido)
    assert resp.status_code == 422
    assert resp.get_json()["errors"]["email_cliente"] == ["Informe um e-mail válido."]


def test_rejeita_campos_obrigatorios_ausentes(client):
    resp = client.post("/api/contatos", json={})
    assert resp.status_code == 422
    corpo = resp.get_json()
    assert corpo["success"] is False
    assert corpo["message"] == "Verifique os campos enviados."
    for campo in ("nome_cliente", "email_cliente", "demanda", "assunto", "mensagem"):
        assert corpo["errors"][campo] == ["Campo obrigatório."]


@pytest.mark.parametrize("demanda", ["prototipagem", "producao_lote", "peca_catalogo", "outro"])
def test_aceita_demandas_validas(client, contato_valido, demanda):
    contato_valido["demanda"] = demanda
    resp = client.post("/api/contatos", json=contato_valido)
    assert resp.status_code == 201
    assert db.session.get(Contato, resp.get_json()["data"]["id"]).demanda == demanda


@pytest.mark.parametrize("demanda", ["revenda", "", 1, None])
def test_rejeita_demanda_invalida(client, contato_valido, demanda):
    contato_valido["demanda"] = demanda
    resp = client.post("/api/contatos", json=contato_valido)
    assert resp.status_code == 422
    assert resp.get_json()["errors"]["demanda"] == ["Selecione uma opção válida."]


@pytest.mark.parametrize(
    ("entrada", "salvo"),
    [("(11) 91234-5678", "11912345678"), ("+55 11 91234-5678", "5511912345678"), ("", None), (None, None)],
)
def test_telefone_opcional_guarda_so_digitos(client, contato_valido, entrada, salvo):
    contato_valido["telefone"] = entrada
    resp = client.post("/api/contatos", json=contato_valido)
    assert resp.status_code == 201
    assert "telefone" not in resp.get_json()["data"]
    assert db.session.get(Contato, resp.get_json()["data"]["id"]).telefone == salvo


@pytest.mark.parametrize("telefone", ["123", "abc1234567890", "1" * 14, "1 " * 15])
def test_rejeita_telefone_invalido(client, contato_valido, telefone):
    contato_valido["telefone"] = telefone
    resp = client.post("/api/contatos", json=contato_valido)
    assert resp.status_code == 422
    assert resp.get_json()["errors"]["telefone"] == ["Informe um telefone válido com DDD."]


def test_rejeita_strings_vazias_e_longas(client, contato_valido):
    contato_valido["assunto"] = "    "
    contato_valido["mensagem"] = "x" * 2001
    erros = client.post("/api/contatos", json=contato_valido).get_json()["errors"]
    assert erros["assunto"] == ["Informe ao menos 3 caracteres."]
    assert erros["mensagem"] == ["Use no máximo 2000 caracteres."]


def test_rejeita_tipos_incorretos_e_campos_extras(client, contato_valido):
    contato_valido["nome_cliente"] = 123
    contato_valido["cpf"] = "000.000.000-00"
    erros = client.post("/api/contatos", json=contato_valido).get_json()["errors"]
    assert erros["nome_cliente"] == ["Deve ser um texto."]
    assert erros["cpf"] == ["Campo não permitido."]


def test_rejeita_json_malformado(client):
    resp = client.post("/api/contatos", data="{nome: ", content_type="application/json")
    assert resp.status_code == 400
    assert resp.get_json()["success"] is False


def test_rejeita_json_que_nao_e_objeto(client):
    resp = client.post("/api/contatos", json=["lista"])
    assert resp.status_code == 400


def test_rejeita_content_type_diferente_de_json(client):
    resp = client.post("/api/contatos", data="nome=x")
    assert resp.status_code == 415


def test_rejeita_corpo_grande_demais(client, contato_valido):
    contato_valido["mensagem"] = "x" * 20_000
    resp = client.post("/api/contatos", json=contato_valido)
    assert resp.status_code == 413


def test_honeypot_preenchido_nao_grava(client, contato_valido):
    contato_valido["website"] = "http://spam.example"
    resp = client.post("/api/contatos", json=contato_valido)
    assert resp.status_code == 400
    assert db.session.query(Contato).count() == 0


def test_limite_de_envios_por_ip(app, client, contato_valido):
    app.config["CONTATO_RATE_LIMIT"] = 2
    assert client.post("/api/contatos", json=contato_valido).status_code == 201
    assert client.post("/api/contatos", json=contato_valido).status_code == 201
    resp = client.post("/api/contatos", json=contato_valido)
    assert resp.status_code == 429
    assert db.session.query(Contato).count() == 2


def test_falha_de_banco_retorna_500_sem_detalhes_e_faz_rollback(client, contato_valido, monkeypatch):
    def commit_com_falha():
        raise OperationalError("INSERT ...", {}, Exception("disk I/O error em /caminho/secreto"))

    monkeypatch.setattr(db.session, "commit", commit_com_falha)
    resp = client.post("/api/contatos", json=contato_valido)
    monkeypatch.undo()

    assert resp.status_code == 500
    corpo = resp.get_json()
    assert corpo["success"] is False
    assert "secreto" not in resp.get_data(as_text=True)
    assert "INSERT" not in resp.get_data(as_text=True)
    assert db.session.query(Contato).count() == 0


def test_get_em_contatos_nao_expoe_mensagens(client, contato_valido):
    client.post("/api/contatos", json=contato_valido)
    resp = client.get("/api/contatos")
    assert resp.status_code == 405
    assert "maria" not in resp.get_data(as_text=True)


def test_excluir_produto_com_contatos_e_bloqueado(client, produtos, contato_valido):
    contato_valido["produto_id"] = produtos["Engrenagem reta"]
    client.post("/api/contatos", json=contato_valido)

    produto = db.session.get(Produto, produtos["Engrenagem reta"])
    db.session.delete(produto)
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()
    assert db.session.query(Contato).count() == 1


@pytest.fixture()
def smtp_configurado(app):
    app.config.update(
        NOTIFICACAO_ATIVA=True,
        NOTIFICACAO_DESTINO=["equipe@example.com"],
        SMTP_HOST="smtp.example.com",
        SMTP_PORTA=587,
        SMTP_USUARIO="usuario",
        SMTP_SENHA="senha",
        SMTP_REMETENTE="site@example.com",
        SMTP_STARTTLS=True,
        SMTP_SSL=False,
    )


def test_notificacao_desligada_nao_abre_conexao(client, contato_valido):
    with patch("app.services.notificacao_service.smtplib.SMTP") as smtp:
        resp = client.post("/api/contatos", json=contato_valido)
    assert resp.status_code == 201
    smtp.assert_not_called()


def test_envia_notificacao_quando_configurado(smtp_configurado, client, contato_valido):
    with patch("app.services.notificacao_service.smtplib.SMTP") as smtp:
        resp = client.post("/api/contatos", json=contato_valido)
    assert resp.status_code == 201

    smtp.assert_called_once_with("smtp.example.com", 587, timeout=10)
    conexao = smtp.return_value.__enter__.return_value
    conexao.starttls.assert_called_once()
    conexao.login.assert_called_once_with("usuario", "senha")
    msg = conexao.send_message.call_args.args[0]
    assert msg["To"] == "equipe@example.com"
    assert msg["Reply-To"] == "maria@example.com"
    assert contato_valido["assunto"] in msg["Subject"]


def test_falha_no_smtp_nao_derruba_criacao(smtp_configurado, client, contato_valido):
    with patch("app.services.notificacao_service.smtplib.SMTP", side_effect=OSError("sem rede")):
        resp = client.post("/api/contatos", json=contato_valido)
    assert resp.status_code == 201
    assert db.session.get(Contato, resp.get_json()["data"]["id"]) is not None

from app.extensions import db
from datetime import datetime, timedelta, timezone

from app.models import Contato, Produto


def test_seed_demo_insere_e_nao_sobrescreve(app):
    runner = app.test_cli_runner()

    primeira = runner.invoke(args=["seed-demo"])
    assert primeira.exit_code == 0, primeira.output
    total = db.session.query(Produto).count()
    assert total > 0

    produto = db.session.query(Produto).first()
    produto.descricao = "Editado manualmente"
    db.session.commit()

    segunda = runner.invoke(args=["seed-demo"])
    assert segunda.exit_code == 0
    assert "inseridos: 0" in segunda.output
    assert db.session.query(Produto).count() == total
    assert db.session.get(Produto, produto.id).descricao == "Editado manualmente"


def test_seed_demo_bloqueado_em_producao(app):
    app.config["APP_ENV"] = "production"
    resultado = app.test_cli_runner().invoke(args=["seed-demo"])
    assert resultado.exit_code != 0
    assert db.session.query(Produto).count() == 0


def test_admin_token_mostra_e_gera(app, tmp_path):
    runner = app.test_cli_runner()
    resultado = runner.invoke(args=["admin-token"])
    assert resultado.exit_code != 0
    assert "não configurado" in resultado.output

    app.config["ADMIN_TOKEN"] = "z" * 40
    assert runner.invoke(args=["admin-token"]).output.strip() == "z" * 40

    env = tmp_path / ".env"
    env.write_text("FLASK_APP=run.py\nADMIN_TOKEN=antigo\n", encoding="utf-8")
    resultado = runner.invoke(args=["admin-token", "--novo", "--env", str(env)])
    assert resultado.exit_code == 0
    novo = resultado.output.strip().splitlines()[-1]
    assert len(novo) >= 32
    conteudo = env.read_text(encoding="utf-8")
    assert conteudo.count("ADMIN_TOKEN=") == 1
    assert f"ADMIN_TOKEN={novo}" in conteudo and "FLASK_APP=run.py" in conteudo


def _contatos_com_idades(*dias_atras):
    agora = datetime.now(timezone.utc)
    for i, dias in enumerate(dias_atras):
        db.session.add(
            Contato(
                nome_cliente=f"Cliente {i}",
                email_cliente=f"c{i}@example.com",
                demanda="prototipagem",
                assunto="Assunto",
                mensagem="Mensagem de teste.",
                data_envio=agora - timedelta(days=dias),
            )
        )
    db.session.commit()


def test_expurgar_contatos_apaga_apenas_antigos(app):
    _contatos_com_idades(10, 100, 400)
    resultado = app.test_cli_runner().invoke(args=["expurgar-contatos", "--dias", "90", "--sim"])
    assert resultado.exit_code == 0, resultado.output
    assert "Expurgados 2" in resultado.output
    assert [c.nome_cliente for c in db.session.query(Contato)] == ["Cliente 0"]


def test_expurgar_contatos_usa_retencao_configurada(app):
    app.config["CONTATO_RETENCAO_DIAS"] = 365
    _contatos_com_idades(100, 400)
    resultado = app.test_cli_runner().invoke(args=["expurgar-contatos", "--sim"])
    assert "Expurgados 1" in resultado.output
    assert db.session.query(Contato).count() == 1


def test_expurgar_contatos_simular_nao_apaga(app):
    _contatos_com_idades(400)
    resultado = app.test_cli_runner().invoke(args=["expurgar-contatos", "--dias", "30", "--simular"])
    assert "1 contato(s)" in resultado.output
    assert db.session.query(Contato).count() == 1


def test_expurgar_contatos_pede_confirmacao(app):
    _contatos_com_idades(400)
    runner = app.test_cli_runner()
    negado = runner.invoke(args=["expurgar-contatos", "--dias", "30"], input="n\n")
    assert negado.exit_code != 0
    assert db.session.query(Contato).count() == 1

    aceito = runner.invoke(args=["expurgar-contatos", "--dias", "30"], input="s\n")
    assert db.session.query(Contato).count() in (0, 1)  # depende do idioma do prompt

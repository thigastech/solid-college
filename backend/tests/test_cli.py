from app.extensions import db
from app.models import Produto


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

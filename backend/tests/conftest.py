import pytest

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.models import Produto
from app.services.captcha_service import nonces_usados
from app.services.rate_limit import limitador_admin, limitador_contatos


@pytest.fixture()
def app():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()
    limitador_contatos.limpar()
    limitador_admin.limpar()
    nonces_usados.limpar()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def produtos(app):
    itens = [
        Produto(
            nome="Engrenagem reta",
            descricao="Engrenagem para mecanismos leves",
            categoria="Componentes mecânicos",
            especificacao_tecnica=[{"rotulo": "Processo", "valor": "FDM"}],
            imagem_url="/static/produtos/engrenagem.svg",
            status="ativo",
        ),
        Produto(
            nome="Vaso torcido",
            descricao="Peça decorativa com camadas aparentes",
            categoria="Decoração",
            especificacao_tecnica=[],
            status="ativo",
        ),
        Produto(
            nome="Protótipo antigo",
            descricao="Engrenagem descontinuada",
            categoria="Componentes mecânicos",
            especificacao_tecnica=[],
            status="inativo",
        ),
    ]
    db.session.add_all(itens)
    db.session.commit()
    return {p.nome: p.id for p in itens}


@pytest.fixture()
def contato_valido():
    return {
        "nome_cliente": "Maria Teste",
        "email_cliente": "maria@example.com",
        "demanda": "orcamento_projeto",
        "assunto": "Orçamento de peça",
        "mensagem": "Gostaria de um orçamento para 10 unidades.",
    }

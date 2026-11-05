def test_lista_apenas_produtos_ativos(client, produtos):
    resp = client.get("/api/produtos")
    assert resp.status_code == 200
    corpo = resp.get_json()
    assert corpo["success"] is True
    nomes = {p["nome"] for p in corpo["data"]}
    assert nomes == {"Engrenagem reta", "Vaso torcido"}
    assert corpo["meta"]["total"] == 2
    assert corpo["meta"]["categorias"] == ["Componentes mecânicos", "Decoração"]


def test_resposta_nao_expoe_campos_internos(client, produtos):
    item = client.get("/api/produtos").get_json()["data"][0]
    assert set(item) == {"id", "nome", "descricao", "especificacao_tecnica", "imagem_url", "categoria"}


def test_filtro_por_categoria(client, produtos):
    corpo = client.get("/api/produtos", query_string={"categoria": "decoração"}).get_json()
    assert [p["nome"] for p in corpo["data"]] == ["Vaso torcido"]


def test_busca_por_nome_e_descricao(client, produtos):
    por_nome = client.get("/api/produtos", query_string={"busca": "engrenagem"}).get_json()
    # "Protótipo antigo" também cita engrenagem, mas está inativo.
    assert [p["nome"] for p in por_nome["data"]] == ["Engrenagem reta"]

    por_descricao = client.get("/api/produtos", query_string={"busca": "camadas"}).get_json()
    assert [p["nome"] for p in por_descricao["data"]] == ["Vaso torcido"]


def test_busca_sem_resultado_retorna_lista_vazia(client, produtos):
    corpo = client.get("/api/produtos", query_string={"busca": "inexistente%_"}).get_json()
    assert corpo["success"] is True
    assert corpo["data"] == []
    assert corpo["meta"]["total"] == 0


def test_busca_muito_longa_e_rejeitada(client, produtos):
    resp = client.get("/api/produtos", query_string={"busca": "x" * 101})
    assert resp.status_code == 422
    assert "busca" in resp.get_json()["errors"]


def test_detalhe_de_produto_ativo(client, produtos):
    resp = client.get(f"/api/produtos/{produtos['Engrenagem reta']}")
    assert resp.status_code == 200
    assert resp.get_json()["data"]["especificacao_tecnica"] == [{"rotulo": "Processo", "valor": "FDM"}]


def test_detalhe_de_produto_inexistente_retorna_404(client, produtos):
    resp = client.get("/api/produtos/9999")
    assert resp.status_code == 404
    assert resp.get_json() == {"success": False, "message": "Produto não encontrado."}


def test_detalhe_de_produto_inativo_retorna_404(client, produtos):
    resp = client.get(f"/api/produtos/{produtos['Protótipo antigo']}")
    assert resp.status_code == 404


def test_rota_desconhecida_usa_contrato_de_erro(client):
    resp = client.get("/api/nao-existe")
    assert resp.status_code == 404
    assert resp.get_json()["success"] is False


def test_cors_restrito_a_origem_configurada(client, produtos):
    permitido = client.get("/api/produtos", headers={"Origin": "http://localhost:4200"})
    assert permitido.headers.get("Access-Control-Allow-Origin") == "http://localhost:4200"

    negado = client.get("/api/produtos", headers={"Origin": "https://site-malicioso.example"})
    assert "Access-Control-Allow-Origin" not in negado.headers

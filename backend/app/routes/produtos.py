from flask import Blueprint, request

from app.errors import ApiError
from app.schemas import ProdutoFiltro, ProdutoOut
from app.services import produto_service

bp = Blueprint("produtos", __name__, url_prefix="/produtos")


@bp.get("")
def listar():
    filtro = ProdutoFiltro.model_validate(request.args.to_dict())
    produtos = produto_service.listar_ativos(filtro)
    return {
        "success": True,
        "data": [ProdutoOut.model_validate(p).model_dump() for p in produtos],
        "meta": {
            "total": len(produtos),
            "categorias": produto_service.listar_categorias_ativas(),
        },
    }


@bp.get("/<int:produto_id>")
def detalhar(produto_id: int):
    produto = produto_service.obter_ativo(produto_id)
    if produto is None:
        raise ApiError(404, "Produto não encontrado.")
    return {"success": True, "data": ProdutoOut.model_validate(produto).model_dump()}

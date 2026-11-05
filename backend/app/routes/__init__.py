from flask import Blueprint

from app.routes.admin import bp as admin_bp
from app.routes.contatos import bp as contatos_bp
from app.routes.produtos import bp as produtos_bp

api_bp = Blueprint("api", __name__, url_prefix="/api")
api_bp.register_blueprint(produtos_bp)
api_bp.register_blueprint(contatos_bp)
api_bp.register_blueprint(admin_bp)


@api_bp.get("/health")
def health():
    return {"success": True, "data": {"status": "ok"}}

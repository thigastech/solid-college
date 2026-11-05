from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from flask import Flask

load_dotenv()

from app.config import Config  # noqa: E402  (precisa do .env carregado)
from app.errors import registrar_handlers  # noqa: E402
from app.extensions import cors, db, migrate  # noqa: E402

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


def create_app(config_object: type[Config] = Config, overrides: dict[str, Any] | None = None) -> Flask:
    app = Flask(__name__, instance_relative_config=False)
    app.config.from_object(config_object)
    if overrides:
        app.config.update(overrides)
    # Mantém a ordem dos campos e os acentos legíveis nas respostas JSON.
    app.json.sort_keys = False
    app.json.ensure_ascii = False

    logging.basicConfig(
        level=app.config["LOG_LEVEL"],
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    uri: str = app.config["SQLALCHEMY_DATABASE_URI"]
    if uri.startswith("sqlite:///"):
        Path(uri.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db, directory=str(MIGRATIONS_DIR), render_as_batch=True)
    # CORS restrito: apenas /api/* e apenas para as origens configuradas.
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        supports_credentials=False,
        max_age=600,
    )

    from app import models  # noqa: F401  (registra os modelos no metadata)
    from app.cli import registrar_comandos
    from app.routes import api_bp

    app.register_blueprint(api_bp)
    registrar_handlers(app)
    registrar_comandos(app)

    @app.after_request
    def _cabecalhos_seguranca(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        if response.mimetype == "application/json":
            response.headers.setdefault("Cache-Control", "no-store")
        return response

    return app

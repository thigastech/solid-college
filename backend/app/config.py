"""Configuração da aplicação, lida a partir de variáveis de ambiente.

Nenhum valor sensível fica no código. Valores padrão servem apenas ao
desenvolvimento local.
"""
from __future__ import annotations

import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BASE_DIR / "instance" / "catalogo.db"


def _csv(value: str | None, default: str) -> list[str]:
    raw = value if value else default
    return [item.strip() for item in raw.split(",") if item.strip()]


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


class Config:
    APP_ENV = os.getenv("APP_ENV", "development")
    TESTING = False

    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH.as_posix()}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Origens autorizadas a chamar /api/* a partir do navegador.
    CORS_ORIGINS = _csv(os.getenv("CORS_ORIGINS"), "http://localhost:4200")

    # Limite do corpo das requisições (bytes). O formulário de contato é pequeno.
    MAX_CONTENT_LENGTH = _int("MAX_CONTENT_LENGTH", 16 * 1024)

    # Proteção básica contra envio abusivo: N contatos por IP dentro da janela (segundos).
    CONTATO_RATE_LIMIT = _int("CONTATO_RATE_LIMIT", 5)
    CONTATO_RATE_WINDOW = _int("CONTATO_RATE_WINDOW", 600)

    # Captcha do formulário de contato. Sem CAPTCHA_SEGREDO, cada processo gera o seu
    # (desafios abertos deixam de valer ao reiniciar).
    CAPTCHA_ATIVO = os.getenv("CAPTCHA_ATIVO", "1").strip().lower() not in {"0", "false", "nao", "não"}
    CAPTCHA_SEGREDO = os.getenv("CAPTCHA_SEGREDO", "").strip() or secrets.token_hex(32)
    CAPTCHA_VALIDADE = _int("CAPTCHA_VALIDADE", 1800)

    # Área administrativa (consulta de contatos). Token longo e aleatório, enviado
    # como "Authorization: Bearer <token>". Vazio ou curto demais = área desativada.
    # Aspas e espaços acidentais no .env são ignorados.
    ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "").strip().strip("\"'").strip()
    # Tentativas de acesso com token inválido por IP dentro da janela (segundos).
    ADMIN_FALHAS_LIMITE = _int("ADMIN_FALHAS_LIMITE", 10)
    ADMIN_FALHAS_JANELA = _int("ADMIN_FALHAS_JANELA", 900)

    # Notificação por e-mail de novos contatos (desligada por padrão).
    NOTIFICACAO_ATIVA = os.getenv("NOTIFICACAO_ATIVA", "0").strip().lower() in {"1", "true", "sim"}
    NOTIFICACAO_DESTINO = _csv(os.getenv("NOTIFICACAO_DESTINO"), "")
    SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
    SMTP_PORTA = _int("SMTP_PORTA", 587)
    SMTP_USUARIO = os.getenv("SMTP_USUARIO", "").strip()
    SMTP_SENHA = os.getenv("SMTP_SENHA", "")
    SMTP_REMETENTE = os.getenv("SMTP_REMETENTE", "").strip()
    SMTP_STARTTLS = os.getenv("SMTP_STARTTLS", "1").strip().lower() in {"1", "true", "sim"}
    SMTP_SSL = os.getenv("SMTP_SSL", "0").strip().lower() in {"1", "true", "sim"}
    SMTP_TIMEOUT = _int("SMTP_TIMEOUT", 10)

    BACKUP_DIR = os.getenv("BACKUP_DIR", str(BASE_DIR / "backups"))
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


class TestConfig(Config):
    TESTING = True
    APP_ENV = "test"
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    CONTATO_RATE_LIMIT = 1000
    CAPTCHA_ATIVO = False
    ADMIN_TOKEN = ""
    NOTIFICACAO_ATIVA = False

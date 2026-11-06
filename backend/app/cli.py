"""Comandos: `flask init-db`, `flask seed-demo`, `flask backup-db`, `flask admin-token`,
`flask expurgar-contatos`."""
from __future__ import annotations

import json
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

import click
from flask import Flask, current_app
from flask_migrate import upgrade
from pydantic import ValidationError
from sqlalchemy import delete, func, select

from app.extensions import db
from app.models import Contato, Produto
from app.schemas import ProdutoSeed

DADOS_DEMO = Path(__file__).resolve().parent.parent / "data" / "produtos_demo.json"
ARQUIVO_ENV = Path(__file__).resolve().parent.parent / ".env"


def _caminho_sqlite() -> Path:
    uri: str = current_app.config["SQLALCHEMY_DATABASE_URI"]
    if not uri.startswith("sqlite:///"):
        raise click.ClickException("Este comando só suporta bancos SQLite em arquivo.")
    return Path(uri.removeprefix("sqlite:///"))


def registrar_comandos(app: Flask) -> None:
    @app.cli.command("init-db")
    def init_db() -> None:
        """Cria ou atualiza o esquema aplicando as migrações (idempotente)."""
        upgrade()
        click.echo("Banco de dados pronto (migrações aplicadas).")

    @app.cli.command("seed-demo")
    @click.option("--arquivo", type=click.Path(exists=True, dir_okay=False, path_type=Path), default=DADOS_DEMO)
    def seed_demo(arquivo: Path) -> None:
        """Insere produtos DEMONSTRATIVOS (fictícios).

        Nunca altera registros existentes: produtos com o mesmo nome são ignorados.
        Bloqueado quando APP_ENV=production.
        """
        if current_app.config["APP_ENV"] == "production":
            raise click.ClickException("seed-demo está bloqueado em produção (APP_ENV=production).")

        bruto = json.loads(arquivo.read_text(encoding="utf-8"))
        try:
            registros = [ProdutoSeed.model_validate(item) for item in bruto["produtos"]]
        except (KeyError, TypeError, ValidationError) as exc:
            raise click.ClickException(f"Arquivo de dados inválido: {exc}") from None

        existentes = set(db.session.scalars(select(Produto.nome)))
        inseridos, ignorados = 0, 0
        for registro in registros:
            if registro.nome in existentes:
                ignorados += 1
                continue
            dados = registro.model_dump()
            db.session.add(Produto(**dados))
            inseridos += 1
        db.session.commit()
        click.echo(f"Produtos demonstrativos inseridos: {inseridos}. Já existentes (não alterados): {ignorados}.")

    @app.cli.command("backup-db")
    def backup_db() -> None:
        """Gera uma cópia consistente do SQLite em BACKUP_DIR usando a API de backup."""
        origem = _caminho_sqlite()
        if not origem.exists():
            raise click.ClickException(f"Banco não encontrado em {origem}.")
        destino_dir = Path(current_app.config["BACKUP_DIR"])
        destino_dir.mkdir(parents=True, exist_ok=True)
        destino = destino_dir / f"catalogo-{datetime.now():%Y%m%d-%H%M%S}.db"
        with sqlite3.connect(origem) as src, sqlite3.connect(destino) as dst:
            src.backup(dst)
        click.echo(f"Backup criado em {destino}")

    @app.cli.command("admin-token")
    @click.option("--novo", is_flag=True, help="Gera um token novo e grava em ADMIN_TOKEN no .env.")
    @click.option("--env", "arquivo_env", type=click.Path(dir_okay=False, path_type=Path), default=ARQUIVO_ENV)
    def admin_token(novo: bool, arquivo_env: Path) -> None:
        """Mostra o token da área administrativa (/admin) ou gera um novo."""
        if novo:
            token = secrets.token_urlsafe(32)
            linhas = arquivo_env.read_text(encoding="utf-8").splitlines() if arquivo_env.exists() else []
            linhas = [linha for linha in linhas if not linha.strip().startswith("ADMIN_TOKEN=")]
            linhas.append(f"ADMIN_TOKEN={token}")
            arquivo_env.write_text("\n".join(linhas) + "\n", encoding="utf-8")
            click.echo(f"Novo token gravado em {arquivo_env}. Reinicie o backend para aplicá-lo.")
            click.echo(token)
            return
        token = current_app.config.get("ADMIN_TOKEN") or ""
        if len(token) < 32:
            raise click.ClickException(
                "ADMIN_TOKEN não configurado (ou com menos de 32 caracteres). Use `flask admin-token --novo`."
            )
        click.echo(token)

    @app.cli.command("expurgar-contatos")
    @click.option("--dias", type=click.IntRange(min=1), default=None,
                  help="Apaga contatos com mais de N dias. Padrão: CONTATO_RETENCAO_DIAS.")
    @click.option("--simular", is_flag=True, help="Só mostra quantos seriam apagados.")
    @click.option("--sim", "confirmado", is_flag=True, help="Não pede confirmação (uso em agendadores).")
    def expurgar_contatos(dias: int | None, simular: bool, confirmado: bool) -> None:
        """Apaga definitivamente contatos antigos (retenção de dados pessoais, LGPD)."""
        dias = dias or current_app.config["CONTATO_RETENCAO_DIAS"]
        # O SQLite guarda a data sem fuso (em UTC); comparamos com um corte também sem fuso.
        corte = (datetime.now(timezone.utc) - timedelta(days=dias)).replace(tzinfo=None)
        filtro = Contato.data_envio < corte

        total = db.session.scalar(select(func.count()).select_from(Contato).where(filtro)) or 0
        descricao = f"{total} contato(s) com mais de {dias} dias (anteriores a {corte:%Y-%m-%d})"
        if simular or total == 0:
            click.echo(f"{descricao} seriam apagados." if simular else "Nenhum contato a expurgar.")
            return
        if not confirmado:
            click.confirm(f"Apagar definitivamente {descricao}?", abort=True)

        db.session.execute(delete(Contato).where(filtro))
        db.session.commit()
        click.echo(f"Expurgados {total} contato(s).")

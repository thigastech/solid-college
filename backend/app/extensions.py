from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)
migrate = Migrate()
cors = CORS()


@event.listens_for(Engine, "connect")
def _habilitar_chaves_estrangeiras(dbapi_connection, _connection_record) -> None:
    """O SQLite só aplica FOREIGN KEY quando o PRAGMA é ligado em cada conexão."""
    import sqlite3

    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

# Backend (Flask 3.0 · Python 3.12)

Instruções completas no [README principal](../README.md) e o contrato da API em [docs/API.md](../docs/API.md).

```bash
py -3.12 -m venv .venv && .venv\Scripts\activate     # Linux/macOS: python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
flask init-db          # aplica as migrações
flask seed-demo        # produtos FICTÍCIOS (não sobrescreve existentes; bloqueado em produção)
python run.py          # http://127.0.0.1:5000
pytest -q              # testes
flask backup-db        # cópia consistente do SQLite em ./backups
```

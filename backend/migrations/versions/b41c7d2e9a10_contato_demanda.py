"""contato: tipo de demanda

Revision ID: b41c7d2e9a10
Revises: 9ea46611d5bd
Create Date: 2026-10-29 10:00:00

Contatos já existentes recebem a demanda "outro".
"""
from alembic import op
import sqlalchemy as sa


revision = 'b41c7d2e9a10'
down_revision = '9ea46611d5bd'
branch_labels = None
depends_on = None

DEMANDAS = (
    'orcamento_projeto', 'prototipagem', 'producao_lote', 'modelagem_3d', 'peca_catalogo', 'reposicao', 'outro',
)


def upgrade():
    with op.batch_alter_table('contato', schema=None) as batch_op:
        batch_op.add_column(sa.Column('demanda', sa.String(length=30), nullable=False, server_default='outro'))
        batch_op.create_index(batch_op.f('ix_contato_demanda'), ['demanda'], unique=False)
        batch_op.create_check_constraint(
            'ck_contato_demanda', 'demanda IN (' + ', '.join(f"'{d}'" for d in DEMANDAS) + ')'
        )


def downgrade():
    with op.batch_alter_table('contato', schema=None) as batch_op:
        batch_op.drop_constraint('ck_contato_demanda', type_='check')
        batch_op.drop_index(batch_op.f('ix_contato_demanda'))
        batch_op.drop_column('demanda')

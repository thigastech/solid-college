"""contato: telefone opcional

Revision ID: c82f1a6e3d57
Revises: b41c7d2e9a10
Create Date: 2026-10-30 10:00:00

"""
from alembic import op
import sqlalchemy as sa


revision = 'c82f1a6e3d57'
down_revision = 'b41c7d2e9a10'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('contato', schema=None) as batch_op:
        batch_op.add_column(sa.Column('telefone', sa.String(length=13), nullable=True))


def downgrade():
    with op.batch_alter_table('contato', schema=None) as batch_op:
        batch_op.drop_column('telefone')

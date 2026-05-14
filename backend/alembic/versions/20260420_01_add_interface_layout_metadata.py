"""add interface layout metadata

Revision ID: 20260420_01
Revises: 20260419_02
Create Date: 2026-04-20
"""

from alembic import op
import sqlalchemy as sa


revision = "20260420_01"
down_revision = "20260419_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("typical_interfaces", sa.Column("side", sa.String(length=20), nullable=True))
    op.add_column(
        "typical_interfaces",
        sa.Column("side_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("instance_interfaces", sa.Column("side", sa.String(length=20), nullable=True))
    op.add_column(
        "instance_interfaces",
        sa.Column("side_order", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("instance_interfaces", "side_order")
    op.drop_column("instance_interfaces", "side")
    op.drop_column("typical_interfaces", "side_order")
    op.drop_column("typical_interfaces", "side")

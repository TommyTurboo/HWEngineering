"""add canvas visibility flags

Revision ID: 20260418_02
Revises: 20260418_01
Create Date: 2026-04-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260418_02"
down_revision: str | None = "20260418_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "parameter_definition_presets",
        sa.Column("show_on_canvas", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "typical_parameter_definitions",
        sa.Column("show_on_canvas", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "instance_parameter_definition_snapshots",
        sa.Column("show_on_canvas", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("instance_parameter_definition_snapshots", "show_on_canvas")
    op.drop_column("typical_parameter_definitions", "show_on_canvas")
    op.drop_column("parameter_definition_presets", "show_on_canvas")

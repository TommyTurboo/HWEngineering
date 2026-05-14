"""add connection instances

Revision ID: 20260419_01
Revises: 20260418_02
Create Date: 2026-04-19
"""

from alembic import op
import sqlalchemy as sa


revision = "20260419_01"
down_revision = "20260418_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "connection_instances",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("project_id", sa.String(length=36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "source_instance_id",
            sa.String(length=36),
            sa.ForeignKey("project_equipment_instances.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_interface_code", sa.String(length=100), nullable=False),
        sa.Column(
            "target_instance_id",
            sa.String(length=36),
            sa.ForeignKey("project_equipment_instances.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("target_interface_code", sa.String(length=100), nullable=False),
        sa.Column("connection_kind", sa.String(length=30), nullable=False, server_default="logical"),
        sa.Column("implementation_kind", sa.String(length=30), nullable=False, server_default="conceptual"),
        sa.Column("label", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_connection_instances_project_id", "connection_instances", ["project_id"])
    op.create_index("ix_connection_instances_source_instance_id", "connection_instances", ["source_instance_id"])
    op.create_index("ix_connection_instances_target_instance_id", "connection_instances", ["target_instance_id"])


def downgrade() -> None:
    op.drop_index("ix_connection_instances_target_instance_id", table_name="connection_instances")
    op.drop_index("ix_connection_instances_source_instance_id", table_name="connection_instances")
    op.drop_index("ix_connection_instances_project_id", table_name="connection_instances")
    op.drop_table("connection_instances")

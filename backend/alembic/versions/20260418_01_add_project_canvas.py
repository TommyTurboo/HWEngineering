"""add project canvas tables

Revision ID: 20260418_01
Revises: 20260329_01
Create Date: 2026-04-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260418_01"
down_revision: str | None = "20260329_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_canvas_nodes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("instance_id", sa.String(length=36), nullable=False),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.Column("width", sa.Float(), nullable=True),
        sa.Column("height", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["instance_id"], ["project_equipment_instances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_project_canvas_nodes_project_id"), "project_canvas_nodes", ["project_id"], unique=False
    )
    op.create_index(
        op.f("ix_project_canvas_nodes_instance_id"), "project_canvas_nodes", ["instance_id"], unique=False
    )

    op.create_table(
        "project_canvas_edges",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("source_instance_id", sa.String(length=36), nullable=False),
        sa.Column("target_instance_id", sa.String(length=36), nullable=False),
        sa.Column("source_handle", sa.String(length=100), nullable=True),
        sa.Column("target_handle", sa.String(length=100), nullable=True),
        sa.Column("label", sa.String(length=255), nullable=True),
        sa.Column("edge_type", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_instance_id"], ["project_equipment_instances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_instance_id"], ["project_equipment_instances.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_project_canvas_edges_project_id"), "project_canvas_edges", ["project_id"], unique=False
    )
    op.create_index(
        op.f("ix_project_canvas_edges_source_instance_id"),
        "project_canvas_edges",
        ["source_instance_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_project_canvas_edges_target_instance_id"),
        "project_canvas_edges",
        ["target_instance_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_project_canvas_edges_target_instance_id"), table_name="project_canvas_edges")
    op.drop_index(op.f("ix_project_canvas_edges_source_instance_id"), table_name="project_canvas_edges")
    op.drop_index(op.f("ix_project_canvas_edges_project_id"), table_name="project_canvas_edges")
    op.drop_table("project_canvas_edges")

    op.drop_index(op.f("ix_project_canvas_nodes_instance_id"), table_name="project_canvas_nodes")
    op.drop_index(op.f("ix_project_canvas_nodes_project_id"), table_name="project_canvas_nodes")
    op.drop_table("project_canvas_nodes")

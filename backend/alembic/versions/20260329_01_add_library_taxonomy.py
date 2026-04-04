"""add library taxonomy

Revision ID: 20260329_01
Revises: None
Create Date: 2026-03-29 13:30:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260329_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "library_nodes" not in existing_tables:
        op.create_table(
            "library_nodes",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("parent_id", sa.String(length=36), nullable=True),
            sa.Column("code", sa.String(length=100), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("node_type", sa.String(length=30), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.ForeignKeyConstraint(["parent_id"], ["library_nodes.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("parent_id", "code", name="uq_library_nodes_parent_code"),
        )

    node_indexes = {index["name"] for index in inspector.get_indexes("library_nodes")}
    if op.f("ix_library_nodes_parent_id") not in node_indexes:
        op.create_index(op.f("ix_library_nodes_parent_id"), "library_nodes", ["parent_id"], unique=False)

    if "typical_library_links" not in existing_tables:
        op.create_table(
            "typical_library_links",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("typical_lineage_id", sa.String(length=36), nullable=False),
            sa.Column("library_node_id", sa.String(length=36), nullable=False),
            sa.Column("is_primary", sa.Integer(), nullable=False, server_default="1"),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.ForeignKeyConstraint(["library_node_id"], ["library_nodes.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "typical_lineage_id", "library_node_id", name="uq_typical_library_links_lineage_node"
            ),
        )

    link_indexes = {index["name"] for index in inspector.get_indexes("typical_library_links")}
    if op.f("ix_typical_library_links_library_node_id") not in link_indexes:
        op.create_index(
            op.f("ix_typical_library_links_library_node_id"),
            "typical_library_links",
            ["library_node_id"],
            unique=False,
        )
    if op.f("ix_typical_library_links_typical_lineage_id") not in link_indexes:
        op.create_index(
            op.f("ix_typical_library_links_typical_lineage_id"),
            "typical_library_links",
            ["typical_lineage_id"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_typical_library_links_typical_lineage_id"), table_name="typical_library_links")
    op.drop_index(op.f("ix_typical_library_links_library_node_id"), table_name="typical_library_links")
    op.drop_table("typical_library_links")
    op.drop_index(op.f("ix_library_nodes_parent_id"), table_name="library_nodes")
    op.drop_table("library_nodes")

"""add cabinet field placement

Revision ID: 20260419_02
Revises: 20260419_01
Create Date: 2026-04-19
"""

from alembic import op
import sqlalchemy as sa


revision = "20260419_02"
down_revision = "20260419_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cabinet_instances",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("parent_cabinet_id", sa.String(length=36), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("tag", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cabinet_kind", sa.String(length=50), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["parent_cabinet_id"], ["cabinet_instances.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cabinet_instances_project_id", "cabinet_instances", ["project_id"])
    op.create_index("ix_cabinet_instances_parent_cabinet_id", "cabinet_instances", ["parent_cabinet_id"])

    op.create_table(
        "field_object_instances",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("parent_field_object_id", sa.String(length=36), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("tag", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("field_object_kind", sa.String(length=50), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["parent_field_object_id"], ["field_object_instances.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_field_object_instances_project_id", "field_object_instances", ["project_id"])
    op.create_index(
        "ix_field_object_instances_parent_field_object_id",
        "field_object_instances",
        ["parent_field_object_id"],
    )

    op.add_column(
        "project_equipment_instances",
        sa.Column("cabinet_instance_id", sa.String(length=36), nullable=True),
    )
    op.add_column(
        "project_equipment_instances",
        sa.Column("field_object_instance_id", sa.String(length=36), nullable=True),
    )
    op.create_foreign_key(
        "fk_project_equipment_instances_cabinet_instance_id",
        "project_equipment_instances",
        "cabinet_instances",
        ["cabinet_instance_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_project_equipment_instances_field_object_instance_id",
        "project_equipment_instances",
        "field_object_instances",
        ["field_object_instance_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_project_equipment_instances_cabinet_instance_id",
        "project_equipment_instances",
        ["cabinet_instance_id"],
    )
    op.create_index(
        "ix_project_equipment_instances_field_object_instance_id",
        "project_equipment_instances",
        ["field_object_instance_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_project_equipment_instances_field_object_instance_id", table_name="project_equipment_instances")
    op.drop_index("ix_project_equipment_instances_cabinet_instance_id", table_name="project_equipment_instances")
    op.drop_constraint(
        "fk_project_equipment_instances_field_object_instance_id",
        "project_equipment_instances",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_project_equipment_instances_cabinet_instance_id",
        "project_equipment_instances",
        type_="foreignkey",
    )
    op.drop_column("project_equipment_instances", "field_object_instance_id")
    op.drop_column("project_equipment_instances", "cabinet_instance_id")

    op.drop_index("ix_field_object_instances_parent_field_object_id", table_name="field_object_instances")
    op.drop_index("ix_field_object_instances_project_id", table_name="field_object_instances")
    op.drop_table("field_object_instances")

    op.drop_index("ix_cabinet_instances_parent_cabinet_id", table_name="cabinet_instances")
    op.drop_index("ix_cabinet_instances_project_id", table_name="cabinet_instances")
    op.drop_table("cabinet_instances")

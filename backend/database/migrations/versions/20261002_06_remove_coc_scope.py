"""remove obsolete COC academic scope

Revision ID: 20261002_06
Revises: 20261002_05
Create Date: 2026-10-02
"""

from alembic import op
import sqlalchemy as sa


revision = "20261002_06"
down_revision = "20261002_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # COC belonged to the retired academic-data model. Existing rows are
    # retained as university-scoped courses rather than being deleted.
    op.execute(
        sa.text(
            "UPDATE courses SET academic_scope = 'UNIVERSITY' "
            "WHERE academic_scope = 'COC'"
        )
    )

    bind = op.get_bind()
    check_names = {item["name"] for item in sa.inspect(bind).get_check_constraints("courses")}
    with op.batch_alter_table("courses") as batch_op:
        if "ck_courses_academic_scope" in check_names:
            batch_op.drop_constraint("ck_courses_academic_scope", type_="check")
        batch_op.create_check_constraint(
            "ck_courses_academic_scope",
            "academic_scope IN ('UNIVERSITY', 'FRESHMAN')",
        )


def downgrade() -> None:
    with op.batch_alter_table("courses") as batch_op:
        batch_op.drop_constraint("ck_courses_academic_scope", type_="check")
        batch_op.create_check_constraint(
            "ck_courses_academic_scope",
            "academic_scope IN ('UNIVERSITY', 'FRESHMAN', 'COC')",
        )

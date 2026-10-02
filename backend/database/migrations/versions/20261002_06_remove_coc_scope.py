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

    # Replace the old scope constraint if it exists. The IF EXISTS form keeps
    # this migration compatible with databases created before the constraint
    # was introduced at the ORM level.
    op.execute(
        "ALTER TABLE courses "
        "DROP CONSTRAINT IF EXISTS ck_courses_academic_scope"
    )
    op.create_check_constraint(
        "ck_courses_academic_scope",
        "courses",
        "academic_scope IN ('UNIVERSITY', 'FRESHMAN')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_courses_academic_scope",
        "courses",
        type_="check",
    )
    op.create_check_constraint(
        "ck_courses_academic_scope",
        "courses",
        "academic_scope IN ('UNIVERSITY', 'FRESHMAN', 'COC')",
    )

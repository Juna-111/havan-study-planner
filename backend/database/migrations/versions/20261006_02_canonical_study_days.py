"""Canonicalize legacy student study days.

Revision ID: 20261006_02
Revises: 20261006_01
"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa

revision = "20261006_02"
down_revision = "20261006_01"
branch_labels = None
depends_on = None

WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
ALIASES = {
    "mon": "mon", "monday": "mon",
    "tue": "tue", "tuesday": "tue",
    "wed": "wed", "wednesday": "wed",
    "thu": "thu", "thursday": "thu",
    "fri": "fri", "friday": "fri",
    "sat": "sat", "saturday": "sat",
    "sun": "sun", "sunday": "sun",
}

def canonicalize(values):
    if not values:
        return []
    result = set()
    for value in values:
        if isinstance(value, bool):
            continue
        if isinstance(value, int) and 0 <= value <= 6:
            result.add(WEEKDAYS[(value - 1) % 7])
        elif isinstance(value, str):
            text = value.strip().lower()
            if text.isdigit() and 0 <= int(text) <= 6:
                result.add(WEEKDAYS[(int(text) - 1) % 7])
            elif text in ALIASES:
                result.add(ALIASES[text])
    return [day for day in WEEKDAYS if day in result]

def upgrade():
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, study_days FROM student_profiles")).mappings().all()
    for row in rows:
        raw = row["study_days"]
        if raw is None:
            values = []
        elif isinstance(raw, str):
            try:
                values = json.loads(raw)
            except json.JSONDecodeError:
                values = []
        else:
            values = raw
        normalized = canonicalize(values)
        bind.execute(
            sa.text("UPDATE student_profiles SET study_days = :days WHERE id = :id"),
            {"id": row["id"], "days": json.dumps(normalized)},
        )

def downgrade():
    # Canonical weekday names are intentionally not converted back. The old
    # Sunday=0 convention was ambiguous and is no longer a valid API format.
    pass

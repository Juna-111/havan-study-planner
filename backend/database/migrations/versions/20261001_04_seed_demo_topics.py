"""seed simple demo topics for existing chapters

Revision ID: 20261001_04
Revises: 20261001_03
Create Date: 2026-10-01
"""

from alembic import op
import sqlalchemy as sa

revision = "20261001_04"
down_revision = "20261001_03"
branch_labels = None
depends_on = None


DEMO_TOPICS = (
    ("Introduction and Key Ideas", 3, 45, 0.60, 0.75),
    ("Core Concepts and Methods", 3, 60, 0.75, 0.85),
    ("Examples and Practice", 2, 45, 0.65, 0.70),
)


def upgrade() -> None:
    bind = op.get_bind()

    chapters = bind.execute(
        sa.text(
            """
            SELECT id
            FROM chapters
            WHERE NOT EXISTS (
                SELECT 1
                FROM topics
                WHERE topics.chapter_id = chapters.id
            )
            ORDER BY id
            """
        )
    ).fetchall()

    if not chapters:
        return

    insert_topic = sa.text(
        """
        INSERT INTO topics (
            chapter_id,
            name,
            difficulty,
            estimated_study_minutes,
            exam_importance,
            conceptual_importance,
            order_index,
            status
        )
        VALUES (
            :chapter_id,
            :name,
            :difficulty,
            :minutes,
            :exam_importance,
            :conceptual_importance,
            :order_index,
            'ACTIVE'
        )
        """
    )

    for chapter in chapters:
        for order_index, (name, difficulty, minutes, exam_importance, conceptual_importance) in enumerate(
            DEMO_TOPICS, start=1
        ):
            bind.execute(
                insert_topic,
                {
                    "chapter_id": chapter.id,
                    "name": name,
                    "difficulty": difficulty,
                    "minutes": minutes,
                    "exam_importance": exam_importance,
                    "conceptual_importance": conceptual_importance,
                    "order_index": order_index,
                },
            )


def downgrade() -> None:
    bind = op.get_bind()
    names = [topic[0] for topic in DEMO_TOPICS]
    bind.execute(
        sa.text(
            """
            DELETE FROM topics
            WHERE name IN (:name1, :name2, :name3)
            """
        ),
        {
            "name1": names[0],
            "name2": names[1],
            "name3": names[2],
        },
    )

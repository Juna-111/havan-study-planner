"""Add generic chapter/topic Havan promotions.
Revision ID: 20261006_07
Revises: 20261006_06
"""
from alembic import op
import sqlalchemy as sa
revision="20261006_07"; down_revision="20261006_06"; branch_labels=None; depends_on=None
def upgrade():
 b=op.get_bind()
 if sa.inspect(b).has_table("havan_promotions"): return
 op.create_table("havan_promotions",sa.Column("id",sa.Integer(),primary_key=True),sa.Column("chapter_id",sa.Integer(),sa.ForeignKey("chapters.id",ondelete="CASCADE")),sa.Column("topic_id",sa.Integer(),sa.ForeignKey("topics.id",ondelete="CASCADE")),sa.Column("platform_name",sa.String(100),nullable=False),sa.Column("description",sa.Text()),sa.Column("button_text",sa.String(100),nullable=False),sa.Column("url",sa.Text(),nullable=False),sa.Column("order_index",sa.Integer(),nullable=False,server_default="1"),sa.Column("status",sa.String(20),nullable=False,server_default="ACTIVE"),sa.CheckConstraint("(chapter_id IS NOT NULL AND topic_id IS NULL) OR (chapter_id IS NULL AND topic_id IS NOT NULL)",name="ck_havan_promotions_one_parent"))
 op.create_index("ix_havan_promotions_chapter_id","havan_promotions",["chapter_id"]); op.create_index("ix_havan_promotions_topic_id","havan_promotions",["topic_id"])
def downgrade():
 b=op.get_bind()
 if sa.inspect(b).has_table("havan_promotions"): op.drop_table("havan_promotions")

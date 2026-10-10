"""Replace curricula with direct university-owned streams."""

from alembic import op
import sqlalchemy as sa


revision = "20261009_03"
down_revision = "20261009_02"
branch_labels = None
depends_on = None

FK_NAMING = {"fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"}


def _drop_curriculum_fk(table: str) -> None:
    inspector = sa.inspect(op.get_bind())
    for fk in inspector.get_foreign_keys(table):
        if "curriculum_id" in (fk.get("constrained_columns") or []):
            name = fk.get("name") or f"fk_{table}_curriculum_id_curriculums"
            with op.batch_alter_table(table, naming_convention=FK_NAMING) as batch:
                batch.drop_constraint(name, type_="foreignkey")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Streams inherit their university from the curriculum they previously belonged to.
    with op.batch_alter_table("streams", naming_convention=FK_NAMING) as batch:
        batch.add_column(sa.Column("university_id", sa.Integer(), nullable=True))
    op.execute(sa.text(
        "UPDATE streams SET university_id = (SELECT university_id FROM curriculums "
        "WHERE curriculums.id = streams.curriculum_id)"
    ))
    with op.batch_alter_table("streams", naming_convention=FK_NAMING) as batch:
        batch.alter_column("university_id", existing_type=sa.Integer(), nullable=False)
        batch.create_foreign_key("fk_streams_university_id_universities", "universities", ["university_id"], ["id"], ondelete="CASCADE")
        batch.drop_constraint("uq_streams_curriculum_code", type_="unique")
        batch.create_unique_constraint("uq_streams_university_code", ["university_id", "code"])
        batch.drop_index("ix_streams_curriculum_id")
        batch.create_index("ix_streams_university_id", ["university_id"])
    _drop_curriculum_fk("streams")
    with op.batch_alter_table("streams", naming_convention=FK_NAMING) as batch:
        batch.drop_column("curriculum_id")

    # Profiles already carry university_id; align it to the chosen stream before removing the old link.
    op.execute(sa.text(
        "UPDATE student_profiles SET university_id = (SELECT university_id FROM streams "
        "WHERE streams.id = student_profiles.stream_id)"
    ))
    _drop_curriculum_fk("student_profiles")
    with op.batch_alter_table("student_profiles", naming_convention=FK_NAMING) as batch:
        batch.drop_column("curriculum_id")

    # Both offering tables retain their stream/course assignments and lose only redundant curriculum links.
    for table, index in (
        ("university_course_mappings", "ix_university_course_mapping_curriculum"),
        ("university_course_offerings", "ix_university_course_offering_curriculum"),
    ):
        if inspector.has_table(table):
            with op.batch_alter_table(table, naming_convention=FK_NAMING) as batch:
                batch.drop_index(index)
            _drop_curriculum_fk(table)
            with op.batch_alter_table(table, naming_convention=FK_NAMING) as batch:
                batch.drop_column("curriculum_id")

    # Keep legacy request details in the admin note before dropping obsolete columns.
    if inspector.has_table("academic_catalog_requests"):
        op.execute(sa.text(
            "UPDATE academic_catalog_requests SET status = 'REJECTED', "
            "admin_note = COALESCE(admin_note || ' | ', '') || "
            "'Closed: catalog requests now support universities and streams only.' "
            "WHERE request_type = 'CURRICULUM'"
        ))
        op.execute(sa.text(
            "UPDATE academic_catalog_requests SET admin_note = "
            "COALESCE(admin_note || ' | ', '') || 'Legacy curriculum details: version=' || "
            "COALESCE(version, '') || ', academic_year=' || COALESCE(academic_year, '') "
            "WHERE version IS NOT NULL OR academic_year IS NOT NULL"
        ))
        with op.batch_alter_table("academic_catalog_requests") as batch:
            batch.drop_column("version")
            batch.drop_column("academic_year")

    if inspector.has_table("curriculums"):
        op.drop_index("ix_curriculums_university_id", table_name="curriculums")
        op.drop_table("curriculums")


def downgrade() -> None:
    # Restore a compatibility curriculum per university, then reconnect direct stream/profile
    # and course assignment rows. This is a structural rollback; legacy request fields return empty.
    op.create_table(
        "curriculums",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("university_id", sa.Integer(), sa.ForeignKey("universities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False, server_default="1.0"),
        sa.Column("academic_year", sa.String(length=30), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("university_id", "name", "version", name="uq_curriculums_university_name_version"),
    )
    op.create_index("ix_curriculums_university_id", "curriculums", ["university_id"])
    op.execute(sa.text(
        "INSERT INTO curriculums (university_id, name, version, status) "
        "SELECT id, 'Default', '1.0', 'ACTIVE' FROM universities"
    ))
    curriculum_id = "(SELECT id FROM curriculums WHERE curriculums.university_id = streams.university_id LIMIT 1)"
    with op.batch_alter_table("streams", naming_convention=FK_NAMING) as batch:
        batch.add_column(sa.Column("curriculum_id", sa.Integer(), nullable=True))
    op.execute(sa.text(f"UPDATE streams SET curriculum_id = {curriculum_id}"))
    with op.batch_alter_table("streams", naming_convention=FK_NAMING) as batch:
        batch.alter_column("curriculum_id", existing_type=sa.Integer(), nullable=False)
        batch.create_foreign_key("fk_streams_curriculum_id_curriculums", "curriculums", ["curriculum_id"], ["id"], ondelete="CASCADE")
        batch.drop_constraint("uq_streams_university_code", type_="unique")
        batch.create_unique_constraint("uq_streams_curriculum_code", ["curriculum_id", "code"])
        batch.drop_index("ix_streams_university_id")
        batch.create_index("ix_streams_curriculum_id", ["curriculum_id"])
    with op.batch_alter_table("streams", naming_convention=FK_NAMING) as batch:
        batch.drop_constraint("fk_streams_university_id_universities", type_="foreignkey")
        batch.drop_column("university_id")
    with op.batch_alter_table("student_profiles", naming_convention=FK_NAMING) as batch:
        batch.add_column(sa.Column("curriculum_id", sa.Integer(), nullable=True))
    op.execute(sa.text(
        "UPDATE student_profiles SET curriculum_id = (SELECT id FROM curriculums "
        "WHERE curriculums.university_id = student_profiles.university_id LIMIT 1)"
    ))
    with op.batch_alter_table("student_profiles", naming_convention=FK_NAMING) as batch:
        batch.alter_column("curriculum_id", existing_type=sa.Integer(), nullable=False)
        batch.create_foreign_key("fk_student_profiles_curriculum_id_curriculums", "curriculums", ["curriculum_id"], ["id"])
    for table, index in (
        ("university_course_mappings", "ix_university_course_mapping_curriculum"),
        ("university_course_offerings", "ix_university_course_offering_curriculum"),
    ):
        if sa.inspect(op.get_bind()).has_table(table):
            with op.batch_alter_table(table, naming_convention=FK_NAMING) as batch:
                batch.add_column(sa.Column("curriculum_id", sa.Integer(), nullable=True))
            op.execute(sa.text(
                f"UPDATE {table} SET curriculum_id = (SELECT curriculums.id FROM curriculums "
                f"JOIN streams ON streams.university_id = curriculums.university_id "
                f"WHERE streams.id = {table}.stream_id LIMIT 1)"
            ))
            with op.batch_alter_table(table, naming_convention=FK_NAMING) as batch:
                batch.alter_column("curriculum_id", existing_type=sa.Integer(), nullable=False)
                batch.create_foreign_key(f"fk_{table}_curriculum_id_curriculums", "curriculums", ["curriculum_id"], ["id"], ondelete="CASCADE")
                batch.create_index(index, ["curriculum_id"])
    if sa.inspect(op.get_bind()).has_table("academic_catalog_requests"):
        with op.batch_alter_table("academic_catalog_requests") as batch:
            batch.add_column(sa.Column("version", sa.String(length=50), nullable=True))
            batch.add_column(sa.Column("academic_year", sa.String(length=30), nullable=True))

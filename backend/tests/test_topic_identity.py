from app.services.topic_identity import normalize_identity_part, topic_identity


def test_identity_uses_academic_identity_not_database_id():
    class Course:
        registry_key = "FRESHMAN:PHY101:1.0"

    class Chapter:
        name = "Measurement"

    class Topic:
        name = "Physical quantities"

    assert topic_identity(Course(), Chapter(), Topic()) == (
        "FRESHMAN:PHY101:1.0::measurement::physical quantities"
    )


def test_identity_preserves_non_latin_text():
    assert normalize_identity_part("  ልኬት   እና ክፍሎች ") == "ልኬት እና ክፍሎች"

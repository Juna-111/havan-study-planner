from datetime import datetime, timezone
from types import SimpleNamespace

from app.api.academic_catalog_requests import review_request
from app.schemas.academic_catalog_request import AcademicCatalogRequestReview


class FakeDB:
    def __init__(self, request, university=None, existing=None):
        self.request = request
        self.university = university
        self.existing = existing
        self.added = []

    def get(self, model, item_id):
        name = model.__name__
        if name == "AcademicCatalogRequest":
            return self.request if item_id == self.request.id else None
        if name == "University":
            return self.university
        return None

    def scalar(self, statement):
        return self.existing

    def add(self, item):
        self.added.append(item)

    def commit(self):
        pass

    def refresh(self, item):
        pass


def request(
    request_type="UNIVERSITY",
    name="Addis Ababa University",
    code="AAU",
    university_id=None,
    version=None,
):
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=1,
        account_id=7,
        request_type=request_type,
        university_id=university_id,
        name=name,
        code=code,
        version=version,
        academic_year="2026/27",
        status="PENDING",
        admin_note=None,
        created_at=now,
        updated_at=now,
    )


def test_approving_university_request_creates_catalog_record():
    item = request()
    db = FakeDB(item)

    result = review_request(
        request_id=1,
        payload=AcademicCatalogRequestReview(status="APPROVED", admin_note="Verified"),
        db=db,
    )

    assert result.status == "APPROVED"
    assert result.admin_note == "Verified"
    assert len(db.added) == 1
    assert db.added[0].name == "Addis Ababa University"
    assert db.added[0].code == "AAU"
    assert db.added[0].status == "ACTIVE"


def test_approving_stream_request_creates_catalog_record():
    item = request(
        request_type="STREAM",
        name="Engineering",
        code="ENG",
        university_id=3,
    )
    db = FakeDB(item, university=SimpleNamespace(id=3))

    result = review_request(
        request_id=1,
        payload=AcademicCatalogRequestReview(status="APPROVED"),
        db=db,
    )

    assert result.status == "APPROVED"
    assert len(db.added) == 1
    assert db.added[0].university_id == 3
    assert db.added[0].name == "Engineering"
    assert db.added[0].code == "ENG"
    assert db.added[0].status == "ACTIVE"


def test_rejecting_request_does_not_create_catalog_record():
    item = request()
    db = FakeDB(item)

    result = review_request(
        request_id=1,
        payload=AcademicCatalogRequestReview(status="REJECTED", admin_note="Not enough evidence"),
        db=db,
    )

    assert result.status == "REJECTED"
    assert result.admin_note == "Not enough evidence"
    assert db.added == []

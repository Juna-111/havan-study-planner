from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

from app.core.errors import register_exception_handlers
from app.schemas.curriculum import CurriculumCreate


def test_curriculum_and_mapping_create_default_to_active():
    curriculum = CurriculumCreate(
        university_id=1,
        name="Freshman",
        version="1.0",
    )
    assert curriculum.status == "ACTIVE"


def test_validation_errors_are_field_level():
    class Payload(BaseModel):
        name: str = Field(min_length=3)
        age: int = Field(gt=0)

    app = FastAPI()

    @app.post("/example")
    def example(payload: Payload):
        return payload

    register_exception_handlers(app)
    response = TestClient(app).post("/example", json={"name": "x", "age": 0})

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "INVALID_INPUT"
    assert {item["field"] for item in body["detail"]} == {"name", "age"}
    assert all(item["message"] for item in body["detail"])

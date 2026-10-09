from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

from app.core.errors import register_exception_handlers
from app.schemas.academic_catalog import StreamCreate


def test_stream_create_defaults_to_active():
    stream = StreamCreate(university_id=1, name="Engineering", code="ENG")
    assert stream.status == "ACTIVE"


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

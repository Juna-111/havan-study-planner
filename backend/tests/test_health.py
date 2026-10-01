from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)
def test_root() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"
def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "Havan Study Planner API"
    assert "timestamp" in body

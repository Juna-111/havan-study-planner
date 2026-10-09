from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_signup_rate_limit_triggers_after_11_requests():
    headers = {"X-Forwarded-For": "1.2.3.4"}
    payload = {"email": "test-rate@example.com", "password": "ValidPass123"}

    responses = []
    for i in range(11):
        resp = client.post("/api/v1/auth/signup", json=payload, headers=headers)
        responses.append(resp)

    eleventh = responses[10]
    assert eleventh.status_code == 429
    assert "Retry-After" in eleventh.headers
    assert int(eleventh.headers["Retry-After"]) > 0


def test_forgot_password_allows_five_requests_then_returns_retry_delay():
    headers = {"X-Forwarded-For": "198.51.100.245"}
    payload = {"email": "forgot-rate-limit@example.com"}

    responses = [
        client.post("/api/v1/auth/forgot-password", json=payload, headers=headers)
        for _ in range(6)
    ]

    assert [response.status_code for response in responses[:5]] == [200] * 5
    limited = responses[5]
    assert limited.status_code == 429
    assert int(limited.headers["Retry-After"]) > 0


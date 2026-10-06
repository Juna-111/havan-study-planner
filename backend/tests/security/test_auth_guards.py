from pathlib import Path

from app.core.config import Settings
from app.main import app


def route_paths() -> dict[str, set[str]]:
    return {
        route.path: {method for method in route.methods if method in {"GET", "POST", "PUT", "PATCH", "DELETE"}}
        for route in app.routes
        if route.path.startswith("/api/v1/")
    }


def dependency_names(route) -> set[str]:
    return {getattr(dep.call, "__name__", "") for dep in route.dependant.dependencies}


def test_private_routes_have_authentication():
    public = {
        "/api/v1/health",
        "/api/v1/auth/signup",
        "/api/v1/auth/login",
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/verify-reset-code",
        "/api/v1/auth/reset-password",
    }
    for route in app.routes:
        if not route.path.startswith("/api/v1/") or route.path in public:
            continue
        names = dependency_names(route)
        assert "current_account" in names or "require_admin" in names or "require_student_owner" in names or "current_student" in names, route.path


def test_admin_routes_require_admin():
    admin_prefixes = (
        "/api/v1/university-course-mappings",
        "/api/v1/freshman-registry-import",
        "/api/v1/academic-quality",
    )
    for route in app.routes:
        if route.path.startswith(admin_prefixes):
            assert "require_admin" in dependency_names(route), route.path


def test_student_routes_have_ownership_guard():
    for route in app.routes:
        if route.path.startswith("/api/v1/students/") and "{student_id}" in route.path:
            names = dependency_names(route)
            assert "require_student_owner" in names, route.path


def test_production_rejects_placeholder_secret():
    try:
        Settings(environment="production", auth_secret="change-this-secret-in-production")
    except RuntimeError:
        return
    raise AssertionError("production must reject the placeholder AUTH_SECRET")


def test_cors_has_no_wildcard_host_regex():
    source = Path(__file__).resolve().parents[2] / "app" / "main.py"
    assert "allow_origin_regex" not in source.read_text(encoding="utf-8")


def test_password_reset_does_not_create_schema_at_runtime():
    source = Path(__file__).resolve().parents[2] / "app" / "api" / "auth.py"
    assert "__table__.create" not in source.read_text(encoding="utf-8")

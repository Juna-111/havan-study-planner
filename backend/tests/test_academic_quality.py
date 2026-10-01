from app.services.academic_quality import run_academic_quality_checks


def test_academic_quality_route_is_registered() -> None:
    from app.main import app
    assert "/api/v1/academic-quality" in {route.path for route in app.routes}


def test_quality_module_is_importable() -> None:
    assert callable(run_academic_quality_checks)

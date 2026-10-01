def test_student_api_module_imports():
    # This catches missing imports in the student context router before deployment.
    import app.api.student  # noqa: F401

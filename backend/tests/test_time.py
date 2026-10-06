from datetime import date

from app.core.time import canonicalize_study_days, parse_weekdays


def test_canonicalize_study_days_legacy_values():
    assert canonicalize_study_days([0, 1, 6]) == ["mon", "sat", "sun"]


def test_canonicalize_study_days_names_and_duplicates():
    assert canonicalize_study_days(["Sunday", "mon"]) == ["mon", "sun"]
    assert canonicalize_study_days(["mon", "sun"]) == ["mon", "sun"]
    assert canonicalize_study_days([]) == []
    assert canonicalize_study_days(None) == []


def test_sunday_regression_never_maps_to_monday():
    study_days = parse_weekdays(["sun"])
    start = date(2026, 10, 5)  # Monday
    scheduled = [start + __import__("datetime").timedelta(days=i) for i in range(7)]
    scheduled = [day for day in scheduled if day.weekday() in study_days]
    assert scheduled == [date(2026, 10, 11)]
    assert date(2026, 10, 5) not in scheduled

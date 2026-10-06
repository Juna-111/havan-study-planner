from __future__ import annotations

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

ADDIS = ZoneInfo("Africa/Addis_Ababa")
WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")

_DAY_ALIASES = {
    "mon": "mon", "monday": "mon",
    "tue": "tue", "tuesday": "tue",
    "wed": "wed", "wednesday": "wed",
    "thu": "thu", "thursday": "thu",
    "fri": "fri", "friday": "fri",
    "sat": "sat", "saturday": "sat",
    "sun": "sun", "sunday": "sun",
}

def today_local(now: datetime | None = None) -> date:
    moment = now or datetime.now(timezone.utc)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(ADDIS).date()

def to_index(name: str) -> int:
    value = _DAY_ALIASES.get(name.strip().lower())
    if value is None:
        raise ValueError(f"Unknown weekday: {name}")
    return WEEKDAYS.index(value)

def to_name(index: int) -> str:
    if index < 0 or index > 6:
        raise ValueError(f"Weekday index must be between 0 and 6: {index}")
    return WEEKDAYS[index]

def canonicalize_study_days(values: object) -> list[str]:
    if not values:
        return []
    if not isinstance(values, (list, tuple)):
        raise ValueError("Study days must be a list")

    result: set[str] = set()
    for value in values:
        if isinstance(value, bool):
            continue
        if isinstance(value, int) and 0 <= value <= 6:
            # Legacy storage used Sunday=0, Monday=1 ... Saturday=6.
            result.add(to_name((value - 1) % 7))
            continue
        if isinstance(value, str):
            text = value.strip().lower()
            if text.isdigit() and 0 <= int(text) <= 6:
                result.add(to_name((int(text) - 1) % 7))
            elif text in _DAY_ALIASES:
                result.add(_DAY_ALIASES[text])
    return [day for day in WEEKDAYS if day in result]

def parse_weekdays(values: object, default: tuple[int, ...] = (0, 1, 2, 3, 4)) -> frozenset[int]:
    names = canonicalize_study_days(values)
    return frozenset(to_index(name) for name in names) or frozenset(default)

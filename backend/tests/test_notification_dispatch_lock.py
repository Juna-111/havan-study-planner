from types import SimpleNamespace

from app.services import notifications


class FakeSession:
    def __init__(self, dialect: str, acquired: bool = True):
        self.dialect = dialect
        self.acquired = acquired
        self.executed = []
        self.rolled_back = False
        self.committed = False

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def get_bind(self):
        return SimpleNamespace(dialect=SimpleNamespace(name=self.dialect))

    def scalar(self, *_args, **_kwargs):
        return self.acquired

    def execute(self, statement, params=None):
        self.executed.append((str(statement), params))

    def rollback(self):
        self.rolled_back = True

    def commit(self):
        self.committed = True


def test_postgres_dispatch_runs_only_when_advisory_lock_is_acquired(monkeypatch):
    session = FakeSession("postgresql", acquired=False)
    dispatch_calls = []
    monkeypatch.setattr(notifications, "SessionLocal", lambda: session)
    monkeypatch.setattr(notifications, "_dispatch_due_notifications", lambda today: dispatch_calls.append(today) or 2)

    assert notifications.dispatch_due_notifications() == 0
    assert dispatch_calls == []


def test_postgres_dispatch_releases_lock_after_sending(monkeypatch):
    session = FakeSession("postgresql")
    monkeypatch.setattr(notifications, "SessionLocal", lambda: session)
    monkeypatch.setattr(notifications, "_dispatch_due_notifications", lambda today: 2)

    assert notifications.dispatch_due_notifications() == 2
    assert session.rolled_back
    assert session.committed
    assert len(session.executed) == 1
    assert "pg_advisory_unlock" in session.executed[0][0]


def test_non_postgres_dispatch_skips_advisory_lock(monkeypatch):
    session = FakeSession("sqlite")
    monkeypatch.setattr(notifications, "SessionLocal", lambda: session)
    monkeypatch.setattr(notifications, "_dispatch_due_notifications", lambda today: 4)

    assert notifications.dispatch_due_notifications() == 4
    assert session.executed == []

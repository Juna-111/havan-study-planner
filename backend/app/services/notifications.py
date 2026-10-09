from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.time import today_local
from app.db.models.curriculum import Course, Topic, Chapter
from app.db.models.notification import NotificationDelivery, PushSubscription, ScheduledPush
from app.db.models.plan import PlanTask
from app.db.models.student import StudentExam, StudentProfile
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


def _send(subscription: PushSubscription, title: str, body: str, url: str, tag: str) -> bool:
    settings = get_settings()
    if not (settings.vapid_public_key and settings.vapid_private_key):
        return False
    try:
        from pywebpush import WebPushException, webpush
        webpush(
            subscription_info={"endpoint": subscription.endpoint, "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth}},
            data=__import__("json").dumps({"title": title, "body": body, "url": url, "tag": tag}),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
            ttl=60 * 60 * 24,
        )
        return True
    except Exception as exc:
        # Expired browser tokens should not keep failing on every worker tick.
        if exc.__class__.__name__ == "WebPushException" and getattr(getattr(exc, "response", None), "status_code", None) in (404, 410):
            with SessionLocal() as db:
                db.query(PushSubscription).filter(PushSubscription.id == subscription.id).delete()
                db.commit()
        logger.warning("Push notification failed: %s", exc)
        return False


def dispatch_due_notifications(today: date | None = None) -> int:
    """Run reminders once across all API processes sharing the production database."""
    with SessionLocal() as lock_db:
        if lock_db.get_bind().dialect.name != "postgresql":
            return _dispatch_due_notifications(today)

        lock_id = 7_204_219_061
        acquired = lock_db.scalar(text("SELECT pg_try_advisory_lock(:lock_id)"), {"lock_id": lock_id})
        if not acquired:
            return 0
        try:
            return _dispatch_due_notifications(today)
        finally:
            # Advisory locks are connection-scoped, so unlock on this same pooled connection.
            lock_db.rollback()
            lock_db.execute(text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": lock_id})
            lock_db.commit()


def _dispatch_due_notifications(today: date | None = None) -> int:
    """Send once-per-device reminders for exams and planned tasks that are due."""
    today = today or today_local()
    sent = 0
    with SessionLocal() as db:
        subscriptions = db.scalars(select(PushSubscription)).all()
        for sub in subscriptions:
            student = db.get(StudentProfile, sub.student_id)
            if student is None:
                continue
            exams = db.execute(
                select(StudentExam, Course.name)
                .join(Course, Course.id == StudentExam.course_id)
                .where(StudentExam.student_id == sub.student_id, StudentExam.exam_date >= today, StudentExam.exam_date <= date.fromordinal(today.toordinal() + 7))
            ).all()
            for exam, course_name in exams:
                days = (exam.exam_date - today).days
                if days not in (0, 1, 7):
                    continue
                key = f"exam:{exam.id}:{days}:{today.isoformat()}:{sub.id}"
                if db.scalar(select(NotificationDelivery.id).where(NotificationDelivery.student_id == sub.student_id, NotificationDelivery.reminder_key == key)):
                    continue
                when = "today" if days == 0 else "tomorrow" if days == 1 else "in 7 days"
                if _send(sub, f"{exam.exam_type} {when}", f"Your {exam.exam_type.lower()} for {course_name} is {when}. Open your exam runway to review your preparation.", "/exam-planning", key):
                    db.add(NotificationDelivery(student_id=sub.student_id, reminder_key=key, sent_at=datetime.now(timezone.utc)))
                    sent += 1
            tasks = db.execute(
                select(PlanTask, Topic.name, Course.name)
                .join(Topic, Topic.id == PlanTask.topic_id)
                .join(Chapter, Chapter.id == Topic.chapter_id)
                .join(Course, Course.id == PlanTask.course_id)
                .where(PlanTask.student_id == sub.student_id, PlanTask.planned_date == today, PlanTask.status.in_(("PLANNED", "IN_PROGRESS")))
                .order_by(PlanTask.planned_date, PlanTask.id)
            ).all()
            if tasks:
                key = f"plan:{today.isoformat()}:{sub.id}"
                if not db.scalar(select(NotificationDelivery.id).where(NotificationDelivery.student_id == sub.student_id, NotificationDelivery.reminder_key == key)):
                    task, topic_name, course_name = tasks[0]
                    body = f"Today's plan: {topic_name} for {course_name} ({task.minutes} minutes). Open your plan to get started."
                    if _send(sub, "Your study plan for today", body, "/plan", key):
                        db.add(NotificationDelivery(student_id=sub.student_id, reminder_key=key, sent_at=datetime.now(timezone.utc)))
                        sent += 1
            due_reminders = db.scalars(select(ScheduledPush).where(ScheduledPush.student_id == sub.student_id)).all()
            now = datetime.now(timezone.utc)
            for reminder in due_reminders:
                due_at = reminder.due_at.replace(tzinfo=timezone.utc) if reminder.due_at.tzinfo is None else reminder.due_at
                if due_at > now:
                    continue
                key = f"{reminder.reminder_key}:{sub.id}"
                if db.scalar(select(NotificationDelivery.id).where(NotificationDelivery.student_id == sub.student_id, NotificationDelivery.reminder_key == key)):
                    db.delete(reminder)
                    continue
                if _send(sub, reminder.title, reminder.body, reminder.url, reminder.reminder_key):
                    db.add(NotificationDelivery(student_id=sub.student_id, reminder_key=key, sent_at=now))
                    db.delete(reminder)
                    sent += 1
        db.commit()
    return sent

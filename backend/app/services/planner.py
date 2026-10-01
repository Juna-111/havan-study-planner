from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.curriculum import Chapter, Course, Topic, TopicRelationship
from app.db.models.planner import StudyPlan, StudyTask
from app.db.models.student import StudentCourse, StudentExam, StudentProfile, StudentTopicProgress


STATUS_DONE = "COMPLETED"


def _days_until(target: date, today: date) -> int:
    return max(0, (target - today).days)


def generate_plan(db: Session, student_id: int, horizon_days: int = 7) -> StudyPlan:
    student = db.get(StudentProfile, student_id)
    if not student:
        raise ValueError("Student profile not found")

    selected = list(db.scalars(
        select(StudentCourse).where(StudentCourse.student_id == student_id, StudentCourse.status == "ACTIVE")
    ).all())
    course_ids = [item.course_id for item in selected]
    if not course_ids:
        raise ValueError("Select at least one course before generating a plan")

    courses = {c.id: c for c in db.scalars(select(Course).where(Course.id.in_(course_ids))).all()}
    chapters = list(db.scalars(select(Chapter).where(Chapter.course_id.in_(course_ids))).all())
    chapter_ids = [c.id for c in chapters]
    topics = list(db.scalars(select(Topic).where(Topic.chapter_id.in_(chapter_ids), Topic.status == "ACTIVE")).all()) if chapter_ids else []
    chapter_to_course = {c.id: c.course_id for c in chapters}

    progress = {
        p.topic_id: p for p in db.scalars(select(StudentTopicProgress).where(StudentTopicProgress.student_id == student_id)).all()
    }
    exams = list(db.scalars(select(StudentExam).where(StudentExam.student_id == student_id)).all())
    exam_by_course: dict[int, list[StudentExam]] = defaultdict(list)
    for exam in exams:
        exam_by_course[exam.course_id].append(exam)

    topic_ids = [t.id for t in topics]
    relationships = list(db.scalars(
        select(TopicRelationship).where(
            TopicRelationship.relationship_type == "PREREQUISITE",
            TopicRelationship.target_topic_id.in_(topic_ids),
        )
    ).all()) if topic_ids else []

    prerequisites: dict[int, list[int]] = defaultdict(list)
    for rel in relationships:
        prerequisites[rel.target_topic_id].append(rel.source_topic_id)

    today = date.today()
    candidates = []
    for topic in topics:
        p = progress.get(topic.id)
        if p and p.status == STATUS_DONE:
            continue

        course_id = chapter_to_course[topic.chapter_id]
        course_exams = [e for e in exam_by_course[course_id] if e.exam_date >= today]
        nearest_exam = min(course_exams, key=lambda e: e.exam_date) if course_exams else None
        exam_days = _days_until(nearest_exam.exam_date, today) if nearest_exam else None

        blocked = [
            prerequisite_id for prerequisite_id in prerequisites.get(topic.id, [])
            if not progress.get(prerequisite_id) or progress[prerequisite_id].status != STATUS_DONE
        ]

        exam_score = 0.0 if exam_days is None else max(0.0, 1.0 - min(exam_days, 30) / 30)
        importance = nearest_exam.importance / 5 if nearest_exam else 0.25
        difficulty = topic.difficulty / 5
        topic_importance = (topic.exam_importance * 0.6) + (topic.conceptual_importance * 0.4)
        confidence_penalty = 0.0 if not p else max(0.0, (3 - p.confidence) / 3)
        prerequisite_bonus = 0.20 if blocked == [] else -0.15

        priority = (
            exam_score * 0.35
            + importance * 0.20
            + topic_importance * 0.20
            + difficulty * 0.10
            + confidence_penalty * 0.15
            + prerequisite_bonus
        )

        reason_parts = []
        if exam_days is not None:
            reason_parts.append(f"{nearest_exam.exam_type.title()} in {exam_days} day(s)")
        if topic.exam_importance >= 0.7:
            reason_parts.append("high exam importance")
        if topic.difficulty >= 4:
            reason_parts.append("higher difficulty")
        if blocked:
            reason_parts.append("after prerequisite topics")
        elif prerequisites.get(topic.id):
            reason_parts.append("prerequisites are ready")
        if not reason_parts:
            reason_parts.append("unfinished topic in your selected course")

        # A topic with unfinished prerequisites is not eligible for scheduling yet.
        if blocked:
            continue

        candidates.append({
            "topic": topic,
            "course_id": course_id,
            "priority": round(priority, 4),
            "reason": "; ".join(reason_parts),
        })

    candidates.sort(key=lambda x: -x["priority"])
    study_days = set(student.study_days or [])
    # Stored day values are expected to be lowercase weekday names.
    dates = [today + timedelta(days=i) for i in range(horizon_days) if (today + timedelta(days=i)).strftime("%a").lower()[:3] in study_days or (today + timedelta(days=i)).strftime("%A").lower() in study_days]
    if not dates:
        dates = [today + timedelta(days=i) for i in range(horizon_days) if (today + timedelta(days=i)).weekday() < 5]
    if not dates:
        dates = [today]

    plan = StudyPlan(student_id=student_id, horizon_days=horizon_days)
    db.add(plan)
    db.flush()

    # Fill each study day up to the student's stated capacity.
    daily_capacity = max(30, int(student.study_hours_per_day * 60))
    day_minutes = {d: 0 for d in dates}
    cursor = 0

    for item in candidates:
        topic = item["topic"]
        minutes = min(topic.estimated_study_minutes, daily_capacity)
        if minutes <= 0:
            continue
        assigned = None
        for offset in range(len(dates)):
            d = dates[(cursor + offset) % len(dates)]
            if day_minutes[d] + minutes <= daily_capacity:
                assigned = d
                cursor = (dates.index(d) + 1) % len(dates)
                break
        if assigned is None:
            continue
        day_minutes[assigned] += minutes
        db.add(StudyTask(
            plan_id=plan.id,
            student_id=student_id,
            course_id=item["course_id"],
            topic_id=topic.id,
            planned_date=assigned,
            estimated_minutes=minutes,
            priority=item["priority"],
            reason=item["reason"],
        ))

    db.commit()
    db.refresh(plan)
    return plan


def load_plan(db: Session, student_id: int, plan_id: int | None = None) -> StudyPlan | None:
    if plan_id:
        plan = db.scalar(select(StudyPlan).where(StudyPlan.id == plan_id, StudyPlan.student_id == student_id))
    else:
        plan = db.scalar(select(StudyPlan).where(StudyPlan.student_id == student_id).order_by(StudyPlan.id.desc()))
    return plan

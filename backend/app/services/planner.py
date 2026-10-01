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


def _study_dates(student: StudentProfile, horizon_days: int, today: date) -> list[date]:
    """Accept both the current integer weekday format and older string data."""
    raw_days = student.study_days or []
    day_numbers: set[int] = set()

    names = {
        "sun": 6, "sunday": 6,
        "mon": 0, "monday": 0,
        "tue": 1, "tuesday": 1,
        "wed": 2, "wednesday": 2,
        "thu": 3, "thursday": 3,
        "fri": 4, "friday": 4,
        "sat": 5, "saturday": 5,
    }
    for value in raw_days:
        if isinstance(value, int) and 0 <= value <= 6:
            # Frontend stores JavaScript-style Sunday=0 ... Saturday=6.
            day_numbers.add((value - 1) % 7)
        elif isinstance(value, str):
            lowered = value.strip().lower()
            if lowered.isdigit() and 0 <= int(lowered) <= 6:
                day_numbers.add((int(lowered) - 1) % 7)
            elif lowered in names:
                day_numbers.add(names[lowered])

    if not day_numbers:
        day_numbers = {0, 1, 2, 3, 4}

    return [
        today + timedelta(days=i)
        for i in range(horizon_days)
        if (today + timedelta(days=i)).weekday() in day_numbers
    ] or [today]


def generate_plan(db: Session, student_id: int, horizon_days: int = 7) -> StudyPlan:
    student = db.get(StudentProfile, student_id)
    if not student:
        raise ValueError("Student profile not found")

    selected = list(db.scalars(
        select(StudentCourse).where(
            StudentCourse.student_id == student_id,
            StudentCourse.status == "ACTIVE",
        )
    ).all())
    course_ids = [item.course_id for item in selected]
    if not course_ids:
        raise ValueError("Select at least one course before generating a plan")

    courses = {
        c.id: c
        for c in db.scalars(select(Course).where(Course.id.in_(course_ids))).all()
    }
    chapters = list(db.scalars(
        select(Chapter).where(Chapter.course_id.in_(course_ids))
    ).all())
    chapter_ids = [chapter.id for chapter in chapters]
    topics = list(db.scalars(
        select(Topic).where(
            Topic.chapter_id.in_(chapter_ids),
            Topic.status == "ACTIVE",
        )
    ).all()) if chapter_ids else []

    chapter_to_course = {chapter.id: chapter.course_id for chapter in chapters}
    course_confidence = {item.course_id: item.confidence for item in selected}

    progress = {
        item.topic_id: item
        for item in db.scalars(
            select(StudentTopicProgress).where(
                StudentTopicProgress.student_id == student_id
            )
        ).all()
    }
    exams = list(db.scalars(
        select(StudentExam).where(StudentExam.student_id == student_id)
    ).all())
    exam_by_course: dict[int, list[StudentExam]] = defaultdict(list)
    for exam in exams:
        exam_by_course[exam.course_id].append(exam)

    topic_ids = [topic.id for topic in topics]
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
    candidates: list[dict] = []
    blocked_candidates: list[dict] = []

    for topic in topics:
        progress_item = progress.get(topic.id)
        if progress_item and progress_item.status == STATUS_DONE:
            continue

        course_id = chapter_to_course.get(topic.chapter_id)
        if course_id not in courses:
            continue

        course_exams = [
            exam for exam in exam_by_course[course_id]
            if exam.exam_date >= today
        ]
        nearest_exam = min(course_exams, key=lambda exam: exam.exam_date) if course_exams else None
        exam_days = _days_until(nearest_exam.exam_date, today) if nearest_exam else None

        # A prerequisite outside the student's selected course scope cannot
        # reasonably block the student forever. Only selected-scope prerequisites
        # are hard blockers.
        blocked = [
            prerequisite_id
            for prerequisite_id in prerequisites.get(topic.id, [])
            if prerequisite_id in topic_ids
            and (
                not progress.get(prerequisite_id)
                or progress[prerequisite_id].status != STATUS_DONE
            )
        ]

        exam_urgency = 0.0 if exam_days is None else max(0.0, 1.0 - min(exam_days, 30) / 30)
        exam_importance = (nearest_exam.importance / 5) if nearest_exam else 0.20
        topic_importance = (
            float(topic.exam_importance) * 0.60
            + float(topic.conceptual_importance) * 0.40
        )
        difficulty = max(0.0, min(1.0, float(topic.difficulty) / 5))
        confidence_penalty = max(
            0.0,
            (3 - course_confidence.get(course_id, 3)) / 3,
        )
        progress_penalty = (
            0.10 if progress_item and progress_item.status == "IN_PROGRESS" else 0.0
        )
        prerequisite_bonus = 0.12 if prerequisites.get(topic.id) and not blocked else 0.0

        priority = (
            exam_urgency * 0.34
            + exam_importance * 0.16
            + topic_importance * 0.20
            + difficulty * 0.10
            + confidence_penalty * 0.12
            + progress_penalty
            + prerequisite_bonus
        )

        reason_parts: list[str] = []
        if exam_days is not None:
            reason_parts.append(
                f"{nearest_exam.exam_type.title()} in {exam_days} day(s)"
            )
        if float(topic.exam_importance) >= 0.70:
            reason_parts.append("high exam importance")
        if topic.difficulty >= 4:
            reason_parts.append("higher difficulty")
        if course_confidence.get(course_id, 3) <= 2:
            reason_parts.append("low course confidence")
        if progress_item and progress_item.status == "IN_PROGRESS":
            reason_parts.append("continue your current progress")
        if blocked:
            reason_parts.append("prerequisite still unfinished")
        elif prerequisites.get(topic.id):
            reason_parts.append("prerequisites are ready")
        if not reason_parts:
            reason_parts.append("unfinished topic in your selected course")

        item = {
            "topic": topic,
            "course_id": course_id,
            "priority": round(priority, 4),
            "reason": "; ".join(reason_parts),
        }

        if blocked:
            blocked_candidates.append(item)
        else:
            candidates.append(item)

    # Never leave a student with an empty plan just because prerequisite metadata
    # is incomplete. Eligible topics come first; blocked topics are a fallback.
    candidates.sort(key=lambda item: -item["priority"])
    blocked_candidates.sort(key=lambda item: -item["priority"])
    if not candidates:
        candidates = blocked_candidates

    if not candidates:
        raise ValueError(
            "There are no unfinished active topics in your selected courses."
        )

    dates = _study_dates(student, horizon_days, today)
    daily_capacity = max(30, int(round(student.study_hours_per_day * 60)))

    plan = StudyPlan(student_id=student_id, horizon_days=horizon_days)
    db.add(plan)
    db.flush()

    day_minutes = {day: 0 for day in dates}
    course_counts = defaultdict(int)

    # Small diversity bonus: do not let one course consume the entire week
    # when several courses have similarly strong recommendations.
    for item in candidates:
        item["balanced_priority"] = item["priority"] - course_counts[item["course_id"]] * 0.035

    candidates.sort(key=lambda item: -item["balanced_priority"])

    cursor = 0
    created_tasks = 0
    for item in candidates:
        topic = item["topic"]
        minutes = max(15, int(topic.estimated_study_minutes))
        minutes = min(minutes, daily_capacity)

        assigned = None
        for offset in range(len(dates)):
            day = dates[(cursor + offset) % len(dates)]
            if day_minutes[day] + minutes <= daily_capacity:
                assigned = day
                cursor = (dates.index(day) + 1) % len(dates)
                break

        if assigned is None:
            continue

        day_minutes[assigned] += minutes
        course_counts[item["course_id"]] += 1
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
        created_tasks += 1

    if created_tasks == 0:
        # This should only happen with an unusually tiny/invalid capacity.
        # Give the student one actionable recommendation instead of an empty UI.
        item = candidates[0]
        topic = item["topic"]
        db.add(StudyTask(
            plan_id=plan.id,
            student_id=student_id,
            course_id=item["course_id"],
            topic_id=topic.id,
            planned_date=dates[0],
            estimated_minutes=min(30, max(15, int(topic.estimated_study_minutes))),
            priority=item["priority"],
            reason=item["reason"],
        ))

    db.commit()
    db.refresh(plan)
    return plan


def load_plan(db: Session, student_id: int, plan_id: int | None = None) -> StudyPlan | None:
    if plan_id:
        return db.scalar(
            select(StudyPlan).where(
                StudyPlan.id == plan_id,
                StudyPlan.student_id == student_id,
            )
        )
    return db.scalar(
        select(StudyPlan)
        .where(StudyPlan.student_id == student_id)
        .order_by(StudyPlan.id.desc())
    )

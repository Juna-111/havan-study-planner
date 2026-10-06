# Havan product contract

## One student flow

Sign in → set up once → choose what to study → Havan organizes → review → follow.

The active student routes are:

`/auth`, `/onboarding`, `/home`, `/plan`, `/plan/new`, `/progress`, and `/settings`.

## Who decides what

The student decides:
- courses and topics to study;
- available study time and study days;
- optional known topics;
- edits such as moving, skipping, repeating, completing, or removing tasks.

The engine decides:
- ordering;
- minute allocation;
- spreading work across available days;
- exam readiness;
- warnings and explanations.

The engine must never silently add a topic the student did not choose.

## Product language

Use plain language. Do not expose internal scores, weights, resolver mechanics, or engine jargon to students.

Havan's core message is: **The system recommends. The student decides.**

## Academic data

Course, chapter, topic, curriculum-version, and mapping records are sample/development data for the MVP. The production architecture keeps these records replaceable by real institutional data later.

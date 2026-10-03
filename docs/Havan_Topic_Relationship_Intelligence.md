# Havan Topic Relationship Intelligence Pipeline

## Purpose

Havan separates AI academic reasoning from database authority.

The AI does not need database access and must never invent or persist numeric Topic IDs.

Pipeline:

Havan database
→ Havan Topic Catalog
→ AI relationship generation
→ stable academic identities
→ Havan candidate resolver
→ database Topic IDs
→ validation
→ admin preview
→ approved TopicRelationship rows

## Stable topic identity

A Topic identity is:

registry_key::normalized chapter name::normalized topic name

Example:

FRESHMAN:PHY101:1.0::measurement::physical quantities

The identity uses the existing Havan Course Registry identity and academic names. It does not contain the database-generated topics.id.

If a topic is renamed, the old identity becomes unresolved. Havan refuses to silently attach the relationship to a different topic.

If a course content version changes, its registry key changes and the old candidate becomes unresolved instead of being attached to the new version.

## Topic catalog

GET /api/v1/topic-relationship-candidates/catalog

The catalog is generated from active Havan Course → Chapter → Topic data.

Each item provides:

- topic_identity
- course_code
- course_name
- registry_key
- content_version
- chapter_name and chapter_order
- topic_name and topic_order
- difficulty
- estimated_study_minutes
- exam_importance
- conceptual_importance

The catalog is suitable as context for an external AI relationship-generation step.

The catalog intentionally does not expose database Topic IDs as the AI reference mechanism.

## AI candidate contract

POST /api/v1/topic-relationship-candidates/preview

Body:

{
  "candidates": [
    {
      "source_topic_identity": "FRESHMAN:PHY101:1.0::measurement::physical quantities",
      "target_topic_identity": "FRESHMAN:PHY101:1.0::vectors::scalars and vectors",
      "relationship_type": "prerequisite",
      "strength": 0.9,
      "confidence": 0.96,
      "notes": "Academic reason for the relationship."
    }
  ]
}

Supported relationship types:

- prerequisite
- conceptual
- cross_course
- related
- revision

Strength describes the academic relationship itself.

Confidence describes how confident the AI is in the proposed relationship.

They are intentionally separate values.

## Havan resolution

For every candidate, the backend:

1. Resolves the source academic identity.
2. Resolves the target academic identity.
3. Obtains the current database-generated topics.id.
4. Verifies the course registry identity.
5. Rejects unresolved identities.
6. Rejects ambiguous identities.
7. Rejects self-links.
8. Detects duplicate candidates.
9. Detects already-existing relationships.
10. Detects prerequisite cycles.
11. Returns the resolved IDs in the admin preview.

The AI does none of these database operations.

## Commit

POST /api/v1/topic-relationship-candidates/commit

The backend repeats resolution and validation immediately before mutation. The preview is never treated as a permanent database snapshot.

Only READY candidates are inserted.

Existing relationships are skipped.

Any validation error blocks the commit.

Final database rows use:

source_topic_id
target_topic_id
relationship_type
strength
notes

The database remains the source of truth.

## Admin workflow

Admin → Topic relationships

Step 01:
Download AI catalog.

Step 02:
Give the catalog to the chosen AI system and request candidate JSON.

Step 03:
Paste the candidate JSON into Havan.

Step 04:
Havan resolves every identity and shows the real current Topic IDs.

Step 05:
Admin reviews source topic, target topic, relationship type, strength, confidence, and validation state.

Step 06:
Admin approves and saves.

This is preview-first, matching the existing Havan Course Registry and manual relationship import workflows.

## Important migration property

Database Topic IDs are not stable academic identities.

A Topic may have ID 103 in one database state and a different ID after a rebuild or migration.

The academic identity remains the external reference.

Therefore:

AI → academic identity
Havan backend → current topics.id
Database → persisted relationship

Never:

AI → guessed topics.id

## No machine learning in the planner

This pipeline provides an AI-assisted academic-content workflow only.

It does not put an LLM into the deterministic planner.

The planner continues to consume validated Havan relationship data.

## Local validation

Backend:

cd backend
pytest -q

Frontend:

npm --workspace @havan-study-planner-frontend run build

The relationship workspace is available from /admin under Topic relationships.

Test the candidate flow locally before deployment:

1. Start PostgreSQL/Neon-compatible development database.
2. Start FastAPI on port 8000.
3. Start Next.js development server.
4. Open /admin.
5. Select Topic relationships.
6. Download the catalog.
7. Generate or paste candidate JSON.
8. Run Resolve and preview.
9. Verify the preview displays real current Topic IDs.
10. Verify invalid identities are rejected.
11. Verify an existing relationship is marked EXISTING.
12. Verify a prerequisite cycle is rejected.
13. Only then approve and save.

Real curriculum data can replace current sample data later. The relationship pipeline does not depend on sample IDs being permanent.

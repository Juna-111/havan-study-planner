from app.schemas.topic_relationship_candidates import TopicRelationshipCandidateBatch


def test_candidate_schema_separates_strength_and_confidence():
    payload = TopicRelationshipCandidateBatch(candidates=[{
        "source_topic_identity": "FRESHMAN:PHY101:1.0::measurement::physical quantities",
        "target_topic_identity": "FRESHMAN:PHY101:1.0::vectors::scalars and vectors",
        "relationship_type": "prerequisite",
        "strength": 0.9,
        "confidence": 0.96,
        "notes": "Understanding quantities supports later vector measurement.",
    }])
    assert payload.candidates[0].strength == 0.9
    assert payload.candidates[0].confidence == 0.96

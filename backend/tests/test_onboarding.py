import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import status
from app.db.models import UserOnboarding


@pytest.mark.asyncio
async def test_onboarding_flow(
    async_client: AsyncClient,
    test_db: AsyncSession,
    test_user_id: str,
    auth_headers: dict,
):
    # 1. Check initial state (should be false)
    response = await async_client.get("/onboarding", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["has_completed"] is False
    assert data["learning_topics"] is None

    # 2. Complete onboarding
    payload = {
        "learning_topics": {"topic1": True, "topic2": False},
        "goal": "Pass my exams",
        "study_frequency": "Every day",
        "experience_level": "intermediate",
    }
    response = await async_client.post(
        "/onboarding", headers=auth_headers, json=payload
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["has_completed"] is True
    assert data["goal"] == "Pass my exams"
    assert data["study_frequency"] == "Every day"
    assert data["learning_topics"] == {"topic1": True, "topic2": False}
    assert data["experience_level"] == "intermediate"

    # 3. Check state again (should be true with data)
    response = await async_client.get("/onboarding", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["has_completed"] is True
    assert data["goal"] == "Pass my exams"
    assert data["experience_level"] == "intermediate"

    # 4. Partial update (upsert behavior)
    payload_update = {
        "study_frequency": "Once a week",
    }
    response = await async_client.post(
        "/onboarding", headers=auth_headers, json=payload_update
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["has_completed"] is True
    assert data["goal"] == "Pass my exams"  # Should remain unchanged
    assert data["study_frequency"] == "Once a week"
    assert data["experience_level"] == "intermediate"

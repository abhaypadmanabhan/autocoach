
from unittest.mock import MagicMock
from uuid import uuid4

from fastapi.testclient import TestClient

import app.config

# Mock config
settings_mock = MagicMock()
settings_mock.supabase_url = "http://test"
settings_mock.supabase_publishable_key = "test"
settings_mock.supabase_secret_key = "test"
settings_mock.qdrant_url = "http://test"
settings_mock.qdrant_api_key = "test"
settings_mock.kimi_api_key = "test"
settings_mock.max_document_mb = 10
settings_mock.max_documents_per_user = 10
settings_mock.max_quiz_sessions_per_day = 5
settings_mock.quiz_requests_per_minute = 60
settings_mock.environment = "test"
settings_mock.get_cors_origins.return_value = ["*"]

app.config.get_settings = lambda: settings_mock

from app.main import app
from app.api.routes.documents import get_user_id_from_token
from app.api.routes import xp as xp_route

client = TestClient(app)
user_id = str(uuid4())


async def override_get_user_id_from_token():
    return user_id


app.dependency_overrides[get_user_id_from_token] = override_get_user_id_from_token


def _mock_supabase() -> MagicMock:
    mock_supabase = MagicMock()
    
    # Tables
    users_table = MagicMock()
    daily_usage_table = MagicMock()
    
    def table_side_effect(name: str):
        if name == "users":
            return users_table
        if name == "user_daily_usage":
            return daily_usage_table
        return MagicMock()

    mock_supabase.table.side_effect = table_side_effect
    return mock_supabase


def test_redeem_xp_insufficient_balance(mocker):
    mock_sb = _mock_supabase()
    mocker.patch.object(xp_route, "supabase_admin", mock_sb)
    
    # Mock user stats fetch returning low XP
    mock_sb.table("users").select().eq().single().execute.return_value = MagicMock(
        data={"total_xp": 50}
    )
    
    res = client.post("/xp/redeem", json={"amount": 100})
    
    assert res.status_code == 400
    assert "Insufficient XP" in res.json()["detail"]


def test_redeem_xp_success(mocker):
    mock_sb = _mock_supabase()
    mocker.patch.object(xp_route, "supabase_admin", mock_sb)
    mocker.patch("app.api.routes.xp.get_or_create_daily_usage", return_value={
        "extra_quizzes": 0,
        "date": "2024-01-01"
    })
    
    # 1. Fetch user (sufficient XP)
    mock_sb.table("users").select().eq().single().execute.return_value = MagicMock(
        data={"total_xp": 150}
    )
    
    # 2. Update user (deduct XP)
    mock_sb.table("users").update().eq().eq().execute.return_value = MagicMock(
        data=[{"total_xp": 50}]
    )
    
    # 3. Update daily usage (add credit)
    mock_sb.table("user_daily_usage").update().eq().eq().execute.return_value = MagicMock(
        data=[{"extra_quizzes": 1}]
    )
    
    res = client.post("/xp/redeem", json={"amount": 100})
    
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["new_total_xp"] == 50
    assert data["credits_added"] == 1


def test_redeem_xp_refund_on_failure(mocker):
    mock_sb = _mock_supabase()
    mocker.patch.object(xp_route, "supabase_admin", mock_sb)
    mocker.patch("app.api.routes.xp.get_or_create_daily_usage", return_value={
        "extra_quizzes": 0,
        "date": "2024-01-01"
    })
    
    # 1. Fetch user (sufficient XP)
    mock_sb.table("users").select().eq().single().execute.return_value = MagicMock(
        data={"total_xp": 150}
    )
    
    # 2. Update user (deduct XP) - Success
    mock_sb.table("users").update().eq().eq().execute.return_value = MagicMock(
        data=[{"total_xp": 50}]
    )
    
    # 3. Update daily usage - Failure
    mock_sb.table("user_daily_usage").update().eq().eq().execute.side_effect = Exception("DB Error")
    
    res = client.post("/xp/redeem", json={"amount": 100})
    
    assert res.status_code == 500
    assert "Redemption failed" in res.json()["detail"]
    
    # Verify refund was attempted
    # We expect 2 calls to update: initial deduct and refund
    assert mock_sb.table("users").update.call_count == 2


import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4
from fastapi import HTTPException
from app.services import usage as usage_service

def test_is_pro_user_true():
    user_id = uuid4()
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {"plan_type": "pro"}
    
    with patch("app.services.usage.supabase_admin", mock_supabase):
        assert usage_service.is_pro_user(user_id) is True

def test_is_pro_user_false():
    user_id = uuid4()
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {"plan_type": "free"}
    
    with patch("app.services.usage.supabase_admin", mock_supabase):
        assert usage_service.is_pro_user(user_id) is False

def test_is_pro_user_none_data():
    user_id = uuid4()
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = None
    
    with patch("app.services.usage.supabase_admin", mock_supabase):
        assert usage_service.is_pro_user(user_id) is False

def test_consume_sprint_usage_pro_bypass():
    user_id = uuid4()
    
    with patch("app.services.usage.is_pro_user", return_value=True):
        # Should not raise exception and return 0
        result = usage_service.consume_sprint_usage_or_429(user_id)
        assert result == 0

def test_consume_quiz_usage_pro_bypass():
    user_id = uuid4()
    
    with patch("app.services.usage.is_pro_user", return_value=True):
        # Should not raise exception and return 0
        result = usage_service.consume_quiz_usage_or_429(user_id)
        assert result == 0

def test_consume_sprint_usage_free_enforces_limit():
    user_id = uuid4()
    
    with patch("app.services.usage.is_pro_user", return_value=False):
        with patch("app.services.usage.supabase_admin") as mock_supabase:
             # Mock get_or_create upsert
            mock_supabase.table.return_value.upsert.return_value.execute.return_value = None
            
            # Mock current value fetch -> returns SPRINT_LIMIT (1)
            mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value.data = {"sprints_used": usage_service.SPRINT_LIMIT}
            
            with pytest.raises(HTTPException) as exc:
                usage_service.consume_sprint_usage_or_429(user_id)
            
            assert exc.value.status_code == 429
            assert exc.value.detail["type"] == "sprint"

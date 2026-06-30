import pytest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4
from fastapi import HTTPException
from app.config import Settings
from app.services import abuse_controls
from app.services import usage as usage_service


class _FakeSupabase:
    def __init__(
        self,
        *,
        user_id,
        email,
        plan_type="free",
        quizzes_used=5,
        extra_quizzes=0,
        document_count=2,
        plan_type_error=None,
    ):
        self.user_id = str(user_id)
        self.email = email
        self.plan_type = plan_type
        self.quizzes_used = quizzes_used
        self.extra_quizzes = extra_quizzes
        self.document_count = document_count
        self.plan_type_error = plan_type_error
        self.table_calls = []
        self.document_select_count = 0
        self.daily_usage_write_count = 0

    def table(self, name):
        self.table_calls.append(name)
        if name == "users":
            return _UsersQuery(self)
        if name == "user_daily_usage":
            return _DailyUsageQuery(self)
        if name == "documents":
            return _DocumentsQuery(self)
        return MagicMock()


class _UsersQuery:
    def __init__(self, fake):
        self.fake = fake
        self.columns = ""
        self.filters = {}

    def select(self, columns):
        self.columns = columns
        return self

    def eq(self, key, value):
        self.filters[key] = str(value)
        return self

    def single(self):
        return self

    def execute(self):
        if self.filters.get("id") != self.fake.user_id:
            return SimpleNamespace(data=None)
        if self.columns == "plan_type":
            if self.fake.plan_type_error:
                raise self.fake.plan_type_error
            return SimpleNamespace(data={"plan_type": self.fake.plan_type})
        if self.columns == "email":
            return SimpleNamespace(data={"email": self.fake.email})
        return SimpleNamespace(
            data={"email": self.fake.email, "plan_type": self.fake.plan_type}
        )


class _DailyUsageQuery:
    def __init__(self, fake):
        self.fake = fake
        self.columns = ""

    def select(self, columns):
        self.columns = columns
        return self

    def eq(self, *args):
        return self

    def maybe_single(self):
        return self

    def single(self):
        return self

    def upsert(self, *args, **kwargs):
        self.fake.daily_usage_write_count += 1
        return self

    def execute(self):
        if self.columns in ("*", ""):
            return SimpleNamespace(
                data={
                    "quizzes_used": self.fake.quizzes_used,
                    "extra_quizzes": self.fake.extra_quizzes,
                }
            )
        return SimpleNamespace(data={self.columns: self.fake.quizzes_used})


class _DocumentsQuery:
    def __init__(self, fake):
        self.fake = fake

    def select(self, *args):
        return self

    def eq(self, *args):
        return self

    def execute(self):
        self.fake.document_select_count += 1
        return SimpleNamespace(
            data=[{"id": str(uuid4())} for _ in range(self.fake.document_count)]
        )


def _settings(admin_emails):
    settings = MagicMock(admin_emails=admin_emails)
    settings.get_admin_emails.return_value = {
        email.strip().lower()
        for email in admin_emails.split(",")
        if email.strip()
    }
    return settings

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

def test_is_pro_user_missing_plan_type_column_fails_closed():
    user_id = uuid4()
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception(
        "column users.plan_type does not exist"
    )

    with patch("app.services.usage.supabase_admin", mock_supabase):
        assert usage_service.is_pro_user(user_id) is False

def test_settings_parses_admin_emails_to_normalized_set():
    settings = Settings(
        qdrant_url="http://test",
        qdrant_api_key="test",
        kimi_api_key="test",
        admin_emails=" Owner@Example.com,second@example.com, ,OWNER@example.com ",
    )

    assert settings.get_admin_emails() == {
        "owner@example.com",
        "second@example.com",
    }

def test_admin_email_bypasses_quiz_and_document_gates():
    user_id = uuid4()
    fake_supabase = _FakeSupabase(
        user_id=user_id,
        email="Owner@Example.com",
        plan_type="free",
        quizzes_used=5,
        document_count=2,
    )

    with patch("app.services.usage.get_settings", return_value=_settings("owner@example.com")), \
         patch("app.services.usage.supabase_admin", fake_supabase), \
         patch("app.services.abuse_controls.supabase_admin", fake_supabase):
        assert usage_service.consume_quiz_usage_or_429(user_id) == 0
        abuse_controls.enforce_max_documents(user_id, max_documents=2)

    assert "user_daily_usage" not in fake_supabase.table_calls
    assert fake_supabase.document_select_count == 0

def test_free_user_still_hits_quiz_and_document_gates():
    user_id = uuid4()
    fake_supabase = _FakeSupabase(
        user_id=user_id,
        email="free@example.com",
        plan_type="free",
        quizzes_used=5,
        document_count=2,
    )

    with patch("app.services.usage.get_settings", return_value=_settings("owner@example.com")), \
         patch("app.services.usage.supabase_admin", fake_supabase), \
         patch("app.services.abuse_controls.supabase_admin", fake_supabase):
        with pytest.raises(HTTPException) as quiz_exc:
            usage_service.consume_quiz_usage_or_429(user_id)
        with pytest.raises(HTTPException) as document_exc:
            abuse_controls.enforce_max_documents(user_id, max_documents=2)

    assert quiz_exc.value.status_code == 429
    assert document_exc.value.status_code == 429

def test_consume_quiz_usage_pro_bypass():
    user_id = uuid4()
    
    with patch("app.services.usage.is_pro_user", return_value=True):
        # Should not raise exception and return 0
        result = usage_service.consume_quiz_usage_or_429(user_id)
        assert result == 0

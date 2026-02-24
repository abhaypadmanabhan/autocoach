from sqlalchemy.orm import DeclarativeBase

from sqlalchemy import MetaData, Table, Column
from sqlalchemy.dialects.postgresql import UUID

class Base(DeclarativeBase):
    pass

# Declare the auth.users table for Alembic's cross-schema foreign keys
Table(
    "users",
    Base.metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    schema="auth",
)

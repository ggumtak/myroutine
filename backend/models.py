from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, Column, DateTime, JSON, String
from sqlmodel import Field, SQLModel


class Product(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    category: str
    role: str
    notes: Optional[str] = None
    verified: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    is_active: bool = Field(default=True, sa_column=Column(Boolean))


class TaskDefinition(SQLModel, table=True):
    id: str = Field(primary_key=True)
    slot: str
    task_type: str = Field(sa_column=Column("type", String))
    steps: List[Dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    interval_days: Optional[int] = None
    cron_weekdays: Optional[List[int]] = Field(default=None, sa_column=Column(JSON))


class TaskRecord(SQLModel, table=True):
    """One confirmed outcome (completed/skipped) of a task on one KST date.

    scheduled_date is the KST calendar date the record belongs to (YYYY-MM-DD).
    acted_at is when the user pressed the button, stored as a UTC ISO string so
    the value survives databases that drop timezone information.
    steps is a snapshot of the card steps at the time of recording.
    """

    task_definition_id: str = Field(primary_key=True)
    scheduled_date: str = Field(primary_key=True)
    state: str
    acted_at: str
    slot: str
    task_type: str = Field(sa_column=Column("type", String))
    interval_days: Optional[int] = None
    steps: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))


class AppMeta(SQLModel, table=True):
    """Single row (id=1): data schema version and spec revision counter."""

    id: int = Field(primary_key=True)
    data_version: int = 0
    revision: int = 0


class RulesState(SQLModel, table=True):
    id: int = Field(primary_key=True)
    rules: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    conditions: Dict[str, bool] = Field(default_factory=dict, sa_column=Column(JSON))


# Legacy tables (data_version < 2). Kept so old databases can be migrated into
# TaskRecord; RuleUsage also seeds serum rotation for dates without snapshots.
class TaskStatus(SQLModel, table=True):
    task_definition_id: str = Field(primary_key=True)
    last_completed_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True))
    )
    last_skipped_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True))
    )


class RuleUsage(SQLModel, table=True):
    rule_key: str = Field(primary_key=True)
    last_used_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True))
    )

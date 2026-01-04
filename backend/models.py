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


class TaskStatus(SQLModel, table=True):
    task_definition_id: str = Field(primary_key=True)
    last_completed_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True))
    )
    last_skipped_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True))
    )


class RulesState(SQLModel, table=True):
    id: int = Field(primary_key=True)
    rules: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    conditions: Dict[str, bool] = Field(default_factory=dict, sa_column=Column(JSON))


class RuleUsage(SQLModel, table=True):
    rule_key: str = Field(primary_key=True)
    last_used_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True))
    )

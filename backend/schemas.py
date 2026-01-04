from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TimeResponse(BaseModel):
    nowKstIso: str


class TaskStep(BaseModel):
    step: int
    action: str
    products: List[str]


class TaskCard(BaseModel):
    taskInstanceId: str
    taskDefinitionId: str
    slot: str
    type: str
    state: str
    steps: List[TaskStep]


class TodayResponse(BaseModel):
    date: str
    nowKstIso: str
    cards: List[TaskCard]


class TaskDefinitionBase(BaseModel):
    id: str
    slot: str
    type: str
    steps: List[Dict[str, Any]]
    interval_days: Optional[int] = None
    cron_weekdays: Optional[List[int]] = None


class TaskDefinitionCreate(TaskDefinitionBase):
    pass


class TaskDefinitionUpdate(BaseModel):
    slot: Optional[str] = None
    type: Optional[str] = None
    steps: Optional[List[Dict[str, Any]]] = None
    interval_days: Optional[int] = None
    cron_weekdays: Optional[List[int]] = None


class TaskDefinitionRead(TaskDefinitionBase):
    pass


class CompleteRequest(BaseModel):
    taskInstanceId: str
    completedAtIso: str


class CompleteResponse(BaseModel):
    ok: bool
    taskDefinitionId: str
    completedAtIso: str


class SkipRequest(BaseModel):
    taskInstanceId: str
    skippedAtIso: str


class SkipResponse(BaseModel):
    ok: bool
    taskDefinitionId: str
    skippedAtIso: str


class ProductBase(BaseModel):
    id: str
    name: str
    category: str
    role: str
    notes: Optional[str] = None
    verified: Dict[str, Any] = Field(default_factory=dict)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    role: Optional[str] = None
    notes: Optional[str] = None
    verified: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class ProductRead(ProductBase):
    is_active: bool


class DeleteResponse(BaseModel):
    ok: bool
    id: str


class RulesPatchRequest(BaseModel):
    rules: Optional[Dict[str, Any]] = None
    conditions: Optional[Dict[str, bool]] = None


class RulesResponse(BaseModel):
    rules: Dict[str, Any]
    conditions: Dict[str, bool]


class JsonPatchOperation(BaseModel):
    op: str
    path: str
    from_: Optional[str] = None
    value: Optional[Any] = None


class AiPatchRequest(BaseModel):
    userInstruction: str
    currentSpec: Dict[str, Any]
    apiKey: Optional[str] = None
    modelName: Optional[str] = None


class AiPatchResponse(BaseModel):
    jsonPatch: List[Dict[str, Any]]
    summary: str

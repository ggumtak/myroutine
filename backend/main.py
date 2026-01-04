from __future__ import annotations

from typing import Any, Dict, List

from fastapi import Depends, FastAPI, HTTPException
from sqlmodel import Session, select

from .ai import generate_ai_patch
from .db import get_session, init_db, engine
from .models import Product, RuleUsage, RulesState, TaskDefinition, TaskStatus
from .scheduler import (
    build_today_cards,
    kst_now,
    parse_date,
    parse_iso_datetime,
    parse_task_instance_id,
    select_am_serum,
    select_pm_serum,
)
from .schemas import (
    AiPatchRequest,
    AiPatchResponse,
    CompleteRequest,
    CompleteResponse,
    DeleteResponse,
    TaskDefinitionCreate,
    TaskDefinitionRead,
    TaskDefinitionUpdate,
    ProductCreate,
    ProductRead,
    ProductUpdate,
    RulesPatchRequest,
    RulesResponse,
    SkipRequest,
    SkipResponse,
    TimeResponse,
    TodayResponse,
)
from .seed import (
    DEFAULT_CONDITIONS,
    RULE_KEY_AM_VITC,
    RULE_KEY_PM_HIGH_NIACIN,
    migrate_skincare_tasks,
    migrate_rules,
    seed_if_needed,
)

app = FastAPI()


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    with Session(engine) as session:
        seed_if_needed(session)
        migrate_skincare_tasks(session)
        migrate_rules(session)


def _get_rules_state(session: Session) -> RulesState:
    rules_state = session.exec(select(RulesState)).first()
    if rules_state is None:
        rules_state = RulesState(id=1, rules={}, conditions=DEFAULT_CONDITIONS.copy())
        session.add(rules_state)
        session.commit()
        session.refresh(rules_state)
    else:
        for key, value in DEFAULT_CONDITIONS.items():
            rules_state.conditions.setdefault(key, value)
    return rules_state


def _get_rule_usage(session: Session) -> Dict[str, RuleUsage]:
    return {usage.rule_key: usage for usage in session.exec(select(RuleUsage)).all()}


def _deep_merge(base: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(base)
    for key, value in updates.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _task_definition_to_read(task_def: TaskDefinition) -> TaskDefinitionRead:
    return TaskDefinitionRead(
        id=task_def.id,
        slot=task_def.slot,
        type=task_def.task_type,
        steps=task_def.steps,
        interval_days=task_def.interval_days,
        cron_weekdays=task_def.cron_weekdays,
    )


def _update_rule_usage(
    session: Session,
    rule_key: str,
    completed_at,
    rule_usage: Dict[str, RuleUsage],
) -> None:
    usage = rule_usage.get(rule_key)
    if usage is None:
        usage = RuleUsage(rule_key=rule_key)
    usage.last_used_at = completed_at
    session.add(usage)


def _apply_serum_usage_updates(
    session: Session,
    task_definition_id: str,
    target_date,
    completed_at,
) -> None:
    rules_state = _get_rules_state(session)
    rules = rules_state.rules
    conditions = rules_state.conditions

    if conditions.get("lazy_mode"):
        return

    rule_usage = _get_rule_usage(session)

    vitc_id = rules.get("amSerumRotation", {}).get("vitc", {}).get("productId")
    niacin_id = (
        rules.get("pmSerumRotation", {})
        .get("highNiacinamide", {})
        .get("productId")
    )

    am_selected = select_am_serum(rules, conditions, rule_usage, target_date)

    if task_definition_id == "skin_am" and vitc_id and am_selected == vitc_id:
        _update_rule_usage(session, RULE_KEY_AM_VITC, completed_at, rule_usage)
        return

    if task_definition_id == "skin_pm" and niacin_id:
        pm_selected = select_pm_serum(rules, conditions, rule_usage, target_date, am_selected)
        if pm_selected == niacin_id:
            _update_rule_usage(session, RULE_KEY_PM_HIGH_NIACIN, completed_at, rule_usage)


@app.get("/api/time", response_model=TimeResponse)
def get_time() -> Dict[str, str]:
    return {"nowKstIso": kst_now().isoformat()}


@app.get("/api/today", response_model=TodayResponse)
def get_today(
    date: str | None = None, session: Session = Depends(get_session)
) -> Dict[str, Any]:
    target_date = parse_date(date) if date else kst_now().date()

    task_defs = session.exec(select(TaskDefinition)).all()
    status_map = {
        status.task_definition_id: status
        for status in session.exec(select(TaskStatus)).all()
    }

    rules_state = _get_rules_state(session)
    rule_usage = _get_rule_usage(session)

    cards = build_today_cards(
        task_defs,
        status_map,
        rules_state.rules,
        rules_state.conditions,
        rule_usage,
        target_date,
    )

    return {
        "date": target_date.isoformat(),
        "nowKstIso": kst_now().isoformat(),
        "cards": cards,
    }


@app.post("/api/complete", response_model=CompleteResponse)
def complete_task(
    payload: CompleteRequest, session: Session = Depends(get_session)
) -> Dict[str, Any]:
    try:
        task_definition_id, target_date = parse_task_instance_id(payload.taskInstanceId)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    task_def = session.get(TaskDefinition, task_definition_id)
    if task_def is None:
        raise HTTPException(status_code=404, detail="Task definition not found")

    completed_at = parse_iso_datetime(payload.completedAtIso)
    status = session.get(TaskStatus, task_definition_id)
    if status is None:
        status = TaskStatus(task_definition_id=task_definition_id)

    status.last_completed_at = completed_at
    session.add(status)

    if task_definition_id in {"skin_am", "skin_pm"}:
        _apply_serum_usage_updates(session, task_definition_id, target_date, completed_at)

    session.commit()

    return {
        "ok": True,
        "taskDefinitionId": task_definition_id,
        "completedAtIso": completed_at.isoformat(),
    }


@app.post("/api/skip", response_model=SkipResponse)
def skip_task(payload: SkipRequest, session: Session = Depends(get_session)) -> Dict[str, Any]:
    try:
        task_definition_id, _ = parse_task_instance_id(payload.taskInstanceId)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    task_def = session.get(TaskDefinition, task_definition_id)
    if task_def is None:
        raise HTTPException(status_code=404, detail="Task definition not found")

    skipped_at = parse_iso_datetime(payload.skippedAtIso)
    status = session.get(TaskStatus, task_definition_id)
    if status is None:
        status = TaskStatus(task_definition_id=task_definition_id)

    status.last_skipped_at = skipped_at
    session.add(status)
    session.commit()

    return {
        "ok": True,
        "taskDefinitionId": task_definition_id,
        "skippedAtIso": skipped_at.isoformat(),
    }


@app.get("/api/tasks", response_model=List[TaskDefinitionRead])
def list_task_definitions(session: Session = Depends(get_session)) -> List[TaskDefinitionRead]:
    task_defs = session.exec(select(TaskDefinition)).all()
    return [_task_definition_to_read(task_def) for task_def in task_defs]


@app.post("/api/tasks", response_model=TaskDefinitionRead, status_code=201)
def create_task_definition(
    payload: TaskDefinitionCreate, session: Session = Depends(get_session)
) -> TaskDefinitionRead:
    if session.get(TaskDefinition, payload.id) is not None:
        raise HTTPException(status_code=409, detail="Task definition id already exists")

    task_def = TaskDefinition(
        id=payload.id,
        slot=payload.slot,
        task_type=payload.type,
        steps=payload.steps,
        interval_days=payload.interval_days,
        cron_weekdays=payload.cron_weekdays,
    )
    session.add(task_def)
    session.commit()
    session.refresh(task_def)
    return _task_definition_to_read(task_def)


@app.patch("/api/tasks/{id}", response_model=TaskDefinitionRead)
def update_task_definition(
    id: str, payload: TaskDefinitionUpdate, session: Session = Depends(get_session)
) -> TaskDefinitionRead:
    task_def = session.get(TaskDefinition, id)
    if task_def is None:
        raise HTTPException(status_code=404, detail="Task definition not found")

    if hasattr(payload, "model_dump"):
        updates = payload.model_dump(exclude_unset=True)
    else:
        updates = payload.dict(exclude_unset=True)

    if "type" in updates:
        task_def.task_type = updates.pop("type")

    for key, value in updates.items():
        setattr(task_def, key, value)

    session.add(task_def)
    session.commit()
    session.refresh(task_def)
    return _task_definition_to_read(task_def)


@app.delete("/api/tasks/{id}", response_model=DeleteResponse)
def delete_task_definition(id: str, session: Session = Depends(get_session)) -> Dict[str, Any]:
    task_def = session.get(TaskDefinition, id)
    if task_def is None:
        raise HTTPException(status_code=404, detail="Task definition not found")

    status = session.get(TaskStatus, id)
    if status is not None:
        session.delete(status)

    session.delete(task_def)
    session.commit()
    return {"ok": True, "id": id}


@app.get("/api/products", response_model=List[ProductRead])
def list_products(session: Session = Depends(get_session)) -> List[Product]:
    return session.exec(select(Product).where(Product.is_active == True)).all()


@app.post("/api/products", response_model=ProductRead, status_code=201)
def create_product(
    payload: ProductCreate, session: Session = Depends(get_session)
) -> Product:
    if session.get(Product, payload.id) is not None:
        raise HTTPException(status_code=409, detail="Product id already exists")

    product = Product(
        id=payload.id,
        name=payload.name,
        category=payload.category,
        role=payload.role,
        notes=payload.notes,
        verified=payload.verified,
        is_active=True,
    )
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


@app.patch("/api/products/{id}", response_model=ProductRead)
def update_product(
    id: str, payload: ProductUpdate, session: Session = Depends(get_session)
) -> Product:
    product = session.get(Product, id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    if hasattr(payload, "model_dump"):
        updates = payload.model_dump(exclude_unset=True)
    else:
        updates = payload.dict(exclude_unset=True)
    for key, value in updates.items():
        setattr(product, key, value)

    session.add(product)
    session.commit()
    session.refresh(product)
    return product


@app.delete("/api/products/{id}", response_model=DeleteResponse)
def delete_product(id: str, session: Session = Depends(get_session)) -> Dict[str, Any]:
    product = session.get(Product, id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    product.is_active = False
    session.add(product)
    session.commit()

    return {"ok": True, "id": id}


@app.get("/api/rules", response_model=RulesResponse)
def get_rules(session: Session = Depends(get_session)) -> Dict[str, Any]:
    rules_state = _get_rules_state(session)
    return {"rules": rules_state.rules, "conditions": rules_state.conditions}


@app.patch("/api/rules", response_model=RulesResponse)
def patch_rules(
    payload: RulesPatchRequest, session: Session = Depends(get_session)
) -> Dict[str, Any]:
    rules_state = _get_rules_state(session)

    if payload.rules:
        rules_state.rules = _deep_merge(rules_state.rules, payload.rules)

    if payload.conditions:
        for key, value in payload.conditions.items():
            if key not in DEFAULT_CONDITIONS:
                raise HTTPException(status_code=400, detail=f"Unknown condition: {key}")
            if not isinstance(value, bool):
                raise HTTPException(
                    status_code=400, detail=f"Condition {key} must be boolean"
                )
            rules_state.conditions[key] = value

    session.add(rules_state)
    session.commit()
    session.refresh(rules_state)

    return {"rules": rules_state.rules, "conditions": rules_state.conditions}


@app.post("/api/ai/patch", response_model=AiPatchResponse)
def ai_patch(payload: AiPatchRequest) -> Dict[str, Any]:
    return generate_ai_patch(
        payload.userInstruction,
        payload.currentSpec,
        payload.apiKey,
        payload.modelName,
    )

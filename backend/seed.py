"""Initial seed and one-time, versioned data migrations.

Migrations run once per database (tracked in AppMeta.data_version) and never
on reads, so user edits are not overwritten later.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

from sqlmodel import Session, select

from .config import SEED_PATH
from .models import AppMeta, Product, RulesState, TaskDefinition, TaskRecord, TaskStatus
from .scheduler import RULE_KEY_AM_VITC, RULE_KEY_PM_HIGH_NIACIN, legacy_kst_date, to_utc_iso
from .config import TIMEZONE

DEFAULT_CONDITIONS: Dict[str, bool] = {
    "sensitive": False,
    "irritated": False,
    "dry": False,
    "trouble": False,
    "need_extra_hydration": False,
    "lazy_mode": False,
}

CURRENT_DATA_VERSION = 2

__all__ = [
    "CURRENT_DATA_VERSION",
    "DEFAULT_CONDITIONS",
    "RULE_KEY_AM_VITC",
    "RULE_KEY_PM_HIGH_NIACIN",
    "get_meta",
    "prepare_database",
]

LEGACY_AM_ACTIONS = {"cleanse_optional"}
LEGACY_PM_ACTIONS = {"double_cleanse_if_needed", "optional_toner"}


def _read_seed(path: Path) -> Dict[str, Any]:
    encodings = ["utf-8", "utf-8-sig", "cp949", "utf-16"]
    last_error: Exception | None = None
    for encoding in encodings:
        try:
            return json.loads(path.read_text(encoding=encoding))
        except Exception as exc:  # pragma: no cover - best-effort fallback
            last_error = exc
    raise ValueError(f"Unable to read seed file: {path}") from last_error


def get_meta(session: Session) -> AppMeta:
    meta = session.get(AppMeta, 1)
    if meta is None:
        meta = AppMeta(id=1, data_version=0, revision=0)
        session.add(meta)
    return meta


def _seed(session: Session) -> None:
    data = _read_seed(SEED_PATH)
    for product in data.get("products", []):
        session.add(
            Product(
                id=product["id"],
                name=product["name"],
                category=product["category"],
                role=product["role"],
                notes=product.get("notes"),
                verified=product.get("verified", {}),
                is_active=product.get("is_active", True),
            )
        )
    for task_def in data.get("taskDefinitions", []):
        session.add(
            TaskDefinition(
                id=task_def["id"],
                slot=task_def["slot"],
                task_type=task_def["type"],
                steps=task_def.get("steps", []),
                interval_days=task_def.get("interval_days"),
                cron_weekdays=task_def.get("cron_weekdays"),
            )
        )
    session.add(RulesState(id=1, rules=data.get("rules", {}), conditions=dict(DEFAULT_CONDITIONS)))


def _migrate_to_v2(session: Session) -> None:
    for product in session.exec(select(Product)).all():
        if product.category == "serum":
            product.category = "ampoule"
            session.add(product)

    am_task = session.get(TaskDefinition, "skin_am")
    if am_task and any(s.get("action") in LEGACY_AM_ACTIONS for s in am_task.steps or []):
        am_task.steps = [
            {"step": 1, "action": "apply_serum", "productSelector": "rule_based_serum_am"},
            {"step": 2, "action": "apply_cream", "products": ["cream_minic_barrier"]},
            {"step": 3, "action": "apply_sunscreen", "products": ["sunscreen_mediheal_madecassoside"]},
        ]
        session.add(am_task)

    pm_task = session.get(TaskDefinition, "skin_pm")
    if pm_task and any(s.get("action") in LEGACY_PM_ACTIONS for s in pm_task.steps or []):
        pm_task.steps = [
            {"step": 1, "action": "apply_toner", "products": ["toner_dr_sante_azulene"]},
            {"step": 2, "action": "apply_serum", "productSelector": "rule_based_serum_pm"},
            {"step": 3, "action": "apply_cream", "products": ["cream_minic_barrier"]},
        ]
        session.add(pm_task)

    rules_state = session.exec(select(RulesState)).first()
    if rules_state is None:
        rules_state = RulesState(id=1, rules=_read_seed(SEED_PATH).get("rules", {}), conditions={})
    rules = dict(rules_state.rules or {})
    hydration = rules.get("hydrationBoost")
    if isinstance(hydration, dict) and "autoSeasons" not in hydration:
        rules["hydrationBoost"] = {**hydration, "autoSeasons": ["winter", "fall"]}
    # Assign new objects: in-place edits of JSON columns are not tracked.
    rules_state.rules = rules
    rules_state.conditions = {**DEFAULT_CONDITIONS, **(rules_state.conditions or {})}
    session.add(rules_state)

    # Legacy "last completed/skipped" -> one dated record each. Only what was
    # actually stored is migrated; no history is invented.
    task_defs = {t.id: t for t in session.exec(select(TaskDefinition)).all()}
    for status in session.exec(select(TaskStatus)).all():
        task_def = task_defs.get(status.task_definition_id)
        if task_def is None:
            continue
        entries = []
        if status.last_completed_at is not None:
            entries.append(("completed", status.last_completed_at))
        if status.last_skipped_at is not None:
            entries.append(("skipped", status.last_skipped_at))
        by_date: Dict[str, Any] = {}
        for state, acted in entries:
            day = legacy_kst_date(acted)
            aware = acted if acted.tzinfo else acted.replace(tzinfo=TIMEZONE)
            if day not in by_date or aware > by_date[day][1]:
                by_date[day] = (state, aware)
        for day, (state, aware) in by_date.items():
            if session.get(TaskRecord, (task_def.id, day)) is not None:
                continue
            session.add(
                TaskRecord(
                    task_definition_id=task_def.id,
                    scheduled_date=day,
                    state=state,
                    acted_at=to_utc_iso(aware),
                    slot=task_def.slot,
                    task_type=task_def.task_type,
                    interval_days=task_def.interval_days,
                    steps=None,
                )
            )


def prepare_database(session: Session) -> None:
    """Seed a fresh database or migrate an existing one, exactly once per version."""
    meta = session.get(AppMeta, 1)
    if meta is None:
        has_data = (
            session.exec(select(Product)).first() is not None
            or session.exec(select(TaskDefinition)).first() is not None
            or session.exec(select(RulesState)).first() is not None
        )
        meta = AppMeta(id=1, data_version=1 if has_data else 0, revision=0)
        session.add(meta)

    if meta.data_version == 0:
        _seed(session)
        meta.data_version = CURRENT_DATA_VERSION
    if meta.data_version < 2:
        _migrate_to_v2(session)
        meta.data_version = 2

    session.add(meta)
    session.commit()

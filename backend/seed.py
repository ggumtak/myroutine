from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

from sqlmodel import Session, select

from .config import SEED_PATH
from .models import Product, RuleUsage, RulesState, TaskDefinition, TaskStatus

DEFAULT_CONDITIONS: Dict[str, bool] = {
    "sensitive": False,
    "irritated": False,
    "dry": False,
    "trouble": False,
    "need_extra_hydration": False,
    "lazy_mode": False,
}

RULE_KEY_AM_VITC = "am_vitc"
RULE_KEY_PM_HIGH_NIACIN = "pm_high_niacin"


def _read_seed(path: Path) -> Dict[str, Any]:
    encodings = ["utf-8", "utf-8-sig", "cp949", "utf-16"]
    last_error: Exception | None = None
    for encoding in encodings:
        try:
            return json.loads(path.read_text(encoding=encoding))
        except Exception as exc:  # pragma: no cover - best-effort fallback
            last_error = exc
    raise ValueError(f"Unable to read seed file: {path}") from last_error


def seed_if_needed(session: Session) -> None:
    has_products = session.exec(select(Product)).first() is not None
    has_tasks = session.exec(select(TaskDefinition)).first() is not None
    has_rules = session.exec(select(RulesState)).first() is not None

    if has_products and has_tasks and has_rules:
        return

    seed_path = SEED_PATH
    data = _read_seed(seed_path)

    if not has_products:
        for product in data.get("products", []):
            session.add(
                Product(
                    id=product["id"],
                    name=product["name"],
                    category=product["category"],
                    role=product["role"],
                    notes=product.get("notes"),
                    verified=product.get("verified", {}),
                    is_active=True,
                )
            )

    if not has_tasks:
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
        for task_def in data.get("taskDefinitions", []):
            session.add(TaskStatus(task_definition_id=task_def["id"]))

    if not has_rules:
        rules = data.get("rules", {})
        session.add(RulesState(id=1, rules=rules, conditions=DEFAULT_CONDITIONS.copy()))

    rules = data.get("rules", {})
    am_vitc = rules.get("amSerumRotation", {}).get("vitc")
    pm_niacin = rules.get("pmSerumRotation", {}).get("highNiacinamide")

    if am_vitc and session.get(RuleUsage, RULE_KEY_AM_VITC) is None:
        session.add(RuleUsage(rule_key=RULE_KEY_AM_VITC))

    if pm_niacin and session.get(RuleUsage, RULE_KEY_PM_HIGH_NIACIN) is None:
        session.add(RuleUsage(rule_key=RULE_KEY_PM_HIGH_NIACIN))

    session.commit()


def migrate_skincare_tasks(session: Session) -> None:
    updated = False

    def _has_action(steps: list[dict[str, Any]], action: str) -> bool:
        return any(step.get("action") == action for step in steps)

    am_task = session.get(TaskDefinition, "skin_am")
    if am_task and (
        _has_action(am_task.steps, "cleanse_optional")
        or _has_action(am_task.steps, "apply_toner")
        or not _has_action(am_task.steps, "apply_cream")
    ):
        am_task.steps = [
            {"step": 1, "action": "apply_serum", "productSelector": "rule_based_serum_am"},
            {"step": 2, "action": "apply_cream", "products": ["cream_minic_barrier"]},
            {
                "step": 3,
                "action": "apply_sunscreen",
                "products": ["sunscreen_mediheal_madecassoside"],
            },
        ]
        session.add(am_task)
        updated = True

    pm_task = session.get(TaskDefinition, "skin_pm")
    if pm_task and (
        _has_action(pm_task.steps, "double_cleanse_if_needed")
        or any(step.get("action") == "optional_toner" for step in pm_task.steps)
        or not _has_action(pm_task.steps, "apply_toner")
    ):
        pm_task.steps = [
            {"step": 1, "action": "apply_toner", "products": ["toner_dr_sante_azulene"]},
            {"step": 2, "action": "apply_serum", "productSelector": "rule_based_serum_pm"},
            {"step": 3, "action": "apply_cream", "products": ["cream_minic_barrier"]},
        ]
        session.add(pm_task)
        updated = True

    if updated:
        session.commit()


def migrate_products(session: Session) -> None:
    products = session.exec(select(Product)).all()
    updated = False
    for product in products:
        if product.category == "serum":
            product.category = "ampoule"
            session.add(product)
            updated = True
    if updated:
        session.commit()


def migrate_rules(session: Session) -> None:
    rules_state = session.exec(select(RulesState)).first()
    if rules_state is None:
        return

    rules = rules_state.rules or {}
    hydration = rules.get("hydrationBoost", {})
    if "autoSeasons" not in hydration:
        hydration["autoSeasons"] = ["winter", "fall"]
        rules["hydrationBoost"] = hydration
        rules_state.rules = rules
        session.add(rules_state)
        session.commit()

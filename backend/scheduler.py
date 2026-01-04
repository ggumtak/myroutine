from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

from .config import TIMEZONE
from .models import RuleUsage, TaskDefinition, TaskStatus
from .seed import RULE_KEY_AM_VITC, RULE_KEY_PM_HIGH_NIACIN

SLOT_PRIORITY = {
    "AM": 0,
    "PM": 1,
    "SHOWER": 2,
    "SCALP": 3,
    "SUPP": 4,
}


def kst_now() -> datetime:
    return datetime.now(tz=TIMEZONE)


def parse_iso_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=TIMEZONE)
    return parsed.astimezone(TIMEZONE)


def parse_date(value: str) -> date:
    return date.fromisoformat(value)


def parse_task_instance_id(task_instance_id: str) -> Tuple[str, date]:
    if "|" not in task_instance_id:
        raise ValueError("Invalid taskInstanceId format")
    task_id, date_str = task_instance_id.split("|", 1)
    return task_id, parse_date(date_str)


def _date_or_none(value: Optional[datetime]) -> Optional[date]:
    if value is None:
        return None
    return value.astimezone(TIMEZONE).date()


def _is_due(task_def: TaskDefinition, status: TaskStatus, target_date: date) -> bool:
    if task_def.interval_days is not None:
        last_completed = _date_or_none(status.last_completed_at)
        if last_completed is None:
            return True
        days_since = (target_date - last_completed).days
        return days_since >= task_def.interval_days

    if task_def.cron_weekdays:
        return target_date.weekday() in task_def.cron_weekdays

    return False


def _state_for_date(status: TaskStatus, target_date: date) -> Optional[str]:
    completed_date = _date_or_none(status.last_completed_at)
    skipped_date = _date_or_none(status.last_skipped_at)
    if completed_date == target_date:
        return "completed"
    if skipped_date == target_date:
        return "skipped"
    return None


def _rotation_due(
    last_used_at: Optional[datetime], interval_days: Optional[int], target_date: date
) -> bool:
    if interval_days is None:
        return False
    if last_used_at is None:
        return True
    last_used_date = last_used_at.astimezone(TIMEZONE).date()
    if last_used_date == target_date:
        return True
    days_since = (target_date - last_used_date).days
    return days_since >= interval_days


def _blocked_by_conditions(block_list: Iterable[str], conditions: Dict[str, bool]) -> bool:
    return any(conditions.get(key, False) for key in block_list)


def select_am_serum(
    rules: Dict[str, Any],
    conditions: Dict[str, bool],
    rule_usage: Dict[str, RuleUsage],
    target_date: date,
) -> Optional[str]:
    am_rules = rules.get("amSerumRotation", {})
    default_id = am_rules.get("default")
    vitc_rule = am_rules.get("vitc")
    if not vitc_rule:
        return default_id

    block_list = vitc_rule.get("only_if_condition_not", [])
    if _blocked_by_conditions(block_list, conditions):
        return default_id

    vitc_id = vitc_rule.get("productId")
    interval_days = vitc_rule.get("interval_days")
    usage = rule_usage.get(RULE_KEY_AM_VITC)
    if _rotation_due(usage.last_used_at if usage else None, interval_days, target_date):
        return vitc_id

    return default_id


def select_pm_serum(
    rules: Dict[str, Any],
    conditions: Dict[str, bool],
    rule_usage: Dict[str, RuleUsage],
    target_date: date,
    am_selected: Optional[str],
) -> Optional[str]:
    pm_rules = rules.get("pmSerumRotation", {})
    default_id = pm_rules.get("default")
    niacin_rule = pm_rules.get("highNiacinamide")
    if not niacin_rule:
        return default_id

    block_list = niacin_rule.get("only_if_condition_not", [])
    if _blocked_by_conditions(block_list, conditions):
        return default_id

    constraints = niacin_rule.get("constraints", [])
    if "do_not_pair_with_vitc_same_day" in constraints:
        vitc_id = rules.get("amSerumRotation", {}).get("vitc", {}).get("productId")
        if vitc_id and am_selected == vitc_id:
            return default_id

    niacin_id = niacin_rule.get("productId")
    interval_days = niacin_rule.get("interval_days")
    usage = rule_usage.get(RULE_KEY_PM_HIGH_NIACIN)
    if _rotation_due(usage.last_used_at if usage else None, interval_days, target_date):
        return niacin_id

    return default_id


def _condition_met(condition: Optional[str], conditions: Dict[str, bool]) -> bool:
    if not condition:
        return True
    if condition == "skin_is_dry_or_sensitive":
        return (
            conditions.get("dry", False)
            or conditions.get("sensitive", False)
            or conditions.get("irritated", False)
        )
    return conditions.get(condition, False)


def _apply_hydration_boost(
    products: List[str], rules: Dict[str, Any], conditions: Dict[str, bool]
) -> List[str]:
    toggle_key = rules.get("hydrationBoost", {}).get("toggle")
    product_id = rules.get("hydrationBoost", {}).get("productId")
    if not toggle_key or not product_id:
        return products
    if not conditions.get(toggle_key, False):
        return products
    if product_id in products:
        return products
    return products + [product_id]


def build_task_steps(
    task_def: TaskDefinition,
    rules: Dict[str, Any],
    conditions: Dict[str, bool],
    rule_usage: Dict[str, RuleUsage],
    target_date: date,
    am_selected: Optional[str],
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    if conditions.get("lazy_mode") and task_def.id in {"skin_am", "skin_pm"}:
        key = "am" if task_def.slot == "AM" else "pm"
        products = rules.get("lazyFallback", {}).get(key, [])
        return ([{"step": 1, "action": "apply_products", "products": products}], am_selected)

    steps: List[Dict[str, Any]] = []
    step_number = 1

    for raw_step in task_def.steps:
        if not _condition_met(raw_step.get("condition"), conditions):
            continue

        products = list(raw_step.get("products", []))
        selector = raw_step.get("productSelector")
        if selector == "rule_based_serum_am":
            am_selected = select_am_serum(rules, conditions, rule_usage, target_date)
            products = [am_selected] if am_selected else []
        elif selector == "rule_based_serum_pm":
            products = [
                p
                for p in [
                    select_pm_serum(
                        rules, conditions, rule_usage, target_date, am_selected
                    )
                ]
                if p
            ]

        if raw_step.get("action") == "apply_serum" and products:
            products = _apply_hydration_boost(products, rules, conditions)

        steps.append(
            {
                "step": step_number,
                "action": raw_step.get("action"),
                "products": products,
            }
        )
        step_number += 1

    return steps, am_selected


def build_today_cards(
    task_defs: Iterable[TaskDefinition],
    status_map: Dict[str, TaskStatus],
    rules: Dict[str, Any],
    conditions: Dict[str, bool],
    rule_usage: Dict[str, RuleUsage],
    target_date: date,
) -> List[Dict[str, Any]]:
    candidates: Dict[str, Dict[str, Any]] = {}

    for task_def in task_defs:
        status = status_map.get(task_def.id, TaskStatus(task_definition_id=task_def.id))
        due = _is_due(task_def, status, target_date)
        state = _state_for_date(status, target_date)
        if not due and state is None:
            continue
        if state is None:
            state = "due"

        interval_score = task_def.interval_days or 0
        existing = candidates.get(task_def.slot)
        if existing is None or interval_score > existing["interval_score"]:
            candidates[task_def.slot] = {
                "task_def": task_def,
                "state": state,
                "interval_score": interval_score,
            }

    ordered_slots = sorted(candidates.keys(), key=lambda s: SLOT_PRIORITY.get(s, 99))
    cards: List[Dict[str, Any]] = []
    am_selected: Optional[str] = None

    for slot in ordered_slots:
        candidate = candidates[slot]
        task_def = candidate["task_def"]
        steps, am_selected = build_task_steps(
            task_def, rules, conditions, rule_usage, target_date, am_selected
        )
        cards.append(
            {
                "taskInstanceId": f"{task_def.id}|{target_date.isoformat()}",
                "taskDefinitionId": task_def.id,
                "slot": task_def.slot,
                "type": task_def.task_type,
                "state": candidate["state"],
                "steps": steps,
            }
        )

    return cards

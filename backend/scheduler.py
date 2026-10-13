"""Pure schedule calculation.

Everything here works on plain dicts/strings so the same JSON fixtures
(spec/scheduler-cases.json) can drive both this module and lib/scheduler.ts.
Dates are KST calendar dates as "YYYY-MM-DD" strings.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

from .config import TIMEZONE

SLOT_PRIORITY = {
    "AM": 0,
    "PM": 1,
    "SHOWER": 2,
    "SCALP": 3,
    "SUPP": 4,
}

RULE_KEY_AM_VITC = "am_vitc"
RULE_KEY_PM_HIGH_NIACIN = "pm_high_niacin"

LAZY_TASK_IDS = {"skin_am", "skin_pm"}


# --------------------------------------------------------------------------- time


def kst_now() -> datetime:
    return datetime.now(tz=TIMEZONE)


def kst_today() -> str:
    return kst_now().date().isoformat()


def utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")


def parse_date(value: str) -> date:
    """Strict YYYY-MM-DD parser; raises ValueError otherwise."""
    if not isinstance(value, str) or len(value) != 10:
        raise ValueError(f"Invalid date: {value!r} (expected YYYY-MM-DD)")
    return date.fromisoformat(value)


def parse_iso_datetime(value: str) -> datetime:
    """Parse an ISO timestamp. A value without offset is treated as KST."""
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=TIMEZONE)
    return parsed


def to_utc_iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def legacy_kst_date(value: Optional[datetime]) -> Optional[str]:
    """KST date of a legacy TaskStatus/RuleUsage timestamp.

    The old code always converted to KST before saving; SQLite then dropped the
    offset, so a naive value is a KST wall time (not UTC, not server-local).
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.date().isoformat()
    return value.astimezone(TIMEZONE).date().isoformat()


def parse_task_instance_id(task_instance_id: str) -> Tuple[str, str]:
    if not isinstance(task_instance_id, str) or "|" not in task_instance_id:
        raise ValueError("Invalid taskInstanceId format (expected '{taskId}|YYYY-MM-DD')")
    task_id, date_str = task_instance_id.split("|", 1)
    if not task_id:
        raise ValueError("Invalid taskInstanceId: empty task id")
    parse_date(date_str)
    return task_id, date_str


def _days_between(start: str, end: str) -> int:
    return (date.fromisoformat(end) - date.fromisoformat(start)).days


def _add_days(value: str, days: int) -> str:
    return (date.fromisoformat(value) + timedelta(days=days)).isoformat()


def weekday_of(value: str) -> int:
    """0=Mon .. 6=Sun for a KST calendar date."""
    return date.fromisoformat(value).weekday()


def season_of(value: str) -> str:
    month = int(value[5:7])
    if month in {12, 1, 2}:
        return "winter"
    if month in {3, 4, 5}:
        return "spring"
    if month in {6, 7, 8}:
        return "summer"
    return "fall"


# ------------------------------------------------------------------------ history


class History:
    """Read-only view over date-keyed records."""

    def __init__(self, records: Iterable[Dict[str, Any]], legacy_usage: Optional[Dict[str, str]] = None):
        self.records = sorted(records, key=lambda r: (r["date"], r["taskDefinitionId"]))
        self.legacy_usage = legacy_usage or {}

    def on_date(self, target: str) -> List[Dict[str, Any]]:
        return [r for r in self.records if r["date"] == target]

    def last_completed(self, task_id: str, before: str, inclusive: bool = False) -> Optional[str]:
        last: Optional[str] = None
        for record in self.records:
            if record["taskDefinitionId"] != task_id or record["state"] != "completed":
                continue
            if record["date"] < before or (inclusive and record["date"] == before):
                last = record["date"]
        return last

    def last_product_use(self, product_id: str, before: str) -> Optional[str]:
        last: Optional[str] = None
        for record in self.records:
            if record["state"] != "completed" or record["date"] >= before:
                continue
            for step in record.get("steps") or []:
                if product_id in (step.get("products") or []):
                    last = record["date"]
                    break
        return last


# ------------------------------------------------------------------------- rules


def _rotation_due(
    history: History, rule_key: str, product_id: Optional[str], interval_days: Any, target: str
) -> bool:
    if not product_id or not isinstance(interval_days, int) or interval_days <= 0:
        return False
    legacy = history.legacy_usage.get(rule_key)
    if legacy is not None and legacy > target:
        legacy = None
    if legacy == target:
        return True
    last = history.last_product_use(product_id, target)
    if legacy is not None and (last is None or legacy > last):
        last = legacy
    if last is None:
        return True
    return _days_between(last, target) >= interval_days


def _blocked(block_list: Iterable[str], conditions: Dict[str, bool]) -> bool:
    return any(conditions.get(key, False) for key in block_list or [])


def select_am_serum(
    rules: Dict[str, Any], conditions: Dict[str, bool], history: History, target: str
) -> Tuple[Optional[str], str]:
    am_rules = rules.get("amSerumRotation") or {}
    default_id = am_rules.get("default")
    vitc = am_rules.get("vitc")
    if not vitc:
        return default_id, "default"
    if _blocked(vitc.get("only_if_condition_not", []), conditions):
        return default_id, "vitc_blocked_condition"
    if _rotation_due(history, RULE_KEY_AM_VITC, vitc.get("productId"), vitc.get("interval_days"), target):
        return vitc.get("productId"), "vitc_due"
    return default_id, "vitc_resting"


def select_pm_serum(
    rules: Dict[str, Any],
    conditions: Dict[str, bool],
    history: History,
    target: str,
    am_selected: Optional[str],
) -> Tuple[Optional[str], str]:
    pm_rules = rules.get("pmSerumRotation") or {}
    default_id = pm_rules.get("default")
    niacin = pm_rules.get("highNiacinamide")
    if not niacin:
        return default_id, "default"
    if _blocked(niacin.get("only_if_condition_not", []), conditions):
        return default_id, "niacin_blocked_condition"
    if "do_not_pair_with_vitc_same_day" in (niacin.get("constraints") or []):
        vitc_id = ((rules.get("amSerumRotation") or {}).get("vitc") or {}).get("productId")
        if vitc_id and am_selected == vitc_id:
            return default_id, "niacin_paired_with_vitc"
    if _rotation_due(
        history, RULE_KEY_PM_HIGH_NIACIN, niacin.get("productId"), niacin.get("interval_days"), target
    ):
        return niacin.get("productId"), "niacin_due"
    return default_id, "niacin_resting"


def _condition_met(condition: Optional[str], conditions: Dict[str, bool]) -> bool:
    if not condition:
        return True
    if condition == "skin_is_dry_or_sensitive":
        return bool(
            conditions.get("dry", False)
            or conditions.get("sensitive", False)
            or conditions.get("irritated", False)
        )
    return bool(conditions.get(condition, False))


def _hydration(rules: Dict[str, Any], conditions: Dict[str, bool], target: str) -> Tuple[Optional[str], Optional[str]]:
    rule = rules.get("hydrationBoost") or {}
    product_id = rule.get("productId")
    if not product_id:
        return None, None
    toggle = rule.get("toggle")
    if toggle and conditions.get(toggle, False):
        return product_id, "hydration_toggle"
    if season_of(target) in (rule.get("autoSeasons") or []):
        return product_id, "hydration_season"
    return None, None


def _finalize_serum(
    selected: Optional[str],
    reason: str,
    default_id: Optional[str],
    rules: Dict[str, Any],
    conditions: Dict[str, bool],
    inactive: Set[str],
    target: str,
) -> Tuple[Optional[str], str]:
    if selected and selected in inactive and selected != default_id:
        selected, reason = default_id, "inactive_fallback"
    if selected and selected == default_id:
        hydration_id, hydration_reason = _hydration(rules, conditions, target)
        if hydration_id and hydration_id not in inactive:
            selected, reason = hydration_id, hydration_reason or reason
    if selected and selected in inactive:
        return None, "no_active_product"
    if not selected:
        return None, "no_active_product"
    return selected, reason


def build_task_steps(
    task_def: Dict[str, Any],
    rules: Dict[str, Any],
    conditions: Dict[str, bool],
    history: History,
    target: str,
    am_selected: Optional[str],
    inactive: Set[str],
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    if conditions.get("lazy_mode") and task_def["id"] in LAZY_TASK_IDS:
        key = "am" if task_def["slot"] == "AM" else "pm"
        products = [p for p in ((rules.get("lazyFallback") or {}).get(key) or []) if p not in inactive]
        return [{"step": 1, "action": "apply_products", "products": products, "reason": "lazy_mode"}], am_selected

    steps: List[Dict[str, Any]] = []
    for raw in task_def.get("steps") or []:
        if not _condition_met(raw.get("condition"), conditions):
            continue
        step: Dict[str, Any] = {"step": len(steps) + 1, "action": raw.get("action")}
        selector = raw.get("productSelector")
        if selector == "rule_based_serum_am":
            default_id = (rules.get("amSerumRotation") or {}).get("default")
            selected, reason = select_am_serum(rules, conditions, history, target)
            selected, reason = _finalize_serum(selected, reason, default_id, rules, conditions, inactive, target)
            am_selected = selected
            step["products"] = [selected] if selected else []
            step["reason"] = reason
        elif selector == "rule_based_serum_pm":
            default_id = (rules.get("pmSerumRotation") or {}).get("default")
            selected, reason = select_pm_serum(rules, conditions, history, target, am_selected)
            selected, reason = _finalize_serum(selected, reason, default_id, rules, conditions, inactive, target)
            step["products"] = [selected] if selected else []
            step["reason"] = reason
        else:
            step["products"] = [p for p in (raw.get("products") or []) if p not in inactive]
        steps.append(step)
    return steps, am_selected


def is_due(task_def: Dict[str, Any], history: History, target: str, today: str) -> bool:
    interval = task_def.get("interval_days")
    if isinstance(interval, int) and interval > 0:
        if target > today:
            # Preview: assume every due occurrence from today on gets done on time.
            base = history.last_completed(task_def["id"], today, inclusive=True)
            first = _add_days(base, interval) if base else today
            if first < today:
                first = today
            if target < first:
                return False
            return _days_between(first, target) % interval == 0
        last = history.last_completed(task_def["id"], target)
        return last is None or _days_between(last, target) >= interval

    weekdays = task_def.get("cron_weekdays")
    if weekdays:
        return weekday_of(target) in weekdays
    return False


def _vitc_in_steps(steps: List[Dict[str, Any]], rules: Dict[str, Any]) -> Optional[str]:
    """The AM vitamin C product if these AM steps use it (for same-day pairing)."""
    vitc_id = (((rules.get("amSerumRotation") or {}).get("vitc")) or {}).get("productId")
    if vitc_id and any(vitc_id in (s.get("products") or []) for s in steps):
        return vitc_id
    return None


def _interval_score(task_def: Optional[Dict[str, Any]], fallback: Any = None) -> int:
    value = task_def.get("interval_days") if task_def else fallback
    return value if isinstance(value, int) else 0


def _slot_key(slot: str) -> Tuple[int, str]:
    return (SLOT_PRIORITY.get(slot, 99), slot)


def build_cards(
    task_defs: List[Dict[str, Any]],
    records: Iterable[Dict[str, Any]],
    rules: Dict[str, Any],
    conditions: Dict[str, bool],
    target: str,
    today: str,
    inactive_product_ids: Optional[Iterable[str]] = None,
    legacy_usage: Optional[Dict[str, str]] = None,
) -> List[Dict[str, Any]]:
    history = History(records, legacy_usage)
    inactive = set(inactive_product_ids or [])
    defs_by_id = {d["id"]: d for d in task_defs}

    # slot -> (score, task_def or None, record or None)
    chosen: Dict[str, Tuple[int, Optional[Dict[str, Any]], Optional[Dict[str, Any]]]] = {}

    for record in history.on_date(target):
        task_def = defs_by_id.get(record["taskDefinitionId"])
        score = _interval_score(task_def, record.get("interval_days"))
        slot = record["slot"]
        if slot not in chosen or score > chosen[slot][0]:
            chosen[slot] = (score, task_def, record)

    recorded_slots = set(chosen)
    for task_def in task_defs:
        slot = task_def["slot"]
        if slot in recorded_slots or not is_due(task_def, history, target, today):
            continue
        score = _interval_score(task_def)
        if slot not in chosen or score > chosen[slot][0]:
            chosen[slot] = (score, task_def, None)

    cards: List[Dict[str, Any]] = []
    am_selected: Optional[str] = None

    for slot in sorted(chosen, key=_slot_key):
        _, task_def, record = chosen[slot]
        if record is not None and record.get("steps") is not None:
            steps = record["steps"]
            if slot == "AM":
                am_selected = _vitc_in_steps(steps, rules)
        elif task_def is not None:
            steps, am_selected = build_task_steps(
                task_def, rules, conditions, history, target, am_selected, inactive
            )
        else:
            steps = []

        task_id = record["taskDefinitionId"] if record else task_def["id"]
        cards.append(
            {
                "taskInstanceId": f"{task_id}|{target}",
                "taskDefinitionId": task_id,
                "slot": slot,
                "type": record["type"] if record else task_def["type"],
                "state": record["state"] if record else "due",
                "steps": steps,
                "recorded": record is not None,
                "actedAtIso": record["actedAtIso"] if record else None,
            }
        )
    return cards


def steps_for_record(
    task_def: Dict[str, Any],
    task_defs: List[Dict[str, Any]],
    records: Iterable[Dict[str, Any]],
    rules: Dict[str, Any],
    conditions: Dict[str, bool],
    target: str,
    today: str,
    inactive_product_ids: Optional[Iterable[str]] = None,
    legacy_usage: Optional[Dict[str, str]] = None,
) -> List[Dict[str, Any]]:
    """Steps to snapshot when recording task_def on target.

    Any existing record of the same task on that date is ignored, so the
    snapshot reflects the current rules (re-recording replaces it).
    """
    others = [
        r for r in records
        if not (r["taskDefinitionId"] == task_def["id"] and r["date"] == target)
    ]
    cards = build_cards(task_defs, others, rules, conditions, target, today, inactive_product_ids, legacy_usage)
    for card in cards:
        if card["taskDefinitionId"] == task_def["id"] and not card["recorded"]:
            return card["steps"]

    am_selected: Optional[str] = None
    for card in cards:
        if card["slot"] == "AM":
            am_selected = _vitc_in_steps(card["steps"], rules)
    steps, _ = build_task_steps(
        task_def,
        rules,
        conditions,
        History(others, legacy_usage),
        target,
        am_selected,
        set(inactive_product_ids or []),
    )
    return steps

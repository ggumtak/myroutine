"""Spec validation shared by every write path (rules, tasks, products, AI, restore).

Mirrors lib/validation.ts; spec/validation-cases.json drives both.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

CONDITION_KEYS = (
    "sensitive",
    "irritated",
    "dry",
    "trouble",
    "need_extra_hydration",
    "lazy_mode",
)
STEP_CONDITIONS = set(CONDITION_KEYS) | {"skin_is_dry_or_sensitive"}
SLOTS = {"AM", "PM", "SHOWER", "SCALP", "SUPP"}
SELECTORS = {"rule_based_serum_am", "rule_based_serum_pm"}
SEASONS = {"winter", "spring", "summer", "fall"}
CONSTRAINTS = {"do_not_pair_with_vitc_same_day"}

Issues = Tuple[List[str], List[str]]


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _non_empty_str(value: Any) -> bool:
    return isinstance(value, str) and value.strip() != ""


class _Checker:
    def __init__(self, products: List[Dict[str, Any]]):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.product_ids = {p.get("id") for p in products if isinstance(p, dict)}
        self.inactive_ids = {
            p.get("id") for p in products if isinstance(p, dict) and p.get("is_active") is False
        }

    def error(self, path: str, message: str) -> None:
        self.errors.append(f"{path}: {message}")

    def product_ref(self, path: str, value: Any) -> None:
        if not _non_empty_str(value):
            self.error(path, "제품 ID 문자열이어야 합니다")
        elif value not in self.product_ids:
            self.error(path, f"없는 제품입니다 ({value})")
        elif value in self.inactive_ids:
            self.warnings.append(f"{path}: 비활성 제품을 참조합니다 ({value})")

    def product_list(self, path: str, value: Any) -> None:
        if not isinstance(value, list):
            self.error(path, "제품 ID 목록이어야 합니다")
            return
        for index, item in enumerate(value):
            self.product_ref(f"{path}[{index}]", item)

    def interval(self, path: str, value: Any) -> None:
        if not _is_int(value) or value < 1:
            self.error(path, "1 이상의 정수여야 합니다")

    def condition_list(self, path: str, value: Any) -> None:
        if not isinstance(value, list) or any(v not in CONDITION_KEYS for v in value):
            self.error(path, f"컨디션 이름 목록이어야 합니다 ({', '.join(CONDITION_KEYS)})")


def _check_products(c: _Checker, products: Any) -> None:
    if not isinstance(products, list):
        c.error("products", "목록이어야 합니다")
        return
    seen = set()
    for index, product in enumerate(products):
        path = f"products[{index}]"
        if not isinstance(product, dict):
            c.error(path, "객체여야 합니다")
            continue
        pid = product.get("id")
        if not _non_empty_str(pid):
            c.error(f"{path}.id", "비어 있을 수 없습니다")
        elif pid in seen:
            c.error(f"{path}.id", f"중복된 제품 ID입니다 ({pid})")
        seen.add(pid)
        for key in ("name", "category", "role"):
            if not _non_empty_str(product.get(key)):
                c.error(f"{path}.{key}", "비어 있을 수 없습니다")
        if product.get("notes") is not None and not isinstance(product.get("notes"), str):
            c.error(f"{path}.notes", "문자열이어야 합니다")
        if product.get("verified") is not None and not isinstance(product.get("verified"), dict):
            c.error(f"{path}.verified", "객체여야 합니다")
        if "is_active" in product and not isinstance(product.get("is_active"), bool):
            c.error(f"{path}.is_active", "true/false여야 합니다")


def _check_tasks(c: _Checker, tasks: Any) -> None:
    if not isinstance(tasks, list):
        c.error("taskDefinitions", "목록이어야 합니다")
        return
    seen = set()
    for index, task in enumerate(tasks):
        path = f"taskDefinitions[{index}]"
        if not isinstance(task, dict):
            c.error(path, "객체여야 합니다")
            continue
        tid = task.get("id")
        if not _non_empty_str(tid) or "|" in tid:
            c.error(f"{path}.id", "비어 있지 않고 '|'가 없는 문자열이어야 합니다")
        elif tid in seen:
            c.error(f"{path}.id", f"중복된 루틴 ID입니다 ({tid})")
        seen.add(tid)
        if task.get("slot") not in SLOTS:
            c.error(f"{path}.slot", f"{', '.join(sorted(SLOTS))} 중 하나여야 합니다")
        if not _non_empty_str(task.get("type")):
            c.error(f"{path}.type", "비어 있을 수 없습니다")

        interval = task.get("interval_days")
        weekdays = task.get("cron_weekdays")
        if interval is not None:
            c.interval(f"{path}.interval_days", interval)
        if weekdays is not None:
            if (
                not isinstance(weekdays, list)
                or not weekdays
                or any(not _is_int(d) or d < 0 or d > 6 for d in weekdays)
                or len(set(weekdays)) != len(weekdays)
            ):
                c.error(f"{path}.cron_weekdays", "0(월)~6(일) 사이의 중복 없는 정수 목록이어야 합니다")
        if interval is None and not weekdays:
            c.error(path, "interval_days 또는 cron_weekdays 중 하나가 필요합니다")

        steps = task.get("steps")
        if not isinstance(steps, list):
            c.error(f"{path}.steps", "목록이어야 합니다")
            continue
        for s_index, step in enumerate(steps):
            s_path = f"{path}.steps[{s_index}]"
            if not isinstance(step, dict):
                c.error(s_path, "객체여야 합니다")
                continue
            if not _non_empty_str(step.get("action")):
                c.error(f"{s_path}.action", "비어 있을 수 없습니다")
            selector = step.get("productSelector")
            if selector is not None and selector not in SELECTORS:
                c.error(f"{s_path}.productSelector", f"{', '.join(sorted(SELECTORS))} 중 하나여야 합니다")
            if step.get("products") is not None:
                c.product_list(f"{s_path}.products", step.get("products"))
            condition = step.get("condition")
            if condition is not None and condition not in STEP_CONDITIONS:
                c.error(f"{s_path}.condition", f"알 수 없는 조건입니다 ({condition})")


def _check_rules(c: _Checker, rules: Any) -> None:
    if not isinstance(rules, dict):
        c.error("rules", "객체여야 합니다")
        return

    am = rules.get("amSerumRotation")
    if am is not None:
        if not isinstance(am, dict):
            c.error("rules.amSerumRotation", "객체여야 합니다")
        else:
            c.product_ref("rules.amSerumRotation.default", am.get("default"))
            vitc = am.get("vitc")
            if vitc is not None:
                if not isinstance(vitc, dict):
                    c.error("rules.amSerumRotation.vitc", "객체여야 합니다")
                else:
                    c.product_ref("rules.amSerumRotation.vitc.productId", vitc.get("productId"))
                    c.interval("rules.amSerumRotation.vitc.interval_days", vitc.get("interval_days"))
                    c.condition_list(
                        "rules.amSerumRotation.vitc.only_if_condition_not",
                        vitc.get("only_if_condition_not", []),
                    )

    pm = rules.get("pmSerumRotation")
    if pm is not None:
        if not isinstance(pm, dict):
            c.error("rules.pmSerumRotation", "객체여야 합니다")
        else:
            c.product_ref("rules.pmSerumRotation.default", pm.get("default"))
            niacin = pm.get("highNiacinamide")
            if niacin is not None:
                base = "rules.pmSerumRotation.highNiacinamide"
                if not isinstance(niacin, dict):
                    c.error(base, "객체여야 합니다")
                else:
                    c.product_ref(f"{base}.productId", niacin.get("productId"))
                    c.interval(f"{base}.interval_days", niacin.get("interval_days"))
                    c.condition_list(f"{base}.only_if_condition_not", niacin.get("only_if_condition_not", []))
                    constraints = niacin.get("constraints", [])
                    if not isinstance(constraints, list) or any(v not in CONSTRAINTS for v in constraints):
                        c.error(f"{base}.constraints", f"{', '.join(sorted(CONSTRAINTS))}만 사용할 수 있습니다")

    hydration = rules.get("hydrationBoost")
    if hydration is not None:
        if not isinstance(hydration, dict):
            c.error("rules.hydrationBoost", "객체여야 합니다")
        else:
            c.product_ref("rules.hydrationBoost.productId", hydration.get("productId"))
            toggle = hydration.get("toggle")
            if toggle is not None and toggle not in CONDITION_KEYS:
                c.error("rules.hydrationBoost.toggle", f"알 수 없는 컨디션입니다 ({toggle})")
            seasons = hydration.get("autoSeasons", [])
            if not isinstance(seasons, list) or any(v not in SEASONS for v in seasons):
                c.error("rules.hydrationBoost.autoSeasons", "winter, spring, summer, fall 중에서 골라야 합니다")

    lazy = rules.get("lazyFallback")
    if lazy is not None:
        if not isinstance(lazy, dict):
            c.error("rules.lazyFallback", "객체여야 합니다")
        else:
            for key in ("am", "pm"):
                if key in lazy:
                    c.product_list(f"rules.lazyFallback.{key}", lazy.get(key))


def _check_conditions(c: _Checker, conditions: Any) -> None:
    if not isinstance(conditions, dict):
        c.error("conditions", "객체여야 합니다")
        return
    for key, value in conditions.items():
        if key not in CONDITION_KEYS:
            c.error(f"conditions.{key}", "알 수 없는 컨디션입니다")
        elif not isinstance(value, bool):
            c.error(f"conditions.{key}", "true/false여야 합니다")


def validate_spec(spec: Dict[str, Any]) -> Issues:
    """Return (errors, warnings) for a full spec document."""
    products = spec.get("products")
    c = _Checker(products if isinstance(products, list) else [])
    _check_products(c, products)
    _check_tasks(c, spec.get("taskDefinitions"))
    _check_rules(c, spec.get("rules"))
    _check_conditions(c, spec.get("conditions"))
    return c.errors, c.warnings

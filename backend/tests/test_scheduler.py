from datetime import date

from backend.models import RuleUsage, TaskDefinition, TaskStatus
from backend.scheduler import build_today_cards, select_am_serum, select_pm_serum
from backend.seed import RULE_KEY_AM_VITC, RULE_KEY_PM_HIGH_NIACIN


def test_slot_prefers_longer_interval():
    task_defs = [
        TaskDefinition(
            id="shower_normal",
            slot="SHOWER",
            task_type="hygiene",
            steps=[],
            interval_days=1,
        ),
        TaskDefinition(
            id="scalp_scale_day",
            slot="SHOWER",
            task_type="scalp",
            steps=[],
            interval_days=4,
        ),
    ]
    status_map = {
        "shower_normal": TaskStatus(task_definition_id="shower_normal"),
        "scalp_scale_day": TaskStatus(task_definition_id="scalp_scale_day"),
    }

    cards = build_today_cards(
        task_defs,
        status_map,
        rules={},
        conditions={},
        rule_usage={},
        target_date=date(2026, 1, 4),
    )

    assert len(cards) == 1
    assert cards[0]["taskDefinitionId"] == "scalp_scale_day"


def test_serum_selection_constraints():
    rules = {
        "amSerumRotation": {
            "default": "serum_default",
            "vitc": {
                "productId": "serum_vitc",
                "interval_days": 2,
                "only_if_condition_not": ["sensitive", "irritated"],
            },
        },
        "pmSerumRotation": {
            "default": "serum_default",
            "highNiacinamide": {
                "productId": "serum_niacin",
                "interval_days": 4,
                "only_if_condition_not": ["sensitive", "irritated"],
                "constraints": ["do_not_pair_with_vitc_same_day"],
            },
        },
    }
    conditions = {
        "sensitive": False,
        "irritated": False,
        "dry": False,
        "trouble": False,
        "need_extra_hydration": False,
        "lazy_mode": False,
    }
    rule_usage = {
        RULE_KEY_AM_VITC: RuleUsage(rule_key=RULE_KEY_AM_VITC, last_used_at=None),
        RULE_KEY_PM_HIGH_NIACIN: RuleUsage(
            rule_key=RULE_KEY_PM_HIGH_NIACIN, last_used_at=None
        ),
    }

    am_selected = select_am_serum(rules, conditions, rule_usage, date(2026, 1, 4))
    pm_selected = select_pm_serum(
        rules, conditions, rule_usage, date(2026, 1, 4), am_selected
    )

    assert am_selected == "serum_vitc"
    assert pm_selected == "serum_default"


def test_hydration_boost_overrides_default_only():
    task_defs = [
        TaskDefinition(
            id="skin_am",
            slot="AM",
            task_type="skincare",
            steps=[{"step": 1, "action": "apply_serum", "productSelector": "rule_based_serum_am"}],
            interval_days=1,
        )
    ]
    status_map = {"skin_am": TaskStatus(task_definition_id="skin_am")}

    rules = {
        "amSerumRotation": {
            "default": "serum_default",
            "vitc": {
                "productId": "serum_vitc",
                "interval_days": 2,
                "only_if_condition_not": ["sensitive", "irritated"],
            },
        },
        "hydrationBoost": {"productId": "ampoule_hydration", "toggle": "need_extra_hydration"},
    }
    conditions = {
        "sensitive": False,
        "irritated": False,
        "dry": False,
        "trouble": False,
        "need_extra_hydration": True,
        "lazy_mode": False,
    }
    rule_usage = {
        RULE_KEY_AM_VITC: RuleUsage(
            rule_key=RULE_KEY_AM_VITC, last_used_at=date(2026, 1, 3)
        )
    }

    cards = build_today_cards(
        task_defs,
        status_map,
        rules=rules,
        conditions=conditions,
        rule_usage=rule_usage,
        target_date=date(2026, 1, 4),
    )

    assert cards[0]["steps"][0]["products"] == ["ampoule_hydration"]

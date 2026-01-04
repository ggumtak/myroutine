from __future__ import annotations

import json
from typing import Any, Dict

import jsonpatch
import requests
from fastapi import HTTPException

from .config import GEMINI_API_KEY, MODEL_NAME

SYSTEM_PROMPT = """
You are the AI assistant for a personal routine manager.
Generate a JSON Patch (RFC 6902) against currentSpec.

Return ONLY a JSON object with:
- jsonPatch: array of patch ops
- summary: short string explaining changes or answering a question

Rules:
- If the user asks a general question or no data change is needed, return an empty jsonPatch and answer in summary.
- Only edit fields inside currentSpec (rules, conditions, products, taskDefinitions).
- Use minimal changes and keep existing ids stable.

Data model hints:
- products: {id, name, category, role, notes?, verified?, is_active?}
  categories: toner, serum, ampoule, cream, sunscreen, makeup, all_in_one, scalp
  roles: optional_soothing, daily_calm, am_brightening, pm_active_high_niacinamide,
         hydration_boost_optional, daily_barrier_main, barrier_backup, daily_spf_must,
         optional_cosmetic, lazy_fallback, scalp_scale, optional_active, optional_repair,
         post_shower_tonic
- taskDefinitions: {id, slot, type, steps, interval_days?, cron_weekdays?}
  slots: AM, PM, SHOWER, SUPP
  types: skincare, hygiene, scalp, mask
  steps: list of objects with action, products?, productSelector?, condition?
"""


def _extract_json(text: str) -> Dict[str, Any]:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in model response")
    return json.loads(text[start : end + 1])


def generate_ai_patch(
    user_instruction: str,
    current_spec: Dict[str, Any],
    api_key: str | None = None,
    model_name: str | None = None,
) -> Dict[str, Any]:
    api_key = api_key or GEMINI_API_KEY
    model_name = model_name or MODEL_NAME
    if not api_key or not model_name:
        return {
            "jsonPatch": [],
            "summary": "AI not configured. Set GEMINI_API_KEY and MODEL_NAME.",
        }

    prompt = (
        f"{SYSTEM_PROMPT}\n"
        "Use paths relative to currentSpec.\n\n"
        f"Instruction: {user_instruction}\n\n"
        f"currentSpec: {json.dumps(current_spec, ensure_ascii=False)}"
    )

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_name}:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2},
    }

    response = requests.post(url, json=payload, timeout=30)
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="AI provider error")

    data = response.json()
    text = ""
    for candidate in data.get("candidates", []):
        parts = candidate.get("content", {}).get("parts", [])
        if parts:
            text = parts[0].get("text", "")
            break

    if not text:
        raise HTTPException(status_code=502, detail="AI provider returned no content")

    parsed = _extract_json(text)
    json_patch = parsed.get("jsonPatch", [])
    summary = parsed.get("summary", "")

    try:
        patch = jsonpatch.JsonPatch(json_patch)
        patch.apply(current_spec, in_place=False)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=400, detail="Invalid JSON Patch") from exc

    return {"jsonPatch": json_patch, "summary": summary}

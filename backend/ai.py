from __future__ import annotations

import json
from typing import Any, Dict

import jsonpatch
import requests
from fastapi import HTTPException

from .config import GEMINI_API_KEY, MODEL_NAME


def _extract_json(text: str) -> Dict[str, Any]:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in model response")
    return json.loads(text[start : end + 1])


def generate_ai_patch(user_instruction: str, current_spec: Dict[str, Any]) -> Dict[str, Any]:
    if not GEMINI_API_KEY or not MODEL_NAME:
        return {
            "jsonPatch": [],
            "summary": "AI not configured. Set GEMINI_API_KEY and MODEL_NAME.",
        }

    prompt = (
        "You are a JSON Patch generator. Return ONLY a JSON object with keys "
        "'jsonPatch' (RFC6902 array) and 'summary' (string). "
        "Use paths relative to the provided currentSpec.\n\n"
        f"Instruction: {user_instruction}\n\n"
        f"currentSpec: {json.dumps(current_spec, ensure_ascii=False)}"
    )

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"
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

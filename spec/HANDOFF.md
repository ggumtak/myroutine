# Frontend Handoff

## Base URL
- Default: same-origin
- Env override: API_BASE_URL

## Endpoints Summary
- GET /api/time
- GET /api/today?date=YYYY-MM-DD
- POST /api/complete
- POST /api/skip
- GET /api/products
- POST /api/products
- PATCH /api/products/{id}
- DELETE /api/products/{id}
- GET /api/rules
- PATCH /api/rules
- POST /api/ai/patch

## DTO Examples

### GET /api/time
Response:
{
  "nowKstIso": "2026-01-04T12:10:00+09:00"
}

### GET /api/today?date=2026-01-04
Response:
{
  "date": "2026-01-04",
  "nowKstIso": "2026-01-04T12:10:00+09:00",
  "cards": [
    {
      "taskInstanceId": "skin_am|2026-01-04",
      "taskDefinitionId": "skin_am",
      "slot": "AM",
      "type": "skincare",
      "state": "due",
      "steps": [
        {"step": 1, "action": "cleanse_optional", "products": []},
        {"step": 2, "action": "apply_serum", "products": ["serum_uiq_vita_c"]},
        {"step": 3, "action": "apply_sunscreen", "products": ["sunscreen_mediheal_madecassoside"]}
      ]
    }
  ]
}

### POST /api/complete
Request:
{
  "taskInstanceId": "skin_am|2026-01-04",
  "completedAtIso": "2026-01-04T08:10:00+09:00"
}
Response:
{
  "ok": true,
  "taskDefinitionId": "skin_am",
  "completedAtIso": "2026-01-04T08:10:00+09:00"
}

### POST /api/skip
Request:
{
  "taskInstanceId": "skin_pm|2026-01-04",
  "skippedAtIso": "2026-01-04T23:50:00+09:00"
}
Response:
{
  "ok": true,
  "taskDefinitionId": "skin_pm",
  "skippedAtIso": "2026-01-04T23:50:00+09:00"
}

### GET /api/products
Response (list):
[
  {
    "id": "serum_parnell_cicamanu_92",
    "name": "파넬 시카마누 92세럼",
    "category": "serum",
    "role": "daily_calm",
    "notes": null,
    "verified": {"type": "full_inci_verified"},
    "is_active": true
  }
]

### GET /api/rules
Response:
{
  "rules": { /* from seed.json rules */ },
  "conditions": {
    "sensitive": false,
    "irritated": false,
    "dry": false,
    "trouble": false,
    "need_extra_hydration": false,
    "lazy_mode": false
  }
}

### PATCH /api/rules
Request:
{
  "conditions": {
    "sensitive": true,
    "need_extra_hydration": true
  }
}
Response:
{
  "rules": { /* unchanged unless rules updated */ },
  "conditions": {
    "sensitive": true,
    "irritated": false,
    "dry": false,
    "trouble": false,
    "need_extra_hydration": true,
    "lazy_mode": false
  }
}

### POST /api/ai/patch
Request:
{
  "userInstruction": "비타C를 주 2회로 줄여",
  "currentSpec": { "rules": { /* current rules */ } }
}
Response:
{
  "jsonPatch": [
    {"op": "replace", "path": "/rules/amSerumRotation/vitc/interval_days", "value": 3}
  ],
  "summary": "Reduce AM vitamin C rotation interval to every 3 days."
}

## Page-by-Page API Needs

### / (Dashboard)
- GET /api/time for live KST clock.
- GET /api/today for today's cards (AM/PM/SHOWER).
- POST /api/complete and /api/skip from card actions.
- PATCH /api/rules when condition toggles change (sensitive/dry/trouble/need_extra_hydration/lazy_mode).

### /calendar
- GET /api/today?date=YYYY-MM-DD for the selected date.

### /products
- GET /api/products list.
- POST /api/products add.
- PATCH /api/products/{id} edit.
- DELETE /api/products/{id} deactivate.

### /rules
- GET /api/rules initial load.
- PATCH /api/rules to update rule values or condition toggles.

### /ai
- POST /api/ai/patch with userInstruction + currentSpec.
- Apply returned JSON Patch using PATCH /api/rules or PATCH /api/products as appropriate.

## Notes
- taskInstanceId format is "{taskDefinitionId}|{YYYY-MM-DD}".
- If multiple tasks share a slot, the backend returns only the highest-interval task for that slot on that date.

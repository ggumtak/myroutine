# Routine Scheduler Spec

## Purpose
A single-user routine scheduler that keeps skincare, shower, scalp, and supplement tasks on a simple 3-4 step cadence. The backend is the source of truth for rules, scheduling, and product data so the frontend can render a daily checklist.

## Core UX
- Show today's cards by slot (AM, PM, SHOWER, SUPP when added).
- Each card lists steps and chosen products.
- Users can complete or skip a card; the schedule is based on last completion.
- Condition toggles change today's selections (ex: sensitive disables vitamin C/high niacin).

## Data Model Overview
- Products: id, name, category, role, notes, verified, active.
- Task definitions: slot, steps, recurrence (interval_days or cron_weekdays).
- Task status: per task definition, last_completed_at and last_skipped_at.
- Rules: serum rotations, hydration boost toggle, lazy fallback products.
- Condition state: per user toggles such as sensitive/irritated/dry.

## Scheduling Rules
- interval_days is based on last_completed_at. If last_completed_at is null, the task is due.
- cron_weekdays (if set) schedules by weekday (0=Mon .. 6=Sun). If both interval and cron are set, interval takes precedence.
- If multiple tasks share the same slot and are due on the same date, the task with the longer interval_days wins for that slot (ex: scalp_scale_day overrides shower_normal on its due day).

## Condition Toggles
- If sensitive or irritated is true, vitamin C and high-niacin selections are disabled for that day.
- One active serum per slot is enforced: AM and PM each select at most one serum.
- hydration boost (need_extra_hydration) adds the hydration ampoule to the serum step.
- lazy_mode (optional) swaps AM/PM routines to lazyFallback products.

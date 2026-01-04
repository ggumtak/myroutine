from __future__ import annotations

import os
from pathlib import Path
from zoneinfo import ZoneInfo

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent

DEFAULT_DB_PATH = REPO_ROOT / "backend" / "routine.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH.as_posix()}")

SEED_PATH = Path(os.getenv("SEED_PATH", str(REPO_ROOT / "spec" / "seed.json")))

TIMEZONE = ZoneInfo("Asia/Seoul")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "gemini-3.0-flash")

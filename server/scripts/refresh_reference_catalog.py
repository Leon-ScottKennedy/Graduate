"""Refresh all eight hardware categories, without a manually enumerated SKU list."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import Settings
from app.repositories.database import Database
from app.ingestion.reference_feed import PAGES, refresh_references

database = Database(Settings.from_environment().database_path)
database.initialize()
for category in PAGES:
    print(json.dumps(refresh_references(database, category, force='--force' in sys.argv), ensure_ascii=False), flush=True)

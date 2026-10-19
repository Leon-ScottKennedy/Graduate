"""Collect hardware from the currently available JD pool, then enrich via itemId."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import Settings
from app.repositories.database import Database
from app.integrations.jd.client import JDClient, JDError
from app.ingestion.jd_pool import JDPoolService


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pages', type=int, choices=range(1, 31), default=3)
    parser.add_argument('--restart', action='store_true', help='Start a new scan at page 1')
    args = parser.parse_args()
    settings = Settings.from_environment()
    database = Database(settings.database_path)
    database.initialize()
    service = JDPoolService(database, JDClient(settings))
    try:
        result = service.collect(args.pages, enrich_limit=20, restart=args.restart)
        print(json.dumps({'run': result, 'coverage': service.catalog('cpu')['coverage']}, ensure_ascii=True))
    except JDError as error:
        print(json.dumps({'status': error.status, 'code': error.code, 'message': str(error)}, ensure_ascii=True))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

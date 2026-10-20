"""Collect hardware from the currently available JD pool, then enrich via itemId."""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import Settings
from app.repositories.database import Database
from app.integrations.jd.client import JDClient, JDError
from app.ingestion.jd_pool import JDPoolService


class PacedJDClient(JDClient):
    def __init__(self, settings, interval):
        super().__init__(settings)
        self.interval = interval
        self.finished = 0

    def _request(self, method, business):
        time.sleep(max(0, self.interval - (time.monotonic() - self.finished)))
        try:
            return super()._request(method, business)
        finally:
            self.finished = time.monotonic()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pages', type=int, choices=range(1, 31), default=3)
    parser.add_argument('--restart', action='store_true', help='Start a new scan at page 1')
    parser.add_argument('--enrich-limit', type=int, choices=range(21), default=20)
    parser.add_argument('--request-interval', type=int, choices=range(10, 61), default=10)
    args = parser.parse_args()
    settings = Settings.from_environment()
    database = Database(settings.database_path)
    database.initialize()
    service = JDPoolService(database, PacedJDClient(settings, args.request_interval))
    try:
        result = service.collect(args.pages, enrich_limit=args.enrich_limit, restart=args.restart)
        print(json.dumps({'run': result, 'coverage': service.catalog('cpu')['coverage']}, ensure_ascii=True))
    except JDError as error:
        print(json.dumps({'status': error.status, 'code': error.code, 'message': str(error)}, ensure_ascii=True))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

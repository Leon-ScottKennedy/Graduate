"""Small explicit collection batch using the same persistent limits as the UI."""
import argparse
import json
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import Settings
from app.repositories.database import Database
from app.integrations.taobao import TaobaoClient, TaobaoError
from app.ingestion.taobao_search import TaobaoSearchService


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('keywords', nargs='+')
    parser.add_argument('--tmall-only', action='store_true')
    parser.add_argument('--pages', type=int, choices=range(1,4), default=1)
    args = parser.parse_args()
    if len(args.keywords) > 8:
        parser.error('A batch is limited to eight keywords, one page each')
    settings = Settings.from_environment()
    database = Database(settings.database_path)
    database.initialize()
    service = TaobaoSearchService(database, TaobaoClient(settings))
    jobs = [(keyword, page) for keyword in dict.fromkeys(args.keywords) for page in range(1, args.pages+1)]
    exhausted = set()
    for index, (keyword, page) in enumerate(jobs):
        if keyword in exhausted:
            continue
        if index:
            time.sleep(11)
        try:
            result = service.search(keyword, page=page, page_size=20, tmall_only=args.tmall_only)
        except (TaobaoError, ValueError) as error:
            print(json.dumps(dict(error=str(error), stopped=True), ensure_ascii=True), flush=True)
            return 1
        print(json.dumps(dict(keyword=keyword, page=page, received=result['received'], valid=result['valid'],
                              taskId=result['taskId']), ensure_ascii=True), flush=True)
        if not result['received'] or page * result['pageSize'] >= result['total']:
            exhausted.add(keyword)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

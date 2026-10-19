"""Read-only real search probe, no database writes, credentials never printed."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import Settings
from app.integrations.taobao import TaobaoClient, TaobaoError
from app.ingestion.taobao_search import clean_search_item


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--keyword', default='RTX 4070 SUPER')
    parser.add_argument('--page', type=int, default=1)
    args = parser.parse_args()
    try:
        client = TaobaoClient(Settings.from_environment())
        result = client.search(args.keyword, args.page)
        cleaned = []
        for item in result['items']:
            try:
                cleaned.append(clean_search_item(item))
            except ValueError:
                pass
        print(json.dumps(dict(total=result['total'], received=len(result['items']), valid=len(cleaned),
                              samples=[{key: row[key] for key in ('title', 'shop', 'category', 'discountPriceCents', 'presale')} for row in cleaned[:3]],
                              newIdCount=sum(bool(row['itemId']) for row in cleaned)), ensure_ascii=True))
        return 0
    except (TaobaoError, ValueError) as error:
        print(json.dumps({'error': str(error), 'requestId': getattr(error, 'request_id', '')}, ensure_ascii=True))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())

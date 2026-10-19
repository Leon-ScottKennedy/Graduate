"""Read-only item-level probe. Does not write database or print credentials."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import Settings
from app.integrations.taobao import TaobaoClient, TaobaoError, parse_item, clean_item


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--item', default='769696180391')
    parser.add_argument('--scene', choices=['1', '2'], default='2')
    args = parser.parse_args()
    try:
        source = parse_item(args.item)
        items = TaobaoClient(Settings.from_environment()).details([source['itemId']], args.scene)
        cleaned = [clean_item(item) for item in items]
        print(json.dumps(dict(requestedItemId=source['itemId'], requestedSkuId=source['skuId'],
                              receivedCount=len(items), items=cleaned,
                              notice='Item-level reference only; not a verified SKU quote. No database writes.'), ensure_ascii=True))
        return 0
    except (TaobaoError, ValueError) as error:
        print(str(error))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())

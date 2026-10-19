import hashlib
import json

from ..cleaning.jd_categories import hardware_category
from ..cleaning.jd_goods import clean_text
from ..cleaning.model_match import brand_key, fold, matches, model_key, flags


def shop_key(row):
    shop_info = row['raw'].get('shopInfo')
    identifier = shop_info.get('shopId') if isinstance(shop_info, dict) else None
    if identifier is not None and str(identifier).strip():
        return 'jd-shop:' + str(identifier)
    # Unknown shops must never be treated as multiple independent merchants.
    return 'name:' + fold(row['shop']) if row['shop'] else None


class JDComparisonService:
    def __init__(self, database):
        self.database = database

    def candidates(self, category):
        with self.database.connect() as connection:
            rows = connection.execute('''SELECT i.*,d.title AS name,d.brand,p.shop,p.product_url,
                s.price_cents,s.collected_at,s.id AS price_id,r.payload_json,e.collected_at AS detail_time
                FROM jd_pool_items i JOIN product_details d ON d.product_id=i.product_id
                JOIN products p ON p.id=i.product_id JOIN raw_records r ON r.id=i.raw_record_id
                LEFT JOIN jd_item_details e ON e.product_id=i.product_id
                LEFT JOIN price_snapshots s ON s.id=(SELECT id FROM price_snapshots
                    WHERE product_id=i.product_id AND price_type='listed'
                    ORDER BY collected_at DESC,id DESC LIMIT 1)
                WHERE i.category_id=?''', (category,)).fetchall()
        result = []
        for row in rows:
            value = dict(row)
            value['raw'] = json.loads(value.pop('payload_json'))
            if hardware_category(value['raw']) == category:
                result.append(value)
        return result

    def groups(self, category, brand, name, specs):
        groups = {}
        for row in self.candidates(category):
            if not matches(category, brand, name, specs, row):
                continue
            shop = shop_key(row)
            if not shop:
                continue
            # Group only strictly matched model/specs and the same identified shop.
            key = '|'.join([category, brand_key(brand), model_key(name, brand), ','.join(sorted(flags(name))), specs, shop])
            offer_id = 'jd-offer:' + hashlib.sha256(key.encode()).hexdigest()[:24]
            groups.setdefault(offer_id, []).append(row)
        return groups

    def compare(self, category, brand, name, specs):
        offers = []
        for offer_id, rows in self.groups(category, brand, name, specs).items():
            latest = max(rows, key=lambda row: (row['collected_at'] or '', row['price_id'] or 0))
            if latest['price_cents'] is None:
                continue
            offers.append(dict(id=offer_id, name=latest['name'], brand=latest['brand'], shop=latest['shop'],
                               price=latest['price_cents'] / 100, productUrl=latest['product_url'],
                               collectedAt=latest['collected_at'], priceType='listed', mergedCount=len(rows)))
        offers.sort(key=lambda offer: (offer['price'], offer['shop']))
        lowest = min((offer['price'] for offer in offers), default=None)
        for offer in offers:
            offer['difference'] = round(offer['price'] - lowest, 2) if len(offers) > 1 else None
            offer['isLowest'] = len(offers) > 1 and offer['price'] == lowest
        return dict(categoryId=category, modelName=name, brand=brand, specs=specs,
                    shopCount=len(offers), priceType='listed', offers=offers)

    def history(self, category, brand, name, specs, offer_id):
        group = self.groups(category, brand, name, specs).get(offer_id)
        if not group:
            return None
        ids = [row['product_id'] for row in group]
        with self.database.connect() as connection:
            rows = connection.execute(f'''SELECT s.price_cents,s.collected_at,s.task_id,s.id,r.payload_json
                FROM price_snapshots s JOIN raw_records r ON r.id=s.raw_record_id
                WHERE s.price_type='listed' AND s.product_id IN ({','.join('?' for _ in ids)})
                ORDER BY s.collected_at DESC,s.id DESC''', ids).fetchall()
        result, seen = [], set()
        for row in rows:
            raw = json.loads(row['payload_json'])
            historical = dict(brand=clean_text(raw.get('brandName')), name=clean_text(raw.get('skuName')))
            info = raw.get('shopInfo')
            historical.update(raw=raw, shop=clean_text(info.get('shopName')) if isinstance(info, dict) else '')
            if (hardware_category(raw) != category or not matches(category, brand, name, specs, historical)
                    or shop_key(historical) != shop_key(group[0])):
                continue
            if row['task_id'] in seen:
                continue
            seen.add(row['task_id'])
            result.append(dict(price=row['price_cents'] / 100 if row['price_cents'] is not None else None,
                               collectedAt=row['collected_at'], taskId=row['task_id']))
            if len(result) == 100:
                break
        return result

    def related(self, category, query=''):
        # Presentation deduplication only. Original itemIds/raw snapshots remain intact.
        unique = {}
        for row in self.candidates(category):
            key = (brand_key(row['brand']), fold(row['name']), shop_key(row) or row['product_id'])
            current = unique.get(key)
            if current is None or (row['collected_at'] or '', row['price_id'] or 0) > (current['collected_at'] or '', current['price_id'] or 0):
                unique[key] = row
        return sorted([row for row in unique.values() if row['price_cents'] is not None
                       and query.casefold() in (row['name'] + ' ' + row['brand']).casefold()],
                      key=lambda row: (row['price_cents'], row['product_id']))

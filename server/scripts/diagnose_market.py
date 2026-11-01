"""Trace local model matching and merchant gates without requesting platforms."""
import json
import sys
from pathlib import Path
from collections import Counter
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import Settings
from app.repositories.database import Database
from app.cleaning.model_match import matches, model_key, flags, capacities
from app.cleaning.merchant_identity import merchant_identity
from app.ingestion.market_comparison import gpu_families

db = Database(Settings.from_environment().database_path)
target = '微星 RTX 4070 Ti SUPER VENTUS 3X'
with db.connect() as conn:
    rows = conn.execute('''SELECT p.*,d.title,d.brand,r.payload_json FROM products p
        JOIN product_details d ON d.product_id=p.id JOIN raw_records r ON r.id=d.raw_record_id''').fetchall()
counts = Counter()
samples = []
for row in rows:
    if '4070' in row['title'] and ('微星' in row['title'] or 'msi' in row['title'].lower()):
        samples.append(dict(rawMsi4070Title=row['title'],shop=row['shop'],families=sorted(gpu_families(row['title']))))
    if gpu_families(row['title']) != {'RTX4070TISUPER'}:
        continue
    counts['same_chip'] += 1
    if '微星' not in row['title'] and 'msi' not in row['title'].lower():
        continue
    counts['msi_same_chip'] += 1
    identity = merchant_identity(row['platform'],row['shop'],json.loads(row['payload_json']))
    exact = matches('gpu','微星 MSI',target,'独立显卡 · 16GB',dict(name=row['title'],brand=row['brand']))
    counts['model_matches'] += int(exact)
    counts['trusted_merchants'] += int(identity['isJdSelfOperated'] or identity['officialBrandStoreVerified'])
    samples.append(dict(title=row['title'],brand=row['brand'],shop=row['shop'],platform=row['platform'],
                        exact=exact,modelKey=model_key(row['title'],row['brand']), flags=sorted(flags(row['title'])),
                        capacity=sorted(capacities(row['title'])),identity=identity))
print(json.dumps(dict(counts=dict(counts),targetKey=model_key(target,'微星 MSI'),samples=samples),ensure_ascii=True))

"""Create and verify a local SQLite snapshot without stopping the backend."""
import hashlib
import json
import sqlite3
import sys
from contextlib import closing
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import Settings


def main():
    source = Settings.from_environment().database_path.resolve()
    if not source.is_file():
        raise SystemExit('Database does not exist; nothing was backed up.')
    directory = Path(__file__).resolve().parents[2] / 'backups'
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone(timedelta(hours=8))).strftime('%Y%m%d-%H%M%S-%f')
    destination = directory / f'nexbuild-{stamp}.sqlite3'
    destination.touch(exist_ok=False)
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as original:
        with closing(sqlite3.connect(destination)) as backup:
            original.backup(backup, pages=256)
            integrity = backup.execute('PRAGMA integrity_check').fetchall()
            if integrity != [('ok',)]:
                raise SystemExit('Snapshot integrity check failed; do not use this backup.')
            if backup.execute('PRAGMA foreign_key_check').fetchone():
                raise SystemExit('Snapshot foreign key check failed; do not use this backup.')
            counts = {platform: count for platform, count in backup.execute(
                'SELECT platform,COUNT(*) FROM products GROUP BY platform')}
    result = dict(file=str(destination), bytes=destination.stat().st_size,
                  sha256=hashlib.sha256(destination.read_bytes()).hexdigest(),
                  integrity='ok', products=counts)
    destination.with_suffix('.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))


if __name__ == '__main__':
    main()

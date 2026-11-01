"""Read-only secret audit. Reports locations/counts, never secret values or lines."""
import argparse
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
SKIP = {'.git', 'node_modules', '.venv', 'venv', '__pycache__', 'storage', 'backups', '.tmp', '.pytest_cache'}
TEXT = {'.py', '.ts', '.js', '.mjs', '.cjs', '.vue', '.json', '.html', '.css', '.md', '.txt', '.yml', '.yaml', '.toml', '.sql'}
SECRET_NAME = re.compile(r'(?:API_KEY|APP_KEY|APP_SECRET|ADMIN_TOKEN|ACCESS_CODE)$')
PATTERNS = [re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
            re.compile(rb'gh[pousr]_[A-Za-z0-9]{36,}'), re.compile(rb'github_pat_[A-Za-z0-9_]{50,}'),
            re.compile(rb'AKIA[A-Z0-9]{16}')]


def git(*args, input=None):
    return subprocess.run(['git', *args], cwd=ROOT, input=input, stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL, check=True).stdout


def private_path(name):
    path = Path(name)
    return (path.name == '.env' or (path.name.startswith('.env.') and path.name != '.env.example')
            or path.suffix in {'.pem', '.key', '.p12', '.pfx', '.sqlite', '.sqlite3'}
            or any(part in {'.venv', 'backups', 'storage'} for part in path.parts))


def local_secrets():
    values = set()
    for path in (ROOT / '.env', ROOT / '.env.local', ROOT / 'server/.env'):
        if not path.is_file(): continue
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            key, sep, value = line.strip().partition('=')
            value = value.strip().strip('\"\'')
            if sep and SECRET_NAME.search(key) and len(value) >= 12:
                values.add(value.encode())
    return values


def audit(include_history=False):
    findings = set()
    secrets = local_secrets()
    checked = 0

    def inspect(label, data):
        nonlocal checked
        checked += 1
        if any(value in data for value in secrets) or any(pattern.search(data) for pattern in PATTERNS):
            findings.add((label, 'possible credential (value redacted)'))

    tracked = git('ls-files', '-z').decode().split('\0')
    for name in filter(None, tracked):
        if private_path(name): findings.add((name, 'private file tracked by Git'))
    for folder, directories, filenames in os.walk(ROOT):
        directories[:] = [name for name in directories if name not in SKIP]
        for name in filenames:
            path = Path(folder) / name
            if private_path(str(path.relative_to(ROOT))): continue
            if path.suffix not in TEXT and name != '.env.example': continue
            if path.stat().st_size > 2 * 1024 * 1024: continue
            inspect(str(path.relative_to(ROOT)), path.read_bytes())
    if include_history:
        objects = {}
        for record in git('rev-list', '--objects', '--all').decode().splitlines():
            oid, _, name = record.partition(' ')
            if not name: continue
            if private_path(name): findings.add((f'history:{name}', 'private file appears in Git history'))
            if Path(name).suffix in TEXT or Path(name).name.startswith('.env'):
                objects[oid] = name
        checks = git('cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)', input=('\n'.join(objects) + '\n').encode())
        selected = [line.split()[0].decode() for line in checks.splitlines()
                    if len(line.split()) == 3 and line.split()[1] == b'blob' and int(line.split()[2]) <= 2 * 1024 * 1024]
        if selected:
            stream = git('cat-file', '--batch', input=('\n'.join(selected) + '\n').encode())
            offset = 0
            for oid in selected:
                end = stream.index(b'\n', offset)
                size = int(stream[offset:end].split()[2])
                data = stream[end + 1:end + 1 + size]
                inspect(f'history:{objects[oid]}', data)
                offset = end + size + 2
    print(f'Checked {checked} source/build/history blobs; findings: {len(findings)}. No credential values printed.')
    for label, reason in sorted(findings): print(f'  {label}: {reason}')
    return 1 if findings else 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--history', action='store_true')
    sys.exit(audit(parser.parse_args().history))

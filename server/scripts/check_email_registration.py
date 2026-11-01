"""Explicit live smoke test: sends ONE verification email to SMTP_USER.

Uses a temporary database; never prints credentials, recipient or verification code.
Run from server: .venv/Scripts/python.exe scripts/check_email_registration.py
"""
import dataclasses
from pathlib import Path
import secrets
import sys
import tempfile
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app.api.auth import AccountService, EmailInput
from app.config import Settings
from app.main import create_app


def main():
    settings = Settings.from_environment()
    if not all((settings.smtp_host, settings.smtp_user, settings.smtp_password)):
        print('FAIL: SMTP settings are incomplete. Fill SMTP_HOST, SMTP_USER and SMTP_PASSWORD.')
        return 1
    try:
        email = EmailInput(email=settings.smtp_user).email
    except ValueError:
        print('FAIL: SMTP_USER must be a complete valid email address.')
        return 1
    print('PASS: SMTP configuration fields are present; secrets are hidden.')
    live_send = AccountService.send_email
    captured = []

    def send_once(service, recipient, code):
        live_send(service, recipient, code)
        captured.append(code)

    with tempfile.TemporaryDirectory(prefix='nexbuild-mail-check-') as directory:
        config = dataclasses.replace(settings, database_path=Path(directory) / 'test.sqlite3',
            security_mode='production', access_code=secrets.token_urlsafe(32),
            admin_token=secrets.token_urlsafe(40), allowed_hosts=('testserver',),
            allowed_origins=('https://testserver',))
        with patch.object(AccountService, 'send_email', send_once):
            with TestClient(create_app(config), base_url='https://testserver') as client:
                response = client.post('/api/auth/code', json={'email': email})
                if response.status_code != 200:
                    print(f'FAIL: verification email endpoint returned HTTP {response.status_code}.')
                    detail = response.json().get('detail')
                    if isinstance(detail, str):
                        print(detail)
                    return 1
                print('PASS: SMTP server accepted ONE verification email to the configured sender inbox.')
                password = secrets.token_urlsafe(24)
                checks = [
                    ('register and create session', lambda: client.post('/api/auth/register', json={'email': email, 'password': password, 'code': captured[0]})),
                    ('read authenticated profile', lambda: client.get('/api/auth/me')),
                    ('logout', lambda: client.post('/api/auth/logout', json={})),
                    ('login with verified account', lambda: client.post('/api/auth/login', json={'email': email, 'password': password})),
                ]
                for label, call in checks:
                    result = call()
                    if result.status_code != 200:
                        print(f'FAIL: {label} returned HTTP {result.status_code}.')
                        return 1
                    print('PASS: ' + label)
                client.post('/api/auth/logout', json={})
    print('PASS: temporary test account and database removed. Check your inbox/spam folder for actual delivery.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

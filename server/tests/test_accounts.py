import dataclasses
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app
from app.api.auth import AccountService, COOKIE


class AccountTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(Path(self.temp.name) / 'accounts.sqlite3', security_mode='production',
            access_code='a' * 32, admin_token='b' * 40, allowed_hosts=('testserver',),
            allowed_origins=('https://testserver',), smtp_host='smtp.test', smtp_user='sender@example.com', smtp_password='test-only')
        self.sent = []
        self.mail = patch.object(AccountService, 'send_email', lambda service, email, code: self.sent.append((email, code)))
        self.mail.start()
        self.client = TestClient(create_app(self.settings), base_url='https://testserver')
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.mail.stop()
        self.temp.cleanup()

    def send(self, email='student@example.com'):
        response = self.client.post('/api/auth/code', json={'email': email})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertNotIn('code', response.json())
        return self.sent[-1][1]

    def register(self, email='student@example.com'):
        code = self.send(email)
        response = self.client.post('/api/auth/register', json={'email': email, 'password': 'student-password', 'code': code})
        self.assertEqual(response.status_code, 200, response.text)
        return response

    def db(self):
        return self.client.app.state.database.connect()

    def test_full_signup_login_logout_and_password_hash(self):
        result = self.register('Student@Example.COM')
        self.assertEqual(result.json()['user']['email'], 'student@example.com')
        cookie = result.headers['set-cookie']
        for flag in ('HttpOnly', 'Secure', 'SameSite=strict'):
            self.assertIn(flag, cookie)
        self.assertEqual(self.client.get('/api/auth/me').status_code, 200)
        with self.db() as db:
            row = db.execute('SELECT password_hash FROM account_users').fetchone()
            self.assertNotIn('student-password', row[0])
            self.assertEqual(db.execute('SELECT COUNT(*) FROM account_codes').fetchone()[0], 0)
        self.assertEqual(self.client.post('/api/auth/logout', json={}).status_code, 200)
        self.assertEqual(self.client.get('/api/auth/me').status_code, 401)
        self.assertEqual(self.client.post('/api/auth/login', json={'email': 'student@example.com', 'password': 'wrong-password'}).status_code, 401)
        self.assertEqual(self.client.post('/api/auth/login', json={'email': 'student@example.com', 'password': 'student-password'}).status_code, 200)

    def test_wrong_code_attempts_persist_and_lock(self):
        correct = self.send()
        wrong = '000000' if correct != '000000' else '999999'
        for _ in range(5):
            self.assertEqual(self.client.post('/api/auth/register', json={'email': 'student@example.com', 'password': 'student-password', 'code': wrong}).status_code, 400)
        result = self.client.post('/api/auth/register', json={'email': 'student@example.com', 'password': 'student-password', 'code': correct})
        self.assertEqual(result.status_code, 400)
        with self.db() as db:
            self.assertEqual(db.execute('SELECT attempts FROM account_codes').fetchone()[0], 5)

    def test_expired_code_cannot_register(self):
        code = self.send()
        with self.db() as db:
            db.execute('UPDATE account_codes SET expires_at=?', (int(time.time()) - 1,))
        result = self.client.post('/api/auth/register', json={'email': 'student@example.com', 'password': 'student-password', 'code': code})
        self.assertEqual(result.status_code, 400)

    def test_resend_cooldown_and_code_not_plaintext(self):
        code = self.send()
        with self.db() as db:
            self.assertNotIn(code, db.execute('SELECT code_hash FROM account_codes').fetchone()[0])
        result = self.client.post('/api/auth/code', json={'email': 'student@example.com'})
        self.assertEqual(result.status_code, 429)
        self.assertEqual(len(self.sent), 1)

    def test_code_is_single_use_and_email_bound(self):
        code = self.send()
        self.assertEqual(self.client.post('/api/auth/register', json={'email': 'other@example.com', 'password': 'student-password', 'code': code}).status_code, 400)
        payload = {'email': 'student@example.com', 'password': 'student-password', 'code': code}
        self.assertEqual(self.client.post('/api/auth/register', json=payload).status_code, 200)
        self.assertEqual(self.client.post('/api/auth/register', json=payload).status_code, 400)

    def test_session_expiry_and_revocation(self):
        self.register()
        token = self.client.cookies.get(COOKIE)
        self.client.post('/api/auth/logout', json={})
        self.client.cookies.set(COOKIE, token, domain='testserver.local', path='/api/auth')
        self.assertEqual(self.client.get('/api/auth/me').status_code, 401)
        self.client.cookies.clear()
        self.client.post('/api/auth/login', json={'email': 'student@example.com', 'password': 'student-password'})
        with self.db() as db:
            db.execute('UPDATE account_sessions SET expires_at=0')
        self.assertEqual(self.client.get('/api/auth/me').status_code, 401)

    def test_configs_require_login_and_are_user_scoped(self):
        payload = {'name': 'My PC', 'budget': 9000, 'usage': '游戏电竞', 'parts': {
            key: {'id': key, 'brand': 'Test', 'name': key, 'specs': 'Test', 'tag': '', 'price': 100}
            for key in ('cpu', 'gpu', 'board', 'ram', 'ssd', 'power', 'case', 'cooler')}}
        self.assertEqual(self.client.get('/api/auth/configs').status_code, 401)
        self.assertEqual(self.client.post('/api/auth/configs', json=payload).status_code, 401)
        self.register()
        identifier = self.client.post('/api/auth/configs', json=payload).json()['id']
        self.assertEqual(len(self.client.get('/api/auth/configs').json()['configs']), 1)
        self.client.post('/api/auth/logout', json={})
        self.register('other@example.com')
        self.assertEqual(self.client.get('/api/auth/configs').json()['configs'], [])
        self.client.delete('/api/auth/configs/' + identifier, headers={'Content-Type': 'application/json'})
        with self.db() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM account_configs').fetchone()[0], 1)

    def test_mail_failure_never_creates_usable_code(self):
        from fastapi import HTTPException
        with patch.object(AccountService, 'send_email', side_effect=HTTPException(502, '邮件发送失败')):
            self.assertEqual(self.client.post('/api/auth/code', json={'email': 'student@example.com'}).status_code, 502)
        with self.db() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM account_codes').fetchone()[0], 0)

    def test_email_validation_and_csrf(self):
        self.assertEqual(self.client.post('/api/auth/code', json={'email': 'bad\r\nBcc: attacker@example.com'}).status_code, 422)
        self.assertEqual(self.client.post('/api/auth/code', json={'email': 'student@example.com'}, headers={'Origin': 'https://evil.example'}).status_code, 403)
        self.assertEqual(self.client.post('/api/auth/logout', content='{}', headers={'Content-Type': 'text/plain'}).status_code, 415)

    def test_unconfigured_smtp_fails_closed(self):
        self.client.app.state.accounts.settings = dataclasses.replace(self.settings, smtp_password='')
        self.assertEqual(self.client.post('/api/auth/code', json={'email': 'student@example.com'}).status_code, 503)
        self.assertEqual(self.sent, [])

    def test_login_rate_limit(self):
        for _ in range(15):
            self.assertEqual(self.client.post('/api/auth/login', json={'email': 'missing@example.com', 'password': 'wrong-password'}).status_code, 401)
        self.assertEqual(self.client.post('/api/auth/login', json={'email': 'missing@example.com', 'password': 'wrong-password'}).status_code, 429)

    def test_reissued_code_invalidates_old_code(self):
        previous = self.send()
        with self.db() as db:
            db.execute('UPDATE account_codes SET sent_at=0')
        with patch('app.api.auth.secrets.randbelow', return_value=(int(previous) + 1) % 1000000):
            current = self.send()
        self.assertNotEqual(previous, current)
        data = {'email': 'student@example.com', 'password': 'student-password', 'code': previous}
        self.assertEqual(self.client.post('/api/auth/register', json=data).status_code, 400)
        data['code'] = current
        self.assertEqual(self.client.post('/api/auth/register', json=data).status_code, 200)

    def test_smtp_transport_uses_tls_and_authorization_code(self):
        # Call the original SMTP implementation, mocking only the transport.
        self.mail.stop()
        try:
            with patch('app.api.auth.smtplib.SMTP_SSL') as transport:
                self.assertEqual(self.client.post('/api/auth/code', json={'email': 'student@example.com'}).status_code, 200)
                client = transport.return_value.__enter__.return_value
                client.login.assert_called_once_with('sender@example.com', 'test-only')
                message = client.send_message.call_args.args[0]
                self.assertEqual(message['To'], 'student@example.com')
                self.assertIn('NEXBUILD', str(message['Subject']))
                self.assertIn('验证码', message.get_content())
                self.assertIsNotNone(transport.call_args.kwargs['context'])
        finally:
            self.mail.start()

    def test_saved_config_validation_and_limit(self):
        self.register()
        payload = {'name': 'My PC', 'budget': 9000, 'usage': '游戏电竞', 'parts': {
            key: {'id': key, 'brand': 'Test', 'name': key, 'specs': 'Test', 'tag': '', 'price': 100}
            for key in ('cpu', 'gpu', 'board', 'ram', 'ssd', 'power', 'case', 'cooler')}}
        bad = dict(payload, parts={**payload['parts'], 'cpu': {'name': 'Incomplete'}})
        self.assertEqual(self.client.post('/api/auth/configs', json=bad).status_code, 422)
        for _ in range(20):
            self.assertEqual(self.client.post('/api/auth/configs', json=payload).status_code, 200)
        self.assertEqual(self.client.post('/api/auth/configs', json=payload).status_code, 409)
        identifier = self.client.get('/api/auth/configs').json()['configs'][0]['id']
        self.assertEqual(self.client.delete('/api/auth/configs/' + identifier, headers={'Content-Type': 'application/json'}).status_code, 200)
        self.assertEqual(self.client.post('/api/auth/configs', json=payload).status_code, 200)

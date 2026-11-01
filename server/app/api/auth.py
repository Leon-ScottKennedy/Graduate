"""Email-verified accounts, SMTP delivery and per-user saved builds. No paid SDK."""
import hashlib
import hmac
import json
import re
import secrets
import smtplib
import ssl
import time
from email.message import EmailMessage
from urllib.parse import urlsplit
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator

router = APIRouter(prefix='/api/auth', tags=['accounts'])
COOKIE = 'nexbuild_account'
TTL = 7 * 86400


def encode_secret(value):
    salt = secrets.token_hex(16)
    digest = hashlib.scrypt(value.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return salt + ':' + digest


def matches(value, stored):
    salt, digest = stored.split(':')
    actual = hashlib.scrypt(value.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return hmac.compare_digest(actual, digest)


class EmailInput(BaseModel):
    email: str = Field(min_length=3, max_length=254)

    @field_validator('email')
    @classmethod
    def normalize_email(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r'[a-z0-9.!#$%&\x27*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+', value):
            raise ValueError('请输入有效邮箱地址')
        return value


class LoginInput(EmailInput):
    password: str = Field(min_length=8, max_length=128)


class RegisterInput(LoginInput):
    code: str = Field(pattern=r'^\d{6}$')


class SavedConfig(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    budget: int = Field(ge=3000, le=30000)
    usage: str = Field(max_length=32)
    parts: dict[str, dict] = Field(min_length=8, max_length=8)


class AccountService:
    def __init__(self, database, settings, security):
        self.database, self.settings, self.security = database, settings, security
        self.dummy_hash = encode_secret(secrets.token_urlsafe(24))

    def send_email(self, email, code):
        s = self.settings
        if not all((s.smtp_host, s.smtp_user, s.smtp_password)):
            raise HTTPException(503, '邮件服务尚未配置，请管理员在 server/.env 中配置 SMTP 邮箱')
        message = EmailMessage()
        message['From'] = s.smtp_from or s.smtp_user
        message['To'] = email
        message['Subject'] = 'NEXBUILD 注册验证码'
        message.set_content(f'你的 NEXBUILD 注册验证码是：{code}\n\n5 分钟内有效，请勿向他人泄露。若非本人操作，请忽略此邮件。')
        try:
            if s.smtp_port == 465:
                with smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=15, context=ssl.create_default_context()) as client:
                    client.login(s.smtp_user, s.smtp_password)
                    client.send_message(message)
            else:
                with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as client:
                    client.ehlo()
                    client.starttls(context=ssl.create_default_context())
                    client.ehlo()
                    client.login(s.smtp_user, s.smtp_password)
                    client.send_message(message)
        except (OSError, smtplib.SMTPException):
            raise HTTPException(502, '验证码邮件发送失败，请检查邮箱配置或稍后重试') from None

    def issue(self, user, response):
        token = secrets.token_urlsafe(32)
        now = int(time.time())
        with self.database.connect() as db:
            db.execute('DELETE FROM account_sessions WHERE expires_at<=?', (now,))
            db.execute('INSERT INTO account_sessions VALUES(?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), user['id'], now + TTL))
        response.set_cookie(COOKIE, token, max_age=TTL, httponly=True,
                            secure=self.settings.security_mode == 'production', samesite='strict', path='/api/auth')
        return {'user': {'id': user['id'], 'email': user['email']}}

    def user(self, request):
        token = request.cookies.get(COOKIE, '')
        if not token or len(token) > 128:
            raise HTTPException(401, '请先登录')
        with self.database.connect() as db:
            row = db.execute('SELECT u.id,u.email FROM account_sessions s JOIN account_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?', (hashlib.sha256(token.encode()).hexdigest(), int(time.time()))).fetchone()
        if not row:
            raise HTTPException(401, '登录已过期，请重新登录')
        return dict(row)


def service(request):
    s = request.app.state.accounts
    if request.method not in ('GET', 'HEAD'):
        if request.headers.get('content-type', '').split(';')[0] != 'application/json':
            raise HTTPException(415, '仅支持 JSON 请求')
        origin = request.headers.get('origin')
        if origin:
            parsed = urlsplit(origin)
            allowed = origin in s.settings.allowed_origins if s.settings.security_mode == 'production' else parsed.scheme == 'http' and parsed.hostname in ('localhost', '127.0.0.1', '::1')
            if not allowed:
                raise HTTPException(403, '请求来源未获允许')
    return s


@router.post('/code')
def send_code(data: EmailInput, request: Request):
    s = service(request)
    if not all((s.settings.smtp_host, s.settings.smtp_user, s.settings.smtp_password)):
        raise HTTPException(503, '邮件服务尚未配置，请管理员在 server/.env 中配置 SMTP 邮箱')
    identity = hashlib.sha256((request.client.host if request.client else '').encode()).hexdigest()
    email_key = hashlib.sha256(data.email.encode()).hexdigest()
    s.security.consume([(f'account-code:{email_key}', 3600, 5), (f'account-code-ip:{identity}', 3600, 10), ('account-code-global', 86400, 100)])
    now, code = int(time.time()), f'{secrets.randbelow(1000000):06d}'
    digest = encode_secret(code)
    with s.database.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        old = db.execute('SELECT sent_at FROM account_codes WHERE email=?', (data.email,)).fetchone()
        if old and now - old['sent_at'] < 60:
            raise HTTPException(429, '请等待 60 秒后再发送', headers={'Retry-After': str(60 - now + old['sent_at'])})
        db.execute('DELETE FROM account_codes WHERE expires_at<?', (now - 86400,))
        db.execute('INSERT OR REPLACE INTO account_codes VALUES(?,?,?,0,?)', (data.email, digest, now + 300, now))
    try:
        s.send_email(data.email, code)
    except Exception:
        with s.database.connect() as db:
            db.execute('DELETE FROM account_codes WHERE email=? AND code_hash=?', (data.email, digest))
        raise
    return {'message': '验证码已发送，请检查收件箱和垃圾邮件', 'retryAfter': 60}


@router.post('/register')
def register(data: RegisterInput, request: Request, response: Response):
    s = service(request)
    identity = hashlib.sha256((request.client.host if request.client else '').encode()).hexdigest()
    s.security.consume([(f'account-register:{identity}', 900, 20)])
    password_hash = encode_secret(data.password)
    user = {'id': secrets.token_hex(16), 'email': data.email}
    error = None
    with s.database.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT * FROM account_codes WHERE email=?', (data.email,)).fetchone()
        if not row or row['expires_at'] <= time.time() or row['attempts'] >= 5:
            error = '验证码已失效，请重新获取'
        elif not matches(data.code, row['code_hash']):
            db.execute('UPDATE account_codes SET attempts=attempts+1 WHERE email=?', (data.email,))
            error = '验证码不正确'
        elif db.execute('SELECT 1 FROM account_users WHERE email=?', (data.email,)).fetchone():
            db.execute('DELETE FROM account_codes WHERE email=?', (data.email,))
            error = '该邮箱已注册，请直接登录'
        else:
            db.execute('INSERT INTO account_users VALUES(?,?,?,?)', (user['id'], data.email, password_hash, int(time.time())))
            db.execute('DELETE FROM account_codes WHERE email=?', (data.email,))
    if error:
        raise HTTPException(400, error)
    return s.issue(user, response)


@router.post('/login')
def login(data: LoginInput, request: Request, response: Response):
    s = service(request)
    identity = hashlib.sha256((request.client.host if request.client else '').encode()).hexdigest()
    email_key = hashlib.sha256(data.email.encode()).hexdigest()
    s.security.consume([(f'account-login:{identity}', 900, 15), (f'account-login-email:{email_key}', 900, 15)])
    with s.database.connect() as db:
        user = db.execute('SELECT * FROM account_users WHERE email=?', (data.email,)).fetchone()
    valid = matches(data.password, user['password_hash'] if user else s.dummy_hash)
    if not user or not valid:
        raise HTTPException(401, '邮箱或密码不正确')
    return s.issue(user, response)


@router.get('/me')
def me(request: Request):
    return {'user': service(request).user(request)}


@router.post('/logout')
def logout(request: Request, response: Response):
    s = service(request)
    token = request.cookies.get(COOKIE, '')
    with s.database.connect() as db:
        db.execute('DELETE FROM account_sessions WHERE token_hash=?', (hashlib.sha256(token.encode()).hexdigest(),))
    response.delete_cookie(COOKIE, path='/api/auth')
    return {'message': '已退出登录'}


@router.get('/configs')
def configs(request: Request):
    s = service(request)
    user = s.user(request)
    with s.database.connect() as db:
        rows = db.execute('SELECT id,name,snapshot,created_at FROM account_configs WHERE user_id=? ORDER BY created_at DESC', (user['id'],)).fetchall()
    return {'configs': [dict(id=row['id'], name=row['name'], snapshot=json.loads(row['snapshot']), createdAt=row['created_at']) for row in rows]}


@router.post('/configs')
def save_config(data: SavedConfig, request: Request):
    s = service(request)
    user = s.user(request)
    if set(data.parts) != {'cpu', 'gpu', 'board', 'ram', 'ssd', 'power', 'case', 'cooler'}:
        raise HTTPException(422, '配置需包含完整的八类配件')
    snapshot = data.model_dump()
    if len(json.dumps(snapshot).encode()) > 100000:
        raise HTTPException(413, '配置内容过大')
    for part in data.parts.values():
        if not isinstance(part.get('id'), str) or not isinstance(part.get('name'), str) or len(part['name']) > 300 or not isinstance(part.get('price'), (int, float)) or not 0 <= part['price'] <= 1000000:
            raise HTTPException(422, '配件数据无效')
    identifier = secrets.token_hex(16)
    with s.database.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        if db.execute('SELECT COUNT(*) FROM account_configs WHERE user_id=?', (user['id'],)).fetchone()[0] >= 20:
            raise HTTPException(409, '最多保存 20 套配置，请先删除不需要的方案')
        db.execute('INSERT INTO account_configs VALUES(?,?,?,?,?)', (identifier, user['id'], data.name, json.dumps(snapshot), int(time.time())))
    return {'id': identifier}


@router.delete('/configs/{identifier}')
def delete_config(identifier: str, request: Request):
    s = service(request)
    user = s.user(request)
    with s.database.connect() as db:
        db.execute('DELETE FROM account_configs WHERE id=? AND user_id=?', (identifier, user['id']))
    return {'message': '已删除'}

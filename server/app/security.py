"""Fail-closed public deployment controls; development is loopback-only."""
import hashlib
import asyncio
import hmac
import ipaddress
import json
import logging
import secrets
import time
from fastapi import HTTPException
from starlette.datastructures import Headers
from starlette.responses import JSONResponse

PUBLIC_POSTS = {'/api/market/catalog-offers', '/api/market/compare', '/api/jd/compare',
                '/api/jd/compare/history', '/api/quotes/compare'}
PUBLIC_GETS = {'/api/health', '/api/hardware', '/api/jd/catalog', '/api/jd/status',
               '/api/taobao/status', '/api/ai/status', '/api/jd/search', '/api/taobao/search'}
DISCOVERY = {'/api/market/alternatives', '/api/market/alternatives/discover'}


class SecurityStore:
    def __init__(self, database, settings):
        self.database, self.settings = database, settings

    def consume(self, limits):
        now = int(time.time())
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            for bucket, seconds, limit in limits:
                window = now // seconds * seconds
                row = db.execute('SELECT count FROM security_usage WHERE bucket=? AND window=?', (bucket, window)).fetchone()
                if row and row['count'] >= limit:
                    raise HTTPException(429, '请求次数已达上限，请稍后再试', headers={'Retry-After': str(window + seconds - now)})
            for bucket, seconds, _ in limits:
                window = now // seconds * seconds
                db.execute('INSERT INTO security_usage VALUES(?,?,1) ON CONFLICT(bucket,window) DO UPDATE SET count=count+1', (bucket, window))
            db.execute('DELETE FROM security_usage WHERE window<?', (now - 172800,))

    def consume_ai_call(self):
        if self.settings.security_mode == 'production':
            # Count actual provider calls, including model-refinement calls and failures.
            self.consume([('ai-provider-global', 86400, self.settings.ai_daily_limit)])

    def consume_vendor_call(self):
        if self.settings.security_mode == 'production':
            self.consume([('vendor-provider-global', 86400, self.settings.collection_daily_limit)])

    def issue_session(self):
        token = secrets.token_urlsafe(32)
        now = int(time.time())
        with self.database.connect() as db:
            db.execute('DELETE FROM security_sessions WHERE expires_at<=?', (now,))
            db.execute('INSERT INTO security_sessions VALUES(?,?)',
                       (hashlib.sha256(token.encode()).hexdigest(), now + self.settings.session_ttl))
        return token

    def session_valid(self, token):
        if not token or len(token) > 256:
            return False
        with self.database.connect() as db:
            return db.execute('SELECT 1 FROM security_sessions WHERE token_hash=? AND expires_at>?',
                              (hashlib.sha256(token.encode()).hexdigest(), int(time.time()))).fetchone() is not None


class SecurityMiddleware:
    def __init__(self, app, settings, store):
        self.app, self.settings, self.store = app, settings, store

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        started = False

        async def secured_send(message):
            nonlocal started
            if message['type'] == 'http.response.start':
                started = True
                headers = list(message.get('headers', []))
                headers += [(b'x-content-type-options', b'nosniff'), (b'x-frame-options', b'DENY'),
                            (b'referrer-policy', b'no-referrer'), (b'cache-control', b'no-store'),
                            (b'content-security-policy', b"default-src 'none'; frame-ancestors 'none'"),
                            (b'permissions-policy', b'camera=(), microphone=(), geolocation=()')]
                if self.settings.security_mode == 'production' and scope['scheme'] == 'https':
                    headers.append((b'strict-transport-security', b'max-age=31536000'))
                message = {**message, 'headers': headers}
            await send(message)

        async def reject(status, message, code=None, headers=None):
            detail = {'message': message, 'code': code} if code else message
            await JSONResponse({'detail': detail}, status_code=status, headers=headers)(scope, receive, secured_send)

        path = scope['path'].rstrip('/') or '/'
        headers = Headers(scope=scope)
        production = self.settings.security_mode == 'production'
        peer = (scope.get('client') or ('', 0))[0]
        if not production:
            # Never trust X-Forwarded-For to grant development privileges.
            try:
                local = ipaddress.ip_address(peer).is_loopback
            except ValueError:
                local = peer == 'testclient'
            if not local:
                return await reject(403, '开发模式仅允许本机访问，请配置生产安全模式')
            return await self.app(scope, receive, send)

        try:
            host = headers.get('host', '').split(':', 1)[0].lower()
            if host not in self.settings.allowed_hosts:
                return await reject(400, '请求主机无效')
            if scope['scheme'] != 'https' and path != '/api/health':
                return await reject(400, '请通过 HTTPS 访问')
            origin = headers.get('origin')
            if origin and origin not in self.settings.allowed_origins:
                return await reject(403, '请求来源未获允许')
            if not path.startswith('/api/'):
                return await reject(404, '未找到资源')
            if scope['method'] not in ('GET', 'HEAD', 'POST', 'DELETE'):
                return await reject(405, '请求方法不支持')
            identity = hashlib.sha256(peer.encode()).hexdigest()
            self.store.consume([(f'api:{identity}', 60, self.settings.api_requests_per_minute)])
            # Bound raw bytes, including chunked requests and dishonest Content-Length.
            body = b''
            if scope['method'] in ('POST', 'DELETE'):
                content_length = headers.get('content-length')
                if content_length and (not content_length.isdigit() or int(content_length) > self.settings.max_request_bytes):
                    return await reject(413, '请求内容过大')
                while True:
                    try:
                        message = await asyncio.wait_for(receive(), timeout=10)
                    except asyncio.TimeoutError:
                        return await reject(408, '请求读取超时')
                    if message['type'] == 'http.disconnect':
                        return
                    body += message.get('body', b'')
                    if len(body) > self.settings.max_request_bytes:
                        return await reject(413, '请求内容过大')
                    if not message.get('more_body'):
                        break
                if scope['method'] == 'POST' and headers.get('content-type', '').split(';')[0].strip().lower() != 'application/json':
                    return await reject(415, '仅支持 JSON 请求')

            if path == '/api/access/session' and scope['method'] == 'POST':
                self.store.consume([(f'login:{identity}', 900, 5), ('login-global', 60, 30)])
                try:
                    data = json.loads(body)
                    code = data.get('code') if isinstance(data, dict) else None
                except (ValueError, UnicodeDecodeError):
                    code = None
                if not isinstance(code, str) or len(code) > 256 or not hmac.compare_digest(code.encode(), self.settings.access_code.encode()):
                    return await reject(401, '访问码不正确')
                return await JSONResponse({'accessToken': self.store.issue_session(), 'expiresIn': self.settings.session_ttl})(scope, receive, secured_send)

            authorization = headers.get('authorization', '')
            token = authorization[7:] if authorization.startswith('Bearer ') else ''
            admin = bool(token) and hmac.compare_digest(token.encode(), self.settings.admin_token.encode())
            collection = False
            if path in DISCOVERY and scope['method'] == 'POST':
                try:
                    data = json.loads(body)
                    collection = not isinstance(data, dict) or data.get('collect', path.endswith('/alternatives')) is not False
                except (ValueError, UnicodeDecodeError):
                    collection = True
            ai = path.startswith('/api/ai/') and scope['method'] == 'POST'
            account_route = path in {'/api/auth/code', '/api/auth/register', '/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/auth/configs'} or (path.startswith('/api/auth/configs/') and scope['method'] == 'DELETE')
            public = account_route or (scope['method'] in ('GET', 'HEAD') and (path in PUBLIC_GETS or (path.startswith('/api/hardware/') and path.endswith('/offers')))) or (scope['method'] == 'POST' and (path in PUBLIC_POSTS or (path in DISCOVERY and not collection)))
            if not public:
                if ai or collection:
                    if not admin and not self.store.session_valid(token):
                        return await reject(401, '请输入演示访问码后使用在线功能', 'access_required', {'WWW-Authenticate': 'Bearer'})
                elif not admin:
                    return await reject(403, '该接口仅限管理员操作')
            if ai:
                self.store.consume([(f'ai:{identity}', 60, self.settings.ai_requests_per_minute)])
            if collection:
                self.store.consume([(f'collection:{identity}', 60, 4), ('collection-global', 86400, self.settings.collection_daily_limit)])

            replayed = False
            async def replay_receive():
                nonlocal replayed
                if not replayed and scope['method'] in ('POST', 'DELETE'):
                    replayed = True
                    return {'type': 'http.request', 'body': body, 'more_body': False}
                return await receive()
            await self.app(scope, replay_receive, secured_send)
        except HTTPException as error:
            if not started:
                await reject(error.status_code, error.detail, headers=error.headers)
        except Exception as error:
            # No exception strings, credentials, request bodies or authorization in logs.
            logging.getLogger(__name__).error('API request failed (%s)', type(error).__name__)
            if not started:
                await reject(500, '服务器暂时无法处理请求')

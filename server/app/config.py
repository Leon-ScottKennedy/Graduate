import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from dotenv import load_dotenv
from urllib.parse import urlsplit

SERVER_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    database_path: Path
    jd_app_key: str = field(default="", repr=False)
    jd_app_secret: str = field(default="", repr=False)
    ai_api_key: str = field(default='', repr=False)
    ai_model: str = ''
    taobao_app_key: str = field(default='', repr=False)
    taobao_app_secret: str = field(default='', repr=False)
    taobao_adzone_id: str = field(default='', repr=False)
    security_mode: str = 'development'
    access_code: str = field(default='', repr=False)
    admin_token: str = field(default='', repr=False)
    allowed_origins: tuple[str, ...] = ()
    allowed_hosts: tuple[str, ...] = ()
    session_ttl: int = 3600
    api_requests_per_minute: int = 120
    ai_requests_per_minute: int = 3
    ai_daily_limit: int = 100
    collection_daily_limit: int = 50
    max_request_bytes: int = 1048576
    smtp_host: str = ''
    smtp_port: int = 465
    smtp_user: str = ''
    smtp_password: str = field(default='', repr=False)
    smtp_from: str = ''

    def __post_init__(self):
        if self.security_mode not in ('development', 'production'):
            raise ValueError('NEXBUILD_ENV must be development or production')
        for setting in ('session_ttl', 'api_requests_per_minute', 'ai_requests_per_minute', 'ai_daily_limit', 'collection_daily_limit', 'max_request_bytes'):
            if getattr(self, setting) <= 0:
                raise ValueError(f'{setting} must be positive')
        if self.security_mode == 'production':
            if len(self.access_code) < 24 or len(self.admin_token) < 32 or self.access_code == self.admin_token:
                raise ValueError('Production requires distinct strong access code (24+ chars) and admin token (32+ chars)')
            if not self.allowed_hosts or any('*' in host or '/' in host or ':' in host for host in self.allowed_hosts):
                raise ValueError('Production requires explicit NEXBUILD_ALLOWED_HOSTS without ports or wildcards')
            if not self.allowed_origins:
                raise ValueError('Production requires explicit NEXBUILD_ALLOWED_ORIGINS')
            for origin in self.allowed_origins:
                parsed = urlsplit(origin)
                if parsed.scheme != 'https' or not parsed.netloc or parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password or '*' in origin:
                    raise ValueError('Production origins must be exact HTTPS origins without paths')

    @classmethod
    def from_environment(cls):
        load_dotenv(SERVER_ROOT / '.env', override=False)
        configured_path = os.getenv("NEXBUILD_DATABASE_PATH", "storage/nexbuild.sqlite3")
        path = Path(configured_path).expanduser()
        if not path.is_absolute():
            path = SERVER_ROOT / path
        placement = os.getenv('TAOBAO_ADZONE_ID', '').strip()
        full_pid = re.fullmatch(r'mm_\d+_\d+_([1-9]\d*)', placement)
        if full_pid:
            placement = full_pid.group(1)
        return cls(path, os.getenv("JD_APP_KEY", ""), os.getenv("JD_APP_SECRET", ""),
                   os.getenv('ARK_API_KEY', ''), os.getenv('ARK_MODEL', ''),
                   os.getenv('TAOBAO_APP_KEY', ''), os.getenv('TAOBAO_APP_SECRET', ''), placement,
                   security_mode=os.getenv('NEXBUILD_ENV', 'development').strip(),
                   access_code=os.getenv('NEXBUILD_ACCESS_CODE', ''),
                   admin_token=os.getenv('NEXBUILD_ADMIN_TOKEN', ''),
                   allowed_origins=tuple(item.strip() for item in os.getenv('NEXBUILD_ALLOWED_ORIGINS', '').split(',') if item.strip()),
                   allowed_hosts=tuple(item.strip() for item in os.getenv('NEXBUILD_ALLOWED_HOSTS', '').split(',') if item.strip()),
                   session_ttl=int(os.getenv('NEXBUILD_SESSION_TTL', '3600')),
                   api_requests_per_minute=int(os.getenv('NEXBUILD_API_PER_MINUTE', '120')),
                   ai_requests_per_minute=int(os.getenv('NEXBUILD_AI_PER_MINUTE', '3')),
                   ai_daily_limit=int(os.getenv('NEXBUILD_AI_DAILY_LIMIT', '100')),
                   collection_daily_limit=int(os.getenv('NEXBUILD_COLLECTION_DAILY_LIMIT', '50')),
                   max_request_bytes=int(os.getenv('NEXBUILD_MAX_REQUEST_BYTES', '1048576')),
                   smtp_host=os.getenv('SMTP_HOST', '').strip(),
                   smtp_port=int(os.getenv('SMTP_PORT', '465')),
                   smtp_user=os.getenv('SMTP_USER', '').strip(),
                   smtp_password=os.getenv('SMTP_PASSWORD', ''),
                   smtp_from=os.getenv('SMTP_FROM', '').strip())

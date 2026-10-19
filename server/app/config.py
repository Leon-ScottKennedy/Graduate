import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from dotenv import load_dotenv

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
                   os.getenv('TAOBAO_APP_KEY', ''), os.getenv('TAOBAO_APP_SECRET', ''), placement)

import os
from dataclasses import dataclass, field
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    database_path: Path
    jd_app_key: str = field(default="", repr=False)
    jd_app_secret: str = field(default="", repr=False)

    @classmethod
    def from_environment(cls):
        configured_path = os.getenv("NEXBUILD_DATABASE_PATH", "storage/nexbuild.sqlite3")
        path = Path(configured_path).expanduser()
        if not path.is_absolute():
            path = SERVER_ROOT / path
        return cls(path, os.getenv("JD_APP_KEY", ""), os.getenv("JD_APP_SECRET", ""))

# NexBuild 后端基础

Python 3.11+、FastAPI、本地 SQLite。当前只提供数据库初始化与查询，不进行京东网络请求。
接口分层与启动生命周期参考 [FastAPI 多文件组织](https://fastapi.tiangolo.com/tutorial/bigger-applications/) 和 [Lifespan](https://fastapi.tiangolo.com/advanced/events/)。

从项目根目录执行（PowerShell）：

```powershell
python -m venv server/.venv
server/.venv/Scripts/python.exe -m pip install -r server/requirements-dev.txt
Copy-Item server/.env.example server/.env
server/.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir server --env-file server/.env --host 127.0.0.1 --port 8000 --reload
```

复制配置文件只需首次执行，已有 `.env` 时不要覆盖。真实密钥只填入 `server/.env`。
不设置数据库路径时，启动后生成 `server/storage/nexbuild.sqlite3`，该目录已忽略提交。

接口：

- `GET /api/health`：运行状态。
- `GET /api/hardware`：标准硬件，新库返回 `[]`。
- `GET /api/hardware/{id}/offers`：该硬件有效展示价，未知硬件返回 404。
- `/docs`：交互接口文档。

测试：

```powershell
$env:PYTHONPATH = "$PWD/server"
server/.venv/Scripts/python.exe -m unittest discover -s server/tests -v
```

也可进入 `server` 后执行 `.venv/Scripts/python.exe -m unittest discover -s tests -v`。
测试使用独立临时数据库，不写入开发数据。

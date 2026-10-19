# NexBuild 后端

Python 3.11+、FastAPI、本地 SQLite。提供京东精选池采集、itemId 详情、数据清洗、价格快照与本地商品查询。
接口分层与启动生命周期参考 [FastAPI 多文件组织](https://fastapi.tiangolo.com/tutorial/bigger-applications/) 和 [Lifespan](https://fastapi.tiangolo.com/advanced/events/)。

从项目根目录执行（PowerShell）：

```powershell
python -m venv server/.venv
server/.venv/Scripts/python.exe -m pip install -r server/requirements-dev.txt
Copy-Item server/.env.example server/.env
server/.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir server --env-file server/.env --host 127.0.0.1 --port 8000 --reload
```

复制配置文件只需首次执行，已有 `.env` 时不要覆盖。真实密钥只填入 `server/.env`。
`JD_APP_KEY` 对应京东联盟后台的 **appkey**，`JD_APP_SECRET` 对应 **secretkey**，填写在等号后，不保留示例文字。
后端启动时会自动读取该文件；修改密钥后重启后端。不要使用 `VITE_` 前缀，也不要把密钥放到前端。
不设置数据库路径时，启动后生成 `server/storage/nexbuild.sqlite3`，该目录已忽略提交。

接口：

- `GET /api/health`：运行状态。
- `GET /api/hardware`：标准硬件，新库返回 `[]`。
- `GET /api/hardware/{id}/offers`：该硬件有效展示价，未知硬件返回 404。
- `GET /api/jd/status`：是否已填写密钥；不代表权限或签名已经验证成功。
- `GET /api/jd/catalog?category=gpu&q=&page=1`：按八类配件查询本地真实数据，支持标题/品牌筛选，每页 20 条，返回覆盖统计及最近采集记录。
- `POST /api/jd/pool/collect`：请求 `{"pages":3}`，限定 1 至 30 页，每页最多 50 条，从持久化扫描进度继续；遇到末页停止。八类硬件清洗入库后，为最多 10 条补充详情。同进程同时只执行一个任务。
- `GET /api/jd/pool/latest`：最近采集任务状态和计数。
- `GET /api/jd/catalog/{productId}/history`：同一商品最近 100 次价格记录，失效价格返回 null。
- `POST /api/jd/details`：按链接或 SKU 获取基本商品信息并清洗保存。请求示例：`{"inputs":"https://item.jd.com/100180790616.html\n123","collectionKey":"gpu-asus"}`，最多 10 个不同 SKU。
- `GET /api/jd/details?collectionKey=gpu-asus`：读取该配件最近一次成功查询及原始 SKU 列表，不调用京东。
- `POST /api/jd/search`：调用京东、清洗并入库。请求示例：`{"keyword":"华硕 RTX 4060","page":1,"pageSize":20}`。
- `GET /api/jd/search?keyword=华硕%20RTX%204060&page=1&pageSize=20`：读取最近成功结果，无缓存返回 `null`，不请求京东。
- `GET /api/jd/tasks/{taskId}`：读取一次查询记录及其当时的商品名称、价格。
- `/docs`：交互接口文档。

界面默认使用 `/jd/catalog` 和 `/jd/pool/collect`。旧 `/jd/details`、关键词搜索接口保留，当前普通 SKU/关键词调用返回 403，界面不再提供这些入口。
集合标识 `collectionKey` 仅用于保存某配件的最近一批查询；不是型号匹配，也不代表关联到标准硬件。

也可独立采集（默认 3 页、最多补充 20 条详情）：

```powershell
server/.venv/Scripts/python.exe server/scripts/collect_jd_pool.py --pages 5
```

该脚本读取同一个 `.env`，写入同一个本地数据库，不依赖前端启动。首次打开页面未采集时显示空类别；可点“补齐商品数据”。命令加 `--restart` 从第一页重新扫描，`--pages 30 --restart` 可完整扫描当前约 26 页的频道（频道数量会变化）。

测试：

```powershell
$env:PYTHONPATH = "$PWD/server"
server/.venv/Scripts/python.exe -m unittest discover -s server/tests -v
```

也可进入 `server` 后执行 `.venv/Scripts/python.exe -m unittest discover -s tests -v`。
测试使用独立临时数据库，不写入开发数据。

京东接入细节与当前边界见 [京东数据流程](../docs/jd-integration.md)。
# 同型号比价接口

智能装机另提供 `POST /api/ai/compatibility` 豆包辅助分析接口；配置与免费试用限制见 [豆包接入说明](../docs/doubao-integration.md)。缺少密钥或模型时返回明确的未配置提示，不影响本地规则和京东功能。

`POST /api/jd/compare` 接收 `category`、`brand`、`modelName`、`specs`，返回本地已匹配的店铺展示价；`POST /api/jd/compare/history` 额外接收该结果的 `offerId`，返回对应店铺、型号的历史快照。两个接口均只读本地库，不发起上游请求。

同店报价按最新采集记录展示，保留不同 itemId 的原始记录；型号、容量和版本不一致时不混比。仅单店时不标最低价，暂无匹配时不以同类商品填充。规则与限制见 [京东接入说明](../docs/jd-integration.md)。

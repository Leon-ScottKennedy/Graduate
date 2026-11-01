# 生产部署前的安全配置

这份配置降低公网部署风险，不代表绝对安全或已经上线。现有本地 `.env` 未自动修改，也未向远程仓库推送。

## 本地与生产模式

- 默认 `NEXBUILD_ENV=development`：只允许环回客户端。不要经公开隧道或开放代理转发开发服务器，也不要把开发模式当成上线配置。
- 生产必须设置 `NEXBUILD_ENV=production`，未设置足够强且不同的访问码、管理员令牌、明确的允许来源和主机名时，后端拒绝启动。
- 在服务器中设置 `server/.env.example` 所列变量；不要提交真实 `.env`。
- `NEXBUILD_ALLOWED_ORIGINS` 例如 `https://leon-scottkennedy.github.io`，不含 `/Graduate/` 和末尾斜杠。`NEXBUILD_ALLOWED_HOSTS` 是后端平台分配的实际主机名。
- HTTP 仅开放无敏感数据的健康检查。其余生产访问必须经过 HTTPS。反向代理需覆盖客户端提交的转发头，Uvicorn 只信任真正的代理地址，不能随意配置 `--forwarded-allow-ips '*'`。
- SQLite 必须挂载在后端持久磁盘，不能部署在前端静态目录；生产不提供 `.env`、数据库或内部 API 文档下载。

## 访问权限与密钥

1. 本地配置生成、拖动、候选筛选等界面交互不需要访问码。
2. AI 请求和可能触发采集的查询需要演示访问码；正确后服务器签发短时随机会话令牌，浏览器仅在内存中保存。刷新页面后需要重新解锁。
3. 访问码不是管理员令牌，不是豆包密钥。只把演示访问码私下发给授权的老师/评审。不要放进网页或仓库，不要在聊天中发送实际密钥。
4. 报价导入、删除、原始京东/淘宝采集及其他未列入公开查询的接口仅管理员可用，使用 `Authorization: Bearer <管理员令牌>`。页面不会内置或要求用户填写管理员令牌。
5. `ARK_API_KEY`、`JD_APP_SECRET`、`TAOBAO_APP_SECRET` 等仅存在后端；不得设置为 `VITE_*`，也不能注入前端构建流程。前端只配置公开的 `VITE_API_BASE_URL`。
6. 会话令牌在数据库中只保存 SHA-256 摘要，默认一小时过期。访问码更换不会立即撤销已有会话；需要立即撤销时，在后台数据库执行 `DELETE FROM security_sessions;`，同时轮换已泄露的访问码/管理员令牌/上游密钥。

## 配额与请求边界

- 默认同一实际连接 IP 每分钟 120 个请求、3 个 AI 请求；访问码验证同 IP 每15分钟最多5次，另有全局每分钟30次上限。
- 默认每天 UTC 100 次实际豆包上游调用，模型建议二次细化、失败调用也计入；默认每天50次采集请求和50次实际京东/淘宝上游调用，两项独立约束。SQLite 原子计数跨进程有效，重启不会清空当天计数。
- 这些是调用次数限制，不是精确金额预算。仍需在云平台/模型平台设置自身的费用上限、余额提醒和工具计费限制。联网搜索可能额外计费。
- IP 限流会影响同一校园/家庭出口下的多位访客。代理未正确配置时所有人可能共享同一个IP；全局日配额仍然有效。公开互联网还需要平台/WAF层的连接限流、防爬和DDoS防护。
- 默认最多1MiB请求体，按实际接收字节限制，禁止伪造长度绕过。POST只接受JSON。生产校验错误不回显原始输入，服务器异常不向访客显示堆栈或上游错误正文。
- CORS只解决浏览器跨域，不能替代鉴权。管理员操作、上游调用并不依赖CORS作为唯一保护。
- 数据库存在会话和限流记录，备份也需私有。备份、恢复、磁盘权限、代理HTTPS及主机更新要在实际服务器上验证。

## 部署与运行

先使用单个后端进程部署：数据库配额跨进程安全，但现有AI排队、采集冷却仍包含进程内状态。需要多副本时应引入共享队列和分布式并发控制，不能把当前方案直接等同于多副本防滥用。

安装后端环境时先升级修复过的工具，再安装锁定运行依赖：

```sh
python -m pip install --upgrade pip==26.2.0
python -m pip install -r server/requirements.txt
```

不要把环境变量或请求Authorization头打印进启动日志；反向代理同样禁止记录请求体、访问码和认证头。服务器存储、账户权限及上游平台配置不在本地代码检查的保证范围内。

## 检查命令（Windows项目根目录）

```powershell
npm.cmd run build
npm.cmd run test:site-access
npm.cmd run test:theme
npm.cmd audit
server\.venv\Scripts\python.exe server/scripts/security_audit.py --history
server\.venv\Scripts\python.exe server/scripts/audit_python_dependencies.py
```

后端测试需在 `server` 目录执行：

```powershell
.venv\Scripts\python.exe -m unittest discover -s tests -q
```

密钥扫描仅检查当前本地配置值和常见凭据格式，以及Git中的私有文件路径；不能证明所有未知/旧密钥都不存在。PyPI审计逐版本查询官方公开安全公告，npm审计使用npm官方漏洞库；没有公告不代表没有漏洞。

参考：[FastAPI跨域配置](https://fastapi.tiangolo.com/tutorial/cors/)、[OWASP REST接口安全](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)、[Vite客户端变量边界](https://vite.dev/guide/env-and-mode.html)。

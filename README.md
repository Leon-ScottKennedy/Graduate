# NexBuild

Vue 3 + TypeScript + Vite 的装机网站，后端使用 Python + FastAPI + SQLite。
当前前端仍使用集中管理的演示数据；京东联盟接口尚未接入。

## 启动前端

```powershell
npm install
npm run dev
```

## 项目目录

- `src/views/`：路由页面。
- `src/components/`：公共组件，`build/` 为装机组件，`home/` 为首页组件。
- `src/types/`：硬件、商品、报价等类型。
- `src/data/mock/`：硬件演示目录。
- `src/services/`：演示数据服务与真实 API 访问入口。
- `src/utils/`：金额等通用格式化。
- `server/app/`：后端接口、存储及后续采集、清洗模块。
- `server/tests/`：后端测试。
- `docs/`：数据约定与接入说明。

## 后端

启动与测试见 [server/README.md](server/README.md)。开发时 Vite 将 `/api` 代理到本机 `8000` 端口。
页面暂不自动请求后端；接入真实数据后，在服务层切换提供者，避免重写界面组件。
生产部署需要另行配置 `/api` 转发，Vite 开发代理不用于生产。

## 检查

```powershell
npm run build
```

`build` 同时运行 TypeScript 检查与 Vite 构建。`npm run build-only` 仅打包。

## 数据和凭据

参见 [数据组织约定](docs/data-conventions.md)。
前端 `.env.example` 只包含 API 地址；京东密钥只保存在 `server/.env`。
本地环境文件、Python 虚拟环境、数据库、构建产物与 `.tmp` 已加入忽略规则。

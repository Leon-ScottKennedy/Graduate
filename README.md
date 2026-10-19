# NexBuild

Vue 3 + TypeScript + Vite 的装机网站，后端使用 Python + FastAPI + SQLite。
配置清单仍使用预设硬件与参考价格；右侧“京东商品”展示精选池采集、清洗并保存的真实同类硬件，包含品牌、展示价、采集时间及商品链接。

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
- `server/app/`：后端接口、京东调用、采集、清洗和存储模块。
- `server/tests/`：后端测试。
- `docs/`：数据约定与接入说明。

## 后端

启动与测试见 [server/README.md](server/README.md)。开发时 Vite 将 `/api` 代理到本机 `8000` 端口。
智能装机右侧按所选配件类别读取本地京东数据。“筛选”只筛选已采集商品；“刷新数据”从上次成功页继续采集 3 页，并为最多 10 条硬件补充详情。空类别提供“补齐商品数据”，最多继续扫描 30 页，遇到频道末页即停止。扫描完成后下一次刷新从第一页开始新一轮。
缺少的类别显示暂无数据，不用演示报价替代。商品尚未自动匹配标准型号，不自动更新配置总价。
每件商品可查看已积累的价格记录；仅一次采集时不生成虚构趋势。详细流程见 [京东采集说明](docs/jd-integration.md)。
生产部署需要另行配置 `/api` 转发，Vite 开发代理不用于生产。

## 检查

```powershell
npm run build
npm run test:build-selection
```

`build` 同时运行 TypeScript 检查与 Vite 构建。`npm run build-only` 仅打包。
预算自动选配及参考价格边界见 [预算选配说明](docs/build-selection.md)。

## 数据和凭据

参见 [数据组织约定](docs/data-conventions.md)。
前端 `.env.example` 只包含 API 地址；京东密钥只保存在 `server/.env`。
本地环境文件、Python 虚拟环境、数据库、构建产物与 `.tmp` 已加入忽略规则。

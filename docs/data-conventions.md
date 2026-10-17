# 数据组织约定

## 前端

- `src/types/hardware.ts`：配件展示类型、标准硬件、平台报价与历史价格类型。
- `src/data/mock/catalog.ts`：现阶段唯一的硬件演示目录；不是京东实时数据。
- `src/services/catalogService.ts`：演示数据提供者；配置方案与对比页复用该目录。
- `src/services/hardwareApi.ts`：真实后端接口入口；暂未切换页面，避免把空库伪装成真实数据。
- `src/utils/format.ts`：金额展示格式；领域数据保存数值，不保存带货币符号的价格。

硬件选项 ID 仅是本地演示标识，不是京东 SKU。当前报价的商品 ID 带 `demo-` 前缀，来源为 `demo`。
演示配置方案引用目录中的选项，其总价由配件金额求和，不能另写一个不一致的总价。

## 后端

- `integrations/jd/`：后续实现京东联盟请求、签名、返回字段映射。
- `ingestion/`：采集任务及原始响应保留。
- `cleaning/`：后续实现清洗规则，并记录处理原因。
- `models/`：SQLite 初始结构与对外响应类型。
- `repositories/`：数据库操作；`api/`：只读 HTTP 查询。

当前后端可以启动并查询空库，但没有京东采集器、清洗执行器或真实商品数据。
不能仅因配置了 App Key 就宣称完成了采集。

## 实体边界

1. `hardware` 是品牌、完整型号和版本确定的标准硬件。
2. `products` 是平台商品，通过 `(platform, platform_product_id)` 唯一识别；未匹配型号时 `hardware_id` 为空。
3. `price_snapshots` 保存每次采集的报价，不覆盖旧价格。数据库以整数“分”保存，接口以数值“元”输出。
4. `ingestion_tasks` → `raw_records` → `cleaning_events` 记录任务、原始响应及清洗依据；报价关联原始记录。

展示价、券后价、定金不可混比。当前查询接口只返回每个商品最新的有效展示价；最新展示价缺失时不回退成过期价格。
时间采用带时区的 ISO 8601 格式。缺失价保留 NULL，无效价应排除或待核验，不填成 0。

初始 SQL 使用 `CREATE TABLE IF NOT EXISTS`，仅适用于当前新库初始化；后续调整表结构前需建立迁移流程。

## 接入京东前需要确认

授权的接口名称、签名方式、分页规则、限流要求，以及脱敏响应样例。
字段及可用权限以该接口文档为准，不假设返回完整硬件参数。
App Secret、Token、请求签名不得写入前端、原始业务响应、日志或版本库。

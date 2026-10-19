# 数据组织约定

## 前端

- `src/types/hardware.ts`：配件展示类型、标准硬件、平台报价与历史价格类型。
- `src/data/mock/catalog.ts`：现阶段唯一的硬件演示目录；不是京东实时数据。
- `src/services/catalogService.ts`：演示数据提供者；配置方案与对比页复用该目录。
- `src/services/hardwareApi.ts`：真实后端接口入口；装机右侧商品查询使用京东接口。
- `src/utils/format.ts`：金额展示格式；领域数据保存数值，不保存带货币符号的价格。

硬件选项 ID 仅是本地演示标识，不是京东 SKU。右侧精选池商品使用京东 itemId，保持原始字符串，不转成数字 SKU，也不由 mainSkuId/productId 推断请求 SKU。
演示配置方案引用目录中的选项，其总价由配件金额求和，不能另写一个不一致的总价。

## 后端

- `integrations/jd/`：京东联盟请求、签名、返回字段映射。
- `ingestion/`：采集任务及原始响应保留。
- `cleaning/`：清洗规则，并记录处理原因。
- `models/`：SQLite 初始结构与对外响应类型。
- `repositories/`：数据库操作；`api/`：HTTP 查询与搜索任务入口。

精选池 → itemId → 场景 1 详情已通过真实调用，保存原始响应、每条商品和清洗依据；普通 SKU/关键词入口仍受权限限制。

## 实体边界

1. `hardware` 是品牌、完整型号和版本确定的标准硬件。
2. `products` 是平台商品，通过 `(platform, platform_product_id)` 唯一识别；未匹配型号时 `hardware_id` 为空。
3. `price_snapshots` 保存每次采集的报价，不覆盖旧价格。数据库以整数“分”保存，接口以数值“元”输出。
4. `ingestion_tasks` → `raw_records` → `cleaning_events` 记录任务、原始响应及清洗依据；报价关联原始记录。
5. `jd_pool_runs` 保存采集计数；`jd_pool_items` 保存当前有效的硬件索引；`jd_item_details` 保存同一 itemId 的图文原始详情。内部产品标识使用 `jd:item:` 前缀，与旧数字 SKU 数据分开。

展示价、券后价、定金不可混比。当前查询接口只返回每个商品最新的有效展示价；最新展示价缺失时不回退成过期价格。
时间采用带时区的 ISO 8601 格式。缺失价保留 NULL，无效价应排除或待核验，不填成 0。

初始 SQL 使用 `CREATE TABLE IF NOT EXISTS`，仅适用于当前新库初始化；后续调整表结构前需建立迁移流程。
本次只新增表，旧表不修改、不清空；已有本地数据库会在后端启动时补建新表。

## 京东联调需要确认

授权的接口名称、签名方式、分页规则、限流要求，以及脱敏响应样例。
字段及可用权限以该接口文档为准，不假设返回完整硬件参数。
App Secret、Token、请求签名不得写入前端、原始业务响应、日志或版本库。

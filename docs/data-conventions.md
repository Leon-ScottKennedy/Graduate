# 数据组织约定

## 前端

### 硬件参数展示

2026-10-29 补采覆盖全部八类、164 个本地目录型号。新增 22 个具体型号的厂商快照，补齐 40 个原有缺项；详情与参数对比共用这些数据。运行 `npm run audit:specifications` 可逐类列出仍缺失的字段。当前已定义字段的缺项由 65 个减少至 25 个，此数字不表示已经收录厂商公开的所有参数，也不覆盖运行时新发现但尚未核实的型号。

七彩虹规格页的参数由公开接口 `Home/GetAttrbuteValue?mid=102&id=...` 动态加载；本次读取后将具体型号、尺寸、功耗、建议电源等静态核验结果保存在 `manufacturerSpecificationUpdates.ts`，不在浏览器运行时抓取官网。每条新增记录保留产品页与 `checkedAt`。尺寸中的“不含挡片”说明必须保留，不能自动当作装机兼容性结论。

剩余缺项包括：16 款内存的 19 个频率/时序字段、3 款显卡的 4 个字段、WD500K 的模组类型以及原版平头哥 M2 的散热器限高。内存系列名与容量不能唯一确定时序；例如 Kingston FURY Beast 和 CORSAIR VENGEANCE 的 6000MT/s 存在多个 CL 版本，需要完整料号。原版 M2 不复用 M2 Mesh/Pro/V2 数据。WD500K 官网存在版本与标签差异，未核实的模组类型保持缺失。显卡不以同芯片、OC/非 OC、MAX、不同容量或其他地区近似型号的尺寸替代。未取得准确资料的字段继续显示“待补充”。

本次补采只丰富展示参数，不改动选配价格、硬件身份、自动预算分配或兼容性约束。中文品牌匹配也保留中文字符，避免品牌归一化为空字符串时误用其他品牌资料。

- `src/data/specificationReference.ts` 保存处理器、GPU 芯片等通用规格；`src/data/manufacturerSpecifications.ts` 保存核对过的具体品牌型号规格和厂商来源，核对日期为 2026-10-28。
- 具体型号记录必须同时匹配类别、品牌、规范化型号；仅明确登记的别名可复用，不能把 OC、非 OC、不同容量或 V2 版本混为一款。内存时序需要完整料号证据，不能根据系列名猜测。
- `src/services/partSpecifications.ts` 将上述资料与已有参数合并，供当前配置、同档候选的参数展开区使用。此层只补展示，不改写价格、兼容性约束或自动选配结果。
- 同一 SSD 系列按容量分别记录标称速度；风冷的冷排、水冷的塔式高度显示“不适用”，真正未知的字段仍保留“待补充”。来源链接由 `BuildPartSpecifications.vue` 去重并限制 HTTP(S)。
- 修改后运行 `npm run test:specifications`，检查品牌和版本隔离、容量对应速度、来源保留及全目录覆盖。

当前同档候选采用[全目录候选发现](candidate-discovery.md)，不再受手写型号数组限制。`candidateDiscovery.ts`按规格读取后台全品牌记录并合并到右侧候选；`public_reference_records`存整类公开渠道参考，`products`与`price_snapshots`仍存平台商品与报价，不能混写。由标题解析得到的候选保留参数待核验标识，不凭同价推定性能或完整兼容性。

- `src/types/hardware.ts`：配件展示、配置方案与硬件对比类型。
- `src/data/mock/catalog.ts`、`src/data/mock/candidateOptions.ts`、`src/data/hardwareExpansion.ts`、`src/data/crossBrandCandidates.ts`：基础、候选、扩展和跨品牌标准型号目录；预设参考价不是平台实时数据。跨品牌补充目录不进入自动预算选配，缺价时仅展示待报价型号。
- `src/services/catalogService.ts`：演示数据提供者；配置方案与对比页复用该目录。
- `src/services/apiClient.ts`：统一后端请求、访问验证和错误处理；商品查询由候选发现与推荐服务调用。
- `src/utils/format.ts`：金额展示格式；领域数据保存数值，不保存带货币符号的价格。
- `src/services/recommendationDiscovery.ts`：先请求豆包选型，再解析后端查库与补采结果；没有标准参数的商品不自动成为可替换硬件。
- `server/app/api/recommendations.py`：豆包建议、标准版本校准、SQLite 报价查询和缺价补采的串联入口。豆包不生成商品报价或商品链接。
- `server/app/api/alternatives.py`：同档替换的独立报价查询与补采入口，不调用豆包；前端已知价格默认最多加价15%，符合规格与兼容条件的低价型号不限降价幅度。
- `src/data/referencePriceBook.ts`：53项缺价型号的独立参考价档案，包含公开/历史/渠道、海外及估算三类依据；不写成真实店铺报价。`referencePrice`记录来源，`observedMarketOffer`另存后来查询到的展示价。详见[参考价约定](reference-prices.md)。

硬件选项 ID 仅是本地演示标识，不是京东 SKU。右侧精选池商品使用京东 itemId，保持原始字符串，不转成数字 SKU，也不由 mainSkuId/productId 推断请求 SKU。
演示配置方案引用目录中的选项，其总价由配件金额求和，不能另写一个不一致的总价。

## 后端

### Intel 平台选配

智能装机支持“不限平台 / AMD / Intel”选配偏好。原目录已含 i5-14600K、i7-14700K、i9-14900K 的参考价；本次补充微星 PRO B760M-A WIFI、PRO Z790-A WIFI 与华硕 PRIME B760M-A WIFI、PRIME Z790-P WIFI，均为 LGA1700 / DDR5，不能复用 DDR4、MAX、II 变体。华硕 B760M 的价格暂按同平台微星型号估算，来源中明确标识，其余使用具体型号公开参考价。

CPU 候选允许跨接口参数比较，单件加价筛选仍生效；跨平台候选不能直接拖拽替换。点击“换平台方案”或参数对比弹窗，会预览需要联动的 CPU、主板、散热器及整机总价，确认后一次应用。只在已有目录中找预算内且没有明确兼容冲突的组合，优先少换配件；其余配件保持。无法匹配时允许比较参数，但禁止应用。主板 BIOS、内存 QVL 和实际散热扣具仍需核对。

自动选配在动态规划裁剪前检查 CPU/主板接口和已知散热扣具，防止错误平台的组合抢占同价状态。CPU 平台偏好仅控制重新生成整机配置；手动换平台需要用户明确确认。参数资料仍不直接改写兼容性约束；本次只为已核实的 AK400、Peerless Assassin 120 SE、AK620、LS720 单独登记扣具支持。

运行 `npm run test:intel-platform` 验证两平台自动选配、跨平台对比、双向联动、无主板/预算不足保护和数据不变性。

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
# Intel CPU 参数补全（2026-10-29）

`src/data/intelCpuSpecifications.ts` 保存 33 款第 12–14 代 Intel 桌面处理器的 Intel ARK 规格快照，供硬件详情与参数对比共用。字段包括核心线程、P/E 核、核显、频率、基础及最大睿频功耗、缓存、内存与 PCIe，并保留具体型号的官方来源链接。功耗为处理器规格，内存支持需结合主板与 BIOS。

后台发现的商品标题允许附加“10核16线程”“散片”等说明；F、K、KF 按独立型号匹配，多型号混合商品和未核验后缀继续保留缺失提示，不从相近型号推断。此次补全不修改价格或兼容性规则。


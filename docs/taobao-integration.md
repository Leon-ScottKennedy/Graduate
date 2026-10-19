# 淘宝联盟查询联调

## 16516 物料搜索接入

用户已提供 16516 获批截图。现已实现 `taobao.tbk.dg.material.optional.upgrade` 的关键词搜索，场景固定为 1，凭据及推广位只在后端使用。额外必需参数 `TAOBAO_ADZONE_ID` 为自己 PID 的最后一段（推广位 ID），不是 AppKey。当前接入阶段该值尚未配置，不能将权限截图当作真实查询成功。

后续配置已补齐：用户填写完整 PID，配置读取已兼容 `mm_数字_数字_数字` 与最后一段数字，自动提取推广位，不改写用户原值。AppKey 已核对与之前控制台应用一致。真实调用原版 `taobao.tbk.dg.material.optional` 与升级版 `taobao.tbk.dg.material.optional.upgrade` 均返回业务错误 `11:isv.permission-api-package-limit`，平台列出的 scope 已含 16516。因此应继续核对获批包内实际 API 列表或向平台确认权限同步，不能误报为缺推广位、签名错误或商品零结果。

最近升级版请求编号 `15rv9r8jrllcw`，用于平台定位，无密钥；请求使用场景 1、关键词 `RTX 4070 SUPER`、自己的推广位和 HTTPS。本轮未取得商品、未增加正式商品数据。需要用户提供 16516 的实际 API 英文名称列表才能进一步排查，不盲目申请其他无关权限。官方错误码解释：[权限包未允许当前 API](https://developer.alibaba.com/docs/doc.htm?articleId=101645&docType=1&treeId=1)。

接口依据：[官方物料搜索升级版](https://developer.alibaba.com/docs/api.htm?apiId=64759)。搜索不接受普通商品链接；使用型号关键词，多规格价格不直接作为某一 SKU 价格。搜索列表只显示折扣展示价，预估到手价另列，不用券后价填补缺失展示价。预售不写作有效单件展示价快照。原始响应、清洗记录、搜索缓存、商品及快照写入本地 SQLite，`hardware_id` 保持空，待核对后才可走人工关联报价。

新增接口：`GET /api/taobao/status`、`POST /api/taobao/search`、`GET /api/taobao/search`。缓存读取不发起远程请求；界面只在点击“搜索淘宝”或翻页时请求平台。失败会记录失败任务并明确报错，不伪造空搜索成功。页面入口为配件详情“淘宝商品”，保留关键词、分页、采集时间、店铺和商品级价格。

只读联调命令（不写库）：

```powershell
server/.venv/Scripts/python.exe server/scripts/check_taobao_search.py --keyword "RTX 4070 SUPER"
```

目前验证：57 项后端测试通过；前端构建和目标 ESLint 通过；模拟 API 的浏览器检查已验证笔记本与手机下搜索、分页、缺失价格不被预估优惠价替换，以及不会自动发起搜索。真实平台取数待配置自己的推广位后验证，未向正式库注入测试商品。

接口：`taobao.tbk.item.info.get`，HTTPS 表单 POST、MD5 签名、北京时间；最多 40 个商品标识，凭据仅来自后端 `TAOBAO_APP_KEY` / `TAOBAO_APP_SECRET`。已获得权限包 16189，商品物料获取 27939 仍在申请中（以用户后续控制台状态为准）。

只读测试：

```powershell
server/.venv/Scripts/python.exe server/scripts/check_taobao.py --item 769696180391
server/.venv/Scripts/python.exe server/scripts/check_taobao.py --scene 1 --item 从联盟接口取得的新商品ID
```

也可用 `--item` 传入引号包裹的淘宝/天猫完整 HTTPS 商品链接。代码只解析链接，不抓取详情页面；原 URL 和 skuId 在解析结果中保留。SKU ID、mi_id 与联盟新商品 ID 不互相替代，不自行推算。

## 2026-10-18 实测

使用用户提供的天猫商品 `769696180391` 调用：

- 场景 2（消费者比价）：返回 `15:1911`，说明“不支持该sceneId”。
- 场景 1（文档默认）：返回 `15:-4003`，说明商品 ID 不合法，要求使用升级后的新商品 ID。

因此网络请求已到达业务接口，但该样本未取得有效商品数据。不能据此宣称已完成淘宝采集、密钥无效、商品不存在或接口所有场景均不可用。下一步需从获准的联盟物料获取/搜索接口取得新商品 ID，再按对应场景联调；不能把普通详情页数字 ID 或链接里的其他跟踪参数当作新 ID。

当前没有新增淘宝数据库记录，也没有改动京东数据或页面报价。清洗函数及查询脚本已完成，待取得真实成功样本后确认字段再接入持久化。

## 价格与清洗

返回结果固定标为商品级、SKU 未核验、型号未匹配。一口价、折扣价、活动价分别转为整数分；无效/缺失值保持空，不用活动价补齐折扣价。预售单独标记，不能直接用于 SKU 或跨平台最低价。该接口返回标题不代表取得完整结构化硬件规格。

测试：`server/.venv/Scripts/python.exe -m unittest discover -s server/tests`（从根目录运行还需配置 PYTHONPATH；推荐进入 server 后执行 `.venv/Scripts/python.exe -m unittest discover -s tests`）。

依据：[接口文档](https://developer.alibaba.com/docs/api.htm?apiId=24518)、[官方签名说明](https://developer.alibaba.com/docs/doc.htm?articleId=107727&docType=1&treeId=445)、[场景 2 只接受数字 ID 的官方说明](https://developer.alibaba.com/support/hotProblemDetail.htm?id=696172&source=search)。
# 2026-10-19 当前状态

再次只读调用已配置的 `taobao.tbk.item.info.get`，使用原示例数字商品 ID `769696180391`：场景 1 返回 `15:-4003`（请使用新商品 ID），场景 2 返回 `15:1911`（不支持该场景）。本次仍未取得商品数据，也未写数据库。

这不能证明所有商品详情权限都已失效：有效的新商品 ID 是否能通过场景 1 返回结果仍需实测；目前尚无成功证据。不能将用户的普通数字商品链接直接当作可查询的新商品 ID，也不能承诺已拒绝的搜索权限可以绕过。

不依赖接口的淘宝/天猫人工店铺报价与 CSV 导入已经实现，见 [本地报价说明](manual-quotes.md)。人工记录不标记为淘宝 API 获取的数据。

## 官方 SDK 核对（2026-10-19）

### 16516 获批后的新版 SDK

根目录新增 `oss_1792412704685_null_Nvl0PMFd.zip`。对比旧包 43 个 ZIP 条目，新包为 50 个条目；新增 ability370 请求合同只有临时物料搜索 `taobao.tbk.dg.material.temporary.optional` 和店铺搜索 `taobao.tbk.shop.get`。可使用 `server/scripts/inspect_taobao_sdk.py --sdk 新包 --previous 旧包` 安全读取 AST 对比，不导入、执行下载代码。

临时搜索按 SDK 参数只读测试返回业务错误 22（非法 API 名称）。进一步完全复现 SDK 的默认 HMAC-SHA256、partner_id、simplify 和公参/表单传输方式，仍返回 22，请求编号 `15r3ano0jrjz4`，没有商品数据，不改变正式库。不能仅因 SDK 中有定义就把生产接口切到这个不可用名称。

店铺搜索 q=MSI 返回 2 条店铺结果，q=RTX 4070 SUPER 和不存在的测试词均返回 0 条。它是店铺信息，不是商品/SKU 数据，没有硬件报价，未入商品库，也不能据此宣称硬件比价链路成功。

已整理可提交给平台的具体证据与问题：[权限工单草稿](taobao-permission-ticket.md)。当前剩余阻塞是平台对获批权限包与实际可调用商品搜索 API 的对应关系，尚无已验证的商品采集替代接口。

用户放在项目根目录的 `oss_1792409994708_null_mCIJWELm.zip` 内还有一层 `taobao-sdk-NEW_PYTHON3null.zip`。已检查代码并安全解包到忽略目录 `.tmp/taobao-sdk/`，保留原包，不安装其中固定到 2021 年版本的 HTTP 依赖。

SDK 的 ability371 包含基础、临时及升级版详情接口，但不包含物料搜索/新商品 ID 转换请求定义；打包存在某接口并不能证明服务端已启用或账号有权限。

使用 SDK 的参数定义、纯签名工具以及现有 httpx 传输进行了只读联调。合成参数下官方 SDK 的 MD5 与现有实现完全一致。真实请求使用 SDK 默认的 HMAC-SHA256、HTTPS 和 `simplify=false`，输入原样本 `769696180391`：

- `taobao.tbk.item.info.get`，场景 1：HTTP 200，业务错误 `15:-4003`，要求升级后的新商品 ID。
- `taobao.tbk.item.info.temporary.get`：HTTP 200，业务错误 `22`，非法 API 名称。
- `taobao.tbk.item.info.upgrade.get`，按 SDK 使用 `item_id`（不是基础版的 `num_iids`），场景 1：业务错误 `15:-4003`。
- 升级版场景 2：业务错误 `15:1911`，不支持该场景。

本次没有取得商品、店铺或价格数据，未写数据库。不能将 HTTP 200 当作商品查询成功，也不能据此更改已有数据源为已接通。生产查询实现继续保留，升级接口目前只放在诊断脚本，直到拿到有效新商品 ID 成功样本再接入响应清洗。

可重现脚本（读取 `.env`，不打印密钥，结果保存在 `.tmp/taobao-sdk-result.json`）：

```powershell
server/.venv/Scripts/python.exe server/scripts/check_taobao_sdk.py --sdk oss_1792409994708_null_mCIJWELm.zip
```

传 `--item` 可使用其他有效商品标识测试。新商品 ID 必须来自获准的联盟链路，不能把普通数字商品 ID、SKU ID、mi_id 或随机字符串当成它。


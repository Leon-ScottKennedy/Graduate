# 16516 获批后 API 不一致工单

可将以下内容复制到淘宝联盟/开放平台工单，并附上 16516“已获得”截图。应用身份通过提交工单时的平台应用选择器提供，不要附 AppSecret、签名或 `.env`。

---

标题：16516 已获批，新下载官方 SDK 中临时物料搜索接口返回 Invalid Method

您好，本应用已获得 16516「淘宝客【推广者】物料搜索」及 16189「淘宝客【公用】物料信息查询」权限。

获批后重新下载服务端 Python3 SDK，其中 ability370 仅新增以下 API：

1. `taobao.tbk.dg.material.temporary.optional`
2. `taobao.tbk.shop.get`

我们使用自己的 AppKey、对应 AppSecret 和已创建推广位，调用正式 HTTPS 网关 `https://eco.taobao.com/router/rest`：

- 临时物料搜索：关键词 `RTX 4070 SUPER`，page_no=1，page_size=20，platform=1，adzone_id 使用自己的推广位。返回 HTTP 200，但业务错误 `22`，提示 `不合法ApiName,ApiName = taobao.tbk.dg.material.temporary.optional`。
- 已按 SDK 默认 HMAC-SHA256、partner_id=new_python3_sdk、simplify=true、公参在 URL/业务参数在表单的方式复现，仍是同一错误。请求编号：`15r3ano0jrjz4`。
- 原版 `taobao.tbk.dg.material.optional` 和升级版 `taobao.tbk.dg.material.optional.upgrade` 均返回 `11:isv.permission-api-package-limit`，错误中列出的 scope 包含 16516。升级版请求编号：`15rv9r8jrllcw`。
- SDK 中同一 ability370 下的 `taobao.tbk.shop.get` 能正常响应，说明并非所有调用都因签名或网络失败；但它不提供所需商品报价。

请协助确认：

1. 当前 16516 实际允许调用的商品关键词搜索 API 英文名称是什么？
2. SDK 内临时物料搜索 API 是否已经停用或未在正式环境开放？如已停用，能否修正 SDK 并提供可用替代接口？
3. 已获批权限是否还需后台同步、绑定其他权限，或办理迁移？如需其他权限，请说明准确权限包及申请条件。

我们的业务是电脑硬件选购和同型号店铺报价比较，当前处于开发测试阶段，请按此真实场景确认适用接入路径。谢谢。

# 候选筛选

## 当前页面流程（2026-10-24）

当前查询机制见[全目录候选发现](candidate-discovery.md)：已接通按规格查询SQLite全部品牌、整类公开报价批量更新及规格关键词补采。下面的手工目录作为本地初始数据保留，不再限定可发现的型号范围。

整机优化现改为[按需求比例分析整机](demand-optimization.md)：用户调整四项用途比例后主动请求豆包分析，建议可跨多个目标类别，各方案分别核算并确认应用。

2026-10-25筛选更新：原先对称的±15%已改为单向加价上限，默认最多加价15%。符合规格及兼容条件的更便宜型号不受降价幅度限制，直接列入可替换候选；涨价超过上限的产品卡片完全隐藏，用户主动点击“查看全部价位”后才展示，候选为空也不自动展开。下面2026-10-24的区间与数量描述为当时的历史验证记录，以本段规则为准。

价格补充：此前53项缺价型号现已补入带来源的参考价，包含17项明确标注的估算。候选无需等待实时接口即可按参考价比较；平台展示价另存，默认不覆盖这套参考价口径。原有±15%过滤继续执行，超范围型号可切换全部价位查看。详见[硬件参考价](reference-prices.md)。

2026-10-24补充：`comparisonCatalog.ts`新增26个带独立公开价格依据的标准型号（显卡16、主板2、内存3、SSD5），不按当前选中价格生成报价。包括5070 Ti的华硕、技嘉、七彩虹版本，以及5070、5080、5060、B850、64GB DDR5、1/2TB及512GB Gen4固态。来源页与查阅日期保存在每个型号的`referencePrice`；部分为历史渠道记录，均不承诺实时库存或成交价。仍只在候选目录使用，不混入自动预算演示目录。

主列表保持±15%；超限同规格型号单独预览，显示金额和差价百分比，主列表为空时自动展开。点击“查看同规格全部价位”才解除价差过滤；搜索、品牌及兼容条件继续有效。不同品牌各先展示一个版本，防止同品牌多个版本占满前八项。更换当前配件重置品牌、搜索和展示数量，避免旧筛选造成空白。

`npm run test:comparison-coverage`检查40个可自动选中型号在显卡、主板、内存、SSD四类中都有跨品牌同规格备选，检查替换后可继续选择、价格边界、无重复和品牌展示顺序。截图5070 Ti 8099元的±15%区间内有6个其他版本，覆盖华硕、技嘉、七彩虹。该覆盖不代表每个型号的±15%内必有其他品牌；原有预设、历史公开和渠道参考价的时间口径存在差异，因此超限预览保留原始金额，不改价凑数量。

同档替换不再调用豆包，直接按标准规格跨品牌匹配，默认价差 **±15%**。显卡要求完整芯片名（包括 Ti / SUPER）及显存容量相同；主板要求相同芯片组、平台、内存代际和板型；内存保持 DDR 代际、总容量与相近频率；SSD 保持容量。不凭价格推导实测性能。

候选报价会独立查询 SQLite，不等待 AI；AI 请求有界排队，页面取消的旧请求会中断模型调用，释放处理位置。真实上游限流和排队超时仍需显式显示。

智能装机右侧包含两个入口：

1. **同档替换**：立即展示已有标准型号，调用 `/api/market/alternatives` 先查 SQLite 报价，再补采缺失数据。默认显示八项，可继续展开；排除当前型号、重复型号、明确兼容冲突。已知价格执行 ±15% 筛选；缺价型号标为待报价、不能替换、不声称符合价差。
2. **整机优化**：豆包提出升级目标和 `reduceCategories`（允许降低预算的类别），程序仅在这些类别中寻找降配，显示每项旧型号、新型号、节省金额和整机总价。不降低当前电源额定功率，保留容量底线，主板平台保持不变，明确兼容冲突不得应用。

首次建议没有对应标准版本时，会再将相关的已登记型号交给豆包校准，只有实际匹配的型号才能进入可应用方案，不把其他版本冒充原推荐型号。

报价查询优先本地数据库，没有近期有效的准确型号报价时，尝试已有京东、淘宝采集接口；同档替换每轮最多补采六个型号，优先覆盖不同品牌，整机优化最多两个，同型号十分钟内不重复补采。遵守淘宝接口调用间隔。采集结果仍经过版本、容量、商品成色和店铺等既有匹配规则。接口权限不足、限流、没有准确商品和没有标准参数分别保留状态，不伪造价格。

标准目录目前来自前端演示目录、补充目录与扩展目录，真实平台商品及报价在 SQLite 中；这两类数据并非同一个库。只找到商品、没有标准参数时可展示为待核验条目，不能直接作为完整兼容硬件替换。

未知目标价格时只显示条件方案与可接受单价上限，可输入试算价；试算价不会写成平台报价。应用整套方案前重新检查配置版本、预算及兼容冲突。豆包失败时明确显示错误，不把规则筛选伪装为豆包结果。

相关代码：`crossBrandCandidates.ts`、`candidateSelection.ts`、`api/alternatives.py`、`recommendationDiscovery.ts`、`buildOptimization.ts`。验证：`npm run test:candidates`、`npm run test:optimization`、后端 `tests.test_recommendations`。

新增跨品牌目录以厂商资料确认型号，不写入臆造的价格。5060 Ti 8GB 包括 [ASUS Dual / Prime / TUF](https://press.asus.com/news/press-releases/asus-announces-nvidia-ge-force-rtx-5060-5060-ti-graphics-cards/)、[微星 VENTUS](https://storage-asset.msi.com/datasheet/vga/hk/GeForce-RTX-5060-Ti-8G-VENTUS-2X-OC-PLUS.pdf)、[技嘉 WINDFORCE](https://www.gigabyte.com/Graphics-Card/GV-N506TWF2OC-8GD)、[七彩虹战斧](https://www.colorful.cn/home/product?id=50f7f597-c6cd-4bb4-85f1-6cf41d3ec70b&mid=102)。内存补充 [芝奇 Flare X5](https://www.gskill.com/specification/165/396/1662622664/F5-6000J3636F16GX2-FX5-Specification)与[十铨 VULCAN](https://images.teamgroupinc.com/products/memory/u-dimm/ddr5/vulcan/spec-sheet/vulcan-en.pdf)，固态补充[雷克沙 NM790](https://resources.lexar.com/download/1048/documents/13165/lexar-productsheet-ssd-nm790-en-202410.pdf)。

## 保留的本地筛选工具与历史分组依据

以下记录早期独立筛选工具的分组约定；当前智能装机页面以以上两条流程为准。

候选名单不包含当前已选型号。先匹配规格档位，再限制预设参考价在当前配件的 80%—120%，最后按价差排序。不会为了凑数量放宽档位；缺少依据时返回空列表。价格限制不是整机预算或实时店铺报价。

- 显卡：完整芯片型号（包括 Ti、SUPER、D 后缀）和显存容量相同，可比较不同厂商版本；不凭同价或同显存把不同芯片归为同档。目前不是跨芯片跑分排序。
- CPU：登记 8400F/8600G、7500F/7600、7700/7700X、7800X3D/9800X3D、7900X/7900、9950X/7950X 等独立组；区分六核、八核、十二核、十六核和 X3D。跨代组参考厂商资料和实测评测，不声称所有应用中性能相同或差距固定。
- 内存：登记相同 DDR 代际、总容量与双条套装的组；两侧频率已知时差距不得超过 10%。原预设未指定频率时仍保留未知，不补造频率，具体时序和超频配置待核验。
- 主板：分别登记芯片组、接口、板型与无线功能相近的组；供电、BIOS、接口数量和尺寸仍需核验。
- 电源：登记相同额定瓦数，已知时对应认证等级与模组类型；500W 预设的认证未指定，不宣称认证相同，接口和电气质量仍待核验。
- SSD：按容量、PCIe 4.0、TLC 及是否独立 DRAM 分组，不混入不同容量/缓存类别。不能据此保证随机读写、满盘和持续写入表现一致。
- 机箱：按 M-ATX/ATX、网孔风道等规格分组，不把外形或价格转成散热跑分；显卡限长、散热器限高和冷排安装空间待核验。
- 散热器：区分 120mm 单塔、120mm 双塔和 360 水冷；不跨类别凑候选，不将厂商 TDP 当成统一实测指标，温度、噪声和安装空间待核验。

分组由 `candidateFamilies.ts` 显式维护，不再只依赖标题解析。未知型号不会自动套用已知型号的档位。候选按商品 ID 与规范化名称去重，排除当前型号；替换为补充型号后仍能从原目录及补充目录查找替代项。

补充的候选放在 `candidateOptions.ts`，不进入自动预算选配目录。新增候选参考价是原型预设值，不是查询到的现价，不写入京东数据或价格历史。更换候选需通过[基础兼容检查](build-compatibility.md)；存在冲突时禁用替换并给出原因。基础检查无已知冲突仍不等于整机完全兼容，缺失信息继续标记待核验。

## 规格依据

- [ASUS Dual RTX 4070 SUPER OC 12GB](https://www.asus.com/il/motherboards-components/graphics-cards/dual/dual-rtx4070s-o12g/techspec/)
- [GIGABYTE RTX 4070 SUPER WINDFORCE OC 12G](https://www.gigabyte.com/uk/Graphics-Card/GV-N407SWF3OC-12GD-rev-10/sp)
- [MSI RTX 4060 VENTUS 2X BLACK 8G OC](https://www.msi.com/Graphics-Card/GeForce-RTX-4060-VENTUS-2X-BLACK-8G-OC/)
- [AMD Ryzen 5 7600](https://www.amd.com/en/products/processors/desktops/ryzen/7000-series/amd-ryzen-5-7600.html)
- [AMD Ryzen 7 7700X](https://www.amd.com/fr/products/processors/desktops/ryzen/7000-series/amd-ryzen-7-7700x.html)

这些来源用于核对型号与规格，不作为预设价格的依据，也不是实测性能排名。

验证命令：`node scripts/test-candidates.mjs`。

## 补充规格与评测来源

- [AMD 8000G 发布资料](https://ir.amd.com/news-events/press-releases/detail/1177/amd-reveals-next-gen-desktop-processors-for-extreme-pc-gaming-and-creator-performance)、[Ryzen 9 7900](https://www.amd.com/en/products/processors/desktops/ryzen/7000-series/amd-ryzen-9-7900.html)
- [AMD 9800X3D 与 7800X3D 测试说明](https://ir.amd.com/news-events/press-releases/detail/1225/the-gaming-legend-continues-amd-introduces-next-generation-amd-ryzen-7-9800x3d-processor)、[TechSpot 9950X 实测](https://www.techspot.com/review/2881-amd-ryzen-9-9950x/)
- [ASRock RX 6400](https://asrock.com/news/index.asp?iD=4930)、[ASUS 4070 Ti SUPER](https://www.asus.com/us/motherboards-components/graphics-cards/dual/dual-rtx4070tis-o16g/)、[MSI 显卡目录](https://my.msi.com/Promotion/beyond-fast-Geforce-RTX40-Series/graphics-cards)、[MSI 5080 GAMING TRIO](https://www.msi.com/Graphics-Card/GeForce-RTX-5080-16G-GAMING-TRIO-OC)、[GIGABYTE 4090 D](https://www.gigabyte.com/hk/Graphics-Card/GV-N409DWF3-24GD/sp)
- [ASRock AM5 主板目录](https://www.asrock.com/support/index.asp?cat=ComboAM5)、[B650M Pro RS 规格](https://download.asrock.com/Download/e-catalog/B650M%20Pro%20RS%20WiFi.pdf)、[GIGABYTE B650M AORUS ELITE AX](https://www.gigabyte.com/Motherboard/B650M-AORUS-ELITE-AX-rev-10-11/Support)、[ASRock B650E PG Riptide](https://www.asrock.com/mb/AMD/b650e%20pg%20riptide%20wifi/index.asp)
- [CORSAIR VENGEANCE DDR5 目录](https://www.corsair.com/us/en/c/root/memory?filter-memory-series=vengeance-ddr5)、[Kingston FURY Beast](https://www.kingston.com/en/memory/gaming/kingston-fury-beast-ddr5-memory?kit=kit+of+2&speed=6000mt%2Fs)、[Renegade 64GB 6000 双条规格](https://www.kingston.com/datasheets/KF560C32RSK2-64.pdf)
- [WD 产品对照](https://documents.westerndigital.com/content/dam/doc-library/en_us/assets/public/western-digital/collateral/brochure/brochure-wd-black-product-comparison-chart.pdf)、[WD Blue SN580](https://support-en.sandisk.com/app/products/product-detailweb/p/8878)、[KC3000](https://www.kingston.com/unitedkingdom/en/ssd/kc3000-nvme-m2-solid-state-drive?capacity=1024gbSSD)
- [MSI A650GL/A750GL 手册](https://download.msi.com/archive/mnu_exe/psu/MAGA850GL_A750GLPCIE5A650GL.pdf)、[CORSAIR 电源目录](https://www.corsair.com/uk/en/c/psu?filter-zero-rpm-mode=yes)
- [MONTECH AIR 100 LITE](https://www.montechpc.com/air-100-lite)、[AIR 903](https://www.montechpc.com/news-air-903)、[DeepCool 机箱目录](https://www.deepcool.com/products/Cases/index.shtml)、[LIAN LI LANCOOL 207](https://lian-li.com/product/lancool-207/)
- [DeepCool AG400 手册](https://www.deepcool.com/download/pdf/AG400%26AG400_LED.pdf)、[Assassin Spirit 120 EVO](https://www.thermalright.com/product/assassin-spirit-120-evo/)、[Phantom Spirit 120 SE 手册](https://thermalright.com/backup/2023manual/PHANTOMSPIRIT120SE.pdf)、[DeepCool LT720](https://deepcool.com/products/Cooling/cpuliquidcoolers/LT720-360mm-Liquid-CPU-Cooler-1851-1700-AM5/2024/16286.shtml)

## 覆盖验证

当前原型 42 个预设型号均有至少一个其他候选。测试覆盖六档预算、四种用途和八类配件的 192 种组合，并检查当前型号排除、价差上限、未知型号、显存冲突、重复 ID、替换后继续选配及原目录不被修改。这是本地预设覆盖，不代表京东商品覆盖。

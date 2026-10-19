# 候选筛选

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

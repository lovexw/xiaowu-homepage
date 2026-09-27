# 我的基因组 · Open Genome Report

基于个人消费级基因芯片数据的**开源基因组分析报告网站**。
数据所有者（[lovexw](https://github.com/lovexw)）本人确认并同意公开自己的基因分型数据。

**在线预览**：Cloudflare Pages（见 docs/DEPLOY.md 部署状态）
**本地预览**：`make serve` → http://localhost:8080

> ⚠️ 本站为研究性自我解读，不构成医疗建议、诊断或用药依据。

## 数据概况

| 项 | 值 |
|---|---|
| 检测平台 | Illumina ASA（亚洲筛查芯片）+ 1000 Genomes 填充（gesedna 导出，2019-12） |
| 实测位点 | 699,321（缺失率 0.47%） |
| 填充位点 | 4,766,974（与实测严格互补，无重叠） |
| 合计 | 5,466,295 位点，GRCh37/hg19，正链方向 |

## 报告模块（按科学可靠度排序）

1. 💊 **药物基因组学** — CYP2C19/CYP2C9/CYP3A5/VKORC1/SLCO1B1/DPYD/NUDT15/TPMT/ALDH2/IL28B 等，对标 CPIC 指南；CYP2D6/HLA 明确不推断
2. 🥗 **代谢与营养** — MTHFR、乳糖耐受、FADS 脂肪酸、咖啡因、胆红素、抗氧化等
3. 🧠 **特质与心理** — 认知/性格/感官/体质候选位点（效应量小，措辞已降级）
4. 🫀 **健康风险参考** — APOE、9p21 冠心病、T2D、FTO 体重、FOXO3 长寿、HFE 等（统计关联级）
5. 🛡️ **免疫与炎症** — 自身免疫主效位点 + 细胞因子产量
6. 🏔️ **祖先特征与高原适应** — 东亚正选择位点、EPAS1 高原适应、血型等
7. 🧭 **父系与母系单倍群（粗判）** — Phylotree B17 全树走查（母系）+ ISOGG 2016 主干标记（父系），
   全部判定证据以表格展示
8. 📊 **关联位点总表** — 330+ 位点的文献注释 + GWAS Catalog/dbSNP/SNPedia 外链
9. 🧫 **基因组概览与下载** — 每染色体统计图 + 全部原始分型 gzip TSV 下载

## 快速开始

```bash
git clone https://github.com/lovexw/open-genome-report && cd open-genome-report

# 完整重建（需要原始数据文件，位置见 pipeline/config.py）
make import && make verify && make reports && make export

# 本地预览
make serve   # http://localhost:8080
```

环境要求：Python 3.10+（仅标准库）。dbSNP 校验缓存已随仓库提交，`make verify` 离线可跑。

## 目录结构

```
├── AI_HANDOFF.md            # ⭐ 断点记录：接手必读
├── pipeline/                # 数据管线（Python 标准库）
│   ├── config.py            #   路径与个体配置
│   ├── import_genotypes.py  #   ASA+IMP → SQLite
│   ├── fetch_dbsnp.py       #   dbSNP 权威等位基因拉取（缓存已提交）
│   ├── verify.py            #   双重校验（用户清单比对 + dbSNP 比对）
│   ├── haplogroups.py       #   父系/母系单倍群推断（树感知走查）
│   ├── panels/*.json        #   ⭐ 解读面板（改内容只改这里）
│   │   └── haplogroup_trees.json.gz  #   Phylotree 17 + ISOGG 树数据（判定的唯一依据）
│   ├── build_reports.py     #   面板 × 基因型 → 网站 JSON
│   └── export_genome.py     #   按染色体导出 + 统计
├── site/                    # 纯静态网站（Cloudflare Pages 部署目录）
│   ├── index.html / assets/ #   零依赖 SPA
│   └── data/                #   构建产物（报告 JSON + 基因组 TSV.gz）
├── docs/                    # 部署 / 决策日志 / 路线图 / 数据许可
└── Makefile
```

## 方法与质控（详见站内「方法与数据质量」页）

- **链方向**：原始数据为正链；文献"基因方向"写法统一换算并标注。
  每个面板位点的正链等位基因均已用 NCBI dbSNP 官方 API 核验（306/306 成功，含单倍群标记）。
- **实测优先**：ASA 实测与 IMP 填充严格互补；报告优先使用实测位点。
- **不推断清单**：CYP2D6（结构变异）、HLA（高多态）、5-HTTLPR（indel）、
  BRCA1/2 大片段、Lynch 综合征基因、ACE I/D、Rh 血型等。
- **原文溯源**：解读文字全部原创；每个位点附 dbSNP / GWAS Catalog / SNPedia / PubMed 外链。

## 许可

- 代码：MIT
- 基因分型数据与报告内容：**CC BY-NC-ND 4.0**（仅可非商业、原样、署名转载；禁止演绎）
  > 2026-09-27 起收紧。此前以 CC BY 4.0 获取的副本依原许可；另附所有者使用边界声明
  > （禁止歧视性用途与再识别分析）。详见 [docs/DATA_LICENSE.md](docs/DATA_LICENSE.md)

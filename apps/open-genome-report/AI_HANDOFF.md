# AI_HANDOFF — 断点记录与接手指南

> 本文件是给「下一个接手的 AI 或人类」看的。每次工作会话结束前必须更新本文件
> 的「当前状态」与「下一步」。这是本项目的断点记录机制，请保持其准确性。

## 0. 一分钟了解本项目

- **是什么**：数据所有者（GitHub: lovexw）的个人基因组开源报告网站。
  原始数据为 gesedna 导出的 Illumina ASA 芯片分型（约 70 万位点实测）
  + 1000 Genomes 填充（约 477 万位点），坐标 GRCh37/hg19，正链方向。
- **所有者授权**：本人确认这是自己的数据，自愿开源展示（无危及生命的内容）。
- **形态**：Python 管线（本机解析原始数据）→ 生成静态网站（site/）→
  Cloudflare Pages 托管 + GitHub 同步。纯静态，无后端。
- **合规红线**：①原始大文件不入 Git（体积+敏感）；②报告定位「科研/信息展示」，
  不对外提供解读服务；③不推断临床级结论（CYP2D6/HLA/BRCA 等明确留白）。

## 1. 当前状态（最后更新：2026-09-27 v0.3.2）

### 版本历史
- **v0.3.2（当前）**：**数据许可收紧**：数据与解读从 CC BY 4.0 改为 **CC BY-NC-ND 4.0**
  （禁商用、禁演绎、原样署名转载），并新增所有者「使用边界声明」（禁止歧视性用途、
  禁止再识别/亲缘推断、非医疗建议）。变更记录写入 DATA_LICENSE §2.1：
  仓库 2026-09-27 01:23 UTC 以 CC BY 4.0 创建，同日收紧；BY 期间获得的副本依原许可
  （CC 许可不可追溯撤销）。同步更新 README / 站点页脚 / 基因组页 / 方法页的许可表述。
  若所有者进一步要求「禁止一切二次分发」（非 CC 许可，属保留所有权利+个案授权），
  只需按 DATA_LICENSE §2.2 的框架改写授权段。
- **v0.3.1**：①**站内搜索**（顶部搜索框 + `/` 或 Ctrl/Cmd-K 聚焦）：
  索引 `build_reports.py → site/data/search_index.json`（436 条目 = 106 解读位点 +
  330 关联表行，15 个页面；142KB，首次聚焦懒加载）；支持 rsID/基因名/关键词
  （人话版与解读文字全文命中）、多词 AND、分组排序（解读 > 关联表 > 页面）；
  点击结果跳转页面并滚动到条目锚点 + flash 高亮（关联表行补了
  `id={table}-{rsid}` 锚点）。②**切页回顶修复**：route() 渲染完成后统一滚动——
  无锚点时 `scrollTo(0, instant)`，有锚点（搜索跳转）时 `scrollIntoView(instant)` +
  350ms 二次校正（content-visibility 估算高度随真实渲染微调；smooth 滚动会被
  该过程打断，必须用 instant）。
- **v0.3.0**：①**单倍群模块**（`pipeline/haplogroups.py` + `#/haplogroups` 页 +
  首页徽章）：母系用 Phylotree 17.3 全树（5,435 支系）树感知走查 → **F2**（17 信息位点
  全匹配 0 矛盾；亚支 F2*/F2c 不可分，诚实留白）；父系用 ISOGG 2016 主干树（手工策展，
  树数据 `panels/haplogroup_trees.json.gz`）→ **Q1a1a1（M120）**（13 个单拷贝区衍生标记 +
  10 个兄弟支系祖先型排除；Y 多拷贝区 6.5-9.0Mb 读数不参与计分）；dbSNP 缓存扩至
  306 位点（含单倍群标记）。②关联表注释 146→223 条（表格覆盖率 58%→81%，
  剩余 64 条证据不足保持「—」留白）。③免疫模块 HLA 卡片补 3 条 PubMed 文献链接
  （special_cards 新增可选 links 字段）。④前端性能修复：去除吸顶头部 backdrop-filter
  （滚动卡顿主因）、main 入场动画去掉 both 填充（释放合成层）、.entry 加
  content-visibility（长页跳过离屏布局/绘制）。
- **v0.2.0**：①亮色现代主题（渐变主色/毛玻璃吸顶导航/hover 动效）；
  ②站点署名「小吴的基因报告」（数据主人本人乐意公开）；③全站科普层
  `pipeline/panels/popsci.json`——首页"30 秒读懂基因组"4 卡 + 每模块科普卡 +
  **全部 106 个位点逐条"🗣️ 人话版"一句话**（build_reports 自动合并渲染）；
  ④新增 11 个位点（ABCG2 Q141K 尿酸痛风杂合[东亚高频]、光喷嚏反射、
  虹膜颜色 HERC2/OCA2、SCN9A 痛觉、FGF21 嗜甜、G6PD 说明、SLC24A5 肤色等），
  面板总计 110 位点全部 dbSNP 校验通过、0 unknown；⑤判级配色规则修正
  （level_of：label 有利词优先于文本警示词）。
- **v0.1.0**：初版（数据管线 + 6 面板 + 关联表 + 静态站 + 部署）。

### 已完成 ✅
| 事项 | 位置 | 说明 |
|---|---|---|
| 数据合并入库 | `data/local/genome.sqlite`（gitignore） | 5,466,295 位点，ASA 699,321 + IMP 4,766,974，两文件严格互补无重叠 |
| 解读面板 6 个 | `pipeline/panels/*.json` | 药物基因组(23)/代谢营养(18)/特质心理(25)/健康风险(19)/免疫炎症(15)/祖先高原(10)，共 110 位点，0 unknown |
| 单倍群推断 | `pipeline/haplogroups.py` + `panels/haplogroup_trees.json.gz` | 母系 F2（Phylotree 17.3 全树走查 17/0）；父系 Q1a1a1/M120（ISOGG 主干树 13 衍生 + 10 支系排除）；页面 `#/haplogroups` + 首页徽章 |
| 站内搜索 | `build_reports.py → site/data/search_index.json` | 436 条目（106 解读位点 + 330 关联表行）+ 15 页面，142KB 懒加载；rsID/基因/关键词，跳转锚点 + 高亮 |
| 科普层 | `pipeline/panels/popsci.json` | 首页科普卡 + 模块科普卡 + 逐位点人话版；改文案只改这里，`make reports` 生效 |
| 关联注释字典 | `pipeline/panels/annotations_curated.json` | 223 条经典注释（v0.3 从 146 扩充），未收录者表格中显示"—"+外链 |
| dbSNP 权威校验 | `pipeline/cache/dbsnp/`（已提交） | 306 个位点全部拉取成功（正链等位基因 + GRCh37 位置，含单倍群标记），离线可复用 |
| 双重校验 | `pipeline/verify.py` → `site/data/quality.json` | 用户 8 份人工清单 494 条 vs 原始数据：100% 一致 |
| 报告生成 | `pipeline/build_reports.py` → `site/data/reports/*.json` | 模块 JSON + 5 张关联表(330 行) + 总览 + manifest |
| 全基因组导出 | `pipeline/export_genome.py` → `site/data/genome/chr*.tsv.gz` | 24 条染色体 gzip TSV（共 57MB，单文件 ≤4.1MB）+ 每染色体统计 |
| 静态网站 | `site/`（index.html + assets/app.js + style.css） | 零依赖 SPA，hash 路由，亮色主题，7 类页面 |
| 部署 | GitHub `lovexw/open-genome-report` + CF Pages | https://open-genome-report.pages.dev ✅ v0.2 浏览器验证通过 |
| 文档 | README / docs/* / 本文件 | 部署、决策、路线图、数据许可 |

### 已验证的关键事实 🔍（接手者可直接信任）
1. **ASA 与 IMP 两文件严格互补**：抽样 19 位点按 rsID+位置均无交集；总和 = 5,466,295。
2. **数据主人推断为男性**：Y 染色体 20,658 位点有效分型；X 杂合率 1.1%。
3. **用户前期 8 份清单与原始数据 100% 一致**（494/494），可放心作为面板依据。
4. **dbSNP 校验已确认的关键方向**（正链）：
   - rs671：G/A，A=ALDH2*2（缺陷）。数据 GG = *1/*1 正常（注意：早期评估中曾口头说反）。
   - rs9923231：T/C，C=VKORC1 基因方向 A（华法林高敏感）。数据 TT = 高敏感型。
   - MTHFR rs1801133 G/A（G=野生，数据 GG）；rs1801131 T/G（数据 TG=1298 杂合）。
   - dbSNP SPDI 位置为 0 基（1 基 = position+1），解析时已处理。
5. 部分位点 gesedna 的 rsID↔位置映射与 dbSNP 记录不一致（verify 会标出，网站 ⚠️ 展示）。
6. **单倍群判定已验证的关键事实**：
   - Y：M168/M89/M9/P128/P331/M45/M1047/CTS3727/L273.1/F746/M120/M265 全部衍生
     （单拷贝区），兄弟支系 M130/M174/M96/M201/M69/M170/M304/M20/M70/M231/M268/
     M88/M176/M324/P201/M207/M173/M343/P256 全部祖先型 → **Q1a1a1（M120）**。
     注意：ISOGG 2016 表中 M122 的位置（21,764,674）与 dbSNP rs2032662（15,014,262）
     不一致，且后者数据读数异常（CC），O2-M122 无法用本数据判定——但 M45+ 已定
     K2b 支，O/N（K2a 支）被树位置排除，不影响结论。
   - Y 多拷贝/回文区（约 6.5-9.0Mb）会出现跨支系假"衍生"读数（C1a2/Q1b 等），
     判级时必须排除该区间（dup_prone 标记）。
   - MT：m.10398/8701（M/N 宏观判别位点）芯片未覆盖；走查靠 263/750/1438/2706/
     4769/7028/8860/11719/3970/13928/16304/6392/10310/1005/10586/12338/13708 等
     17 个位点 → **F2**。MT 数据有 29 个混合读数（AA+AG 之类），已忽略并计数。
   - M175（O 根定义位点）是 5bp indel，芯片不可靠分型——O 的排除靠 K2b 树位置 + 兄弟支系标记。

### 进行中/待办 ⏳（按优先级，详见 docs/ROADMAP.md）
1. ~~MT 线粒体单倍型分析~~ ✅ v0.3（F2，树感知走查）
2. ~~Y 染色体父系单倍群粗判~~ ✅ v0.3（Q1a1a1/M120，ISOGG 主干树）
3. 定量祖源分析（需要准备东亚参考面板做 PCA/ADMIXTURE，或对接 open tools）
4. NAT2 严格单倍型判定（现有近似计数法；该数据集 NAT2 多个位点读数与 dbSNP 不符——
   如 rs1801279 数据 GG、rs1041983 数据 TC——大概率 gesedna 映射问题，
   实现时必须先过 verify 校验，宁可留白）
5. 关联表剩余 64 条「—」注释（证据不足者保持留白；GWAS Catalog OR/效应量数值亦未补）
6. 前端 rsID 全库检索（现有仅面板位点可查；全库需按染色体预建索引）
7. CF Dashboard 连接 Git 仓库实现 push 自动部署（当前为 wrangler 手动部署）
8. 英文版页面（popsci 层已做好内容分层，i18n 时可平移）

## 2. 接手操作手册

### 环境
- macOS + Python 3.14（仅标准库，无第三方依赖）+ Make。
- 原始数据位置：`~/Downloads/基因/1907310017133.gese.{asa,Imp}.txt`
  （可用环境变量 `GENOME_RAW_DIR` 改向；配置集中在 `pipeline/config.py`）。

### 从零重建（顺序执行）
```bash
make import    # 解析原始文件 → SQLite（约 15 秒）
make verify    # 用户清单比对 + dbSNP 校验（离线，用已提交缓存）
make reports   # 生成 site/data/reports/*.json
make export    # 生成 site/data/genome/chr*.tsv.gz + stats.json
make serve     # http://localhost:8080 预览
```
- 如需重新拉 dbSNP：`rm -rf pipeline/cache/dbsnp && python3 pipeline/fetch_dbsnp.py`
  （约 2 分钟，限速 3 req/s；缓存已提交，一般不用重拉）。

### 改动约定
- **改解读内容** → 只改 `pipeline/panels/*.json`，然后 `make reports`。
- **加新位点** → 面板 JSON 加 entry（含 `plus_ref/plus_alt/interp` 三基因型）→
  `python3 pipeline/fetch_dbsnp.py`（会补拉新位点）→ `make verify reports`。
- **改单倍群判定** → 逻辑在 `pipeline/haplogroups.py`；树数据在
  `pipeline/panels/haplogroup_trees.json.gz`（Y 标记直接改 JSON；MT 树整树更新时
  从 genepi/phylotree-rcrs-17 release 重新解析，方法见 haplogroups.py 头注释）。
  判定结果进 `site/data/reports/haplogroups.json` + overview 徽章。
- **改前端** → `site/assets/app.js`（渲染逻辑）/ style.css。改完 `make serve` 验证。
- **面板 JSON 字段含义** → 见 `pipeline/panels/_schema.md`（待写）或参考现有条目：
  `interp` 的 key 必须是「正链两字符基因型」（如 "AG"），负链基因写法通过
  `gene_strand: "-"` + `plus_ref/plus_alt` 表达，网站会自动展示双方向。

### 本会话发现的坑（勿重蹈）
1. NCBI refsnp API 结构：等位基因字段是 `inserted_sequence`（不是 inserted_allele），
   SPDI 0 基，组装名在 `placement_annot.seq_id_traits_by_assembly`。
2. gesedna 数据个别 rsID 的位置与 dbSNP 不一致（如 rs4148323），以 dbSNP 为准并降级解读。
3. 用户清单里的"基因方向"写法（如 VKORC1 -1639G>A 在文件中是正链 T/C）——
   一切以原始数据正链为唯一真相，展示层做换算。
4. FTO/rs1333049 等位点的"风险等位基因"在不同文献方向相反，必须在 dbSNP 核对后再写方向。

## 3. 部署状态

- GitHub：`lovexw/open-genome-report`（main 分支，CI 已配置）✅
- Cloudflare Pages：项目 `open-genome-report`，生产地址
  **https://open-genome-report.pages.dev** ✅（2026-09-27 首次部署并经浏览器验证：
  总览/模块页/基因组页渲染正常）
- 部署方式：`wrangler pages deploy site --project-name=open-genome-report`
  （本机 wrangler 已 OAuth 登录；后续推荐在 CF Dashboard 连接 Git 实现自动部署，
  见 docs/DEPLOY.md）

## 4. 更新逻辑（数据或内容变更时）

1. 数据更新（重新导出的芯片/填充文件）→ 替换 `GENOME_RAW_DIR` 下文件 → `make all`。
2. 解读内容更新 → 改 panels → `make verify reports`。
3. 两者都会改变 `site/data/` 产物 → `git add site/data && git commit` → push。
4. Cloudflare Pages 若用 Git 集成则自动部署；若用手动模式则
   `npx wrangler pages deploy site --project-name=open-genome-report`。
5. **每次会话结束前更新本文件的「当前状态」**。

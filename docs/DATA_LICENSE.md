# 数据许可与隐私声明（DATA_LICENSE）

## 1. 授权事实

本项目基因分型数据的所有者为本仓库所有者（GitHub: lovexw）本人。
所有者已于 2026-09-27 确认：

1. 数据为本人消费级基因检测（gesedna / Illumina ASA 平台）导出结果；
2. 自愿将分型数据与解读报告以开源形式公开展示；
3. 知晓基因数据不可匿名化、且与血亲部分共享，仍作出公开决定；
4. 公开内容不含危及生命的临床结论（报告设计上已排除临床级推断）。

## 2. 许可证

| 内容 | 许可 |
|---|---|
| 仓库代码（pipeline/、site/assets、脚本） | MIT |
| 基因分型数据（site/data/genome/*.tsv.gz、报告 JSON 中的基因型） | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| 解读文字（panels JSON 与渲染结果） | CC BY 4.0（原创撰写） |

引用格式建议：`lovexw, Open Genome Report (2026), https://github.com/lovexw/open-genome-report`

## 3. 第三方数据源与许可

| 数据源 | 用途 | 许可要点 |
|---|---|---|
| NCBI dbSNP | 位点位置/等位基因校验 | 公共领域（美国政府作品） |
| GWAS Catalog | 关联注释参考 | 开放（EMBL-EBI，CC0/无限制条款见官网） |
| ClinVar | 变异临床意义参考（后续） | 公共领域 |
| CPIC 指南 | 药物基因组学解读依据 | 文献开放获取（CC BY-NC-SA 或类似，以官网为准） |
| SNPedia | 仅作为外链参考，**未复制其文本** | CC BY-NC-SA（禁商用）——因此本站解读全部原创 |

## 4. 隐私边界

- 原始导出文件（含样本编号 1907310017133 的 .asa/.Imp 文件）**不**入库。
- 仓库与网站仅含派生数据（rsID+基因型+统计），不含姓名、联系方式等身份信息。
- 样本编号仅存在于 pipeline/config.py 的本地文件名配置中，不渲染到网站。
- 如所有者未来改变公开意愿：删除 site/data/genome/ 与报告 JSON 中的基因型字段
  即可实现"撤回"（站点代码不受影响）。

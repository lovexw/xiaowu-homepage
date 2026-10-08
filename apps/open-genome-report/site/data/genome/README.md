# 全基因组原始分型导出

每条染色体一个排序后的 TSV.gz：`rsid chrom pos genotype source`。
source=ASA 为芯片实测；source=IMP 为 1000G 填充。genotype 为正链方向，
'--' 表示该位点无有效分型。坐标系统 GRCh37/hg19。

由 `make export` 重新生成。

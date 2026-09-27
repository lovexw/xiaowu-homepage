# Open Genome Report — 构建命令
# 用法: make <target>
# 断点接手请先读 AI_HANDOFF.md

PY ?= python3

.PHONY: help import reports export verify all serve clean deploy-check

help:
	@echo "make import   — 解析原始 ASA+IMP 文件合并入 SQLite（需要本机原始数据）"
	@echo "make verify   — 与用户人工提取清单交叉校验 + dbSNP 等位基因校验（有缓存，离线可用）"
	@echo "make reports  — 生成解读报告 JSON 到 site/data/reports/"
	@echo "make export   — 导出按染色体的全基因组 TSV.gz 到 site/data/genome/ + 全基因组统计"
	@echo "make all      — 按顺序执行 verify + reports + export（不含 import）"
	@echo "make serve    — 本地起服务器预览 site/ (http://localhost:8080)"

import:
	$(PY) pipeline/import_genotypes.py

verify:
	$(PY) pipeline/verify.py

reports:
	$(PY) pipeline/build_reports.py

export:
	$(PY) pipeline/export_genome.py

all: verify reports export

serve:
	cd site && $(PY) -m http.server 8080

clean:
	rm -rf data/local

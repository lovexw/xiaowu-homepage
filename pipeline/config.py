"""项目全局配置。

设计原则：
- 原始数据文件只存在于本机（体积大 + 敏感），不入 Git 仓库。
- 仓库提交的是"构建产物"：报告 JSON、按染色体的全基因组压缩 TSV。
- 任何 AI/人接手时，只需把原始文件放到 config 指定的位置即可重新构建。
"""
from __future__ import annotations

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# 目录结构
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent

DATA_DIR = REPO_ROOT / "data"
RAW_DIR = Path(os.environ.get("GENOME_RAW_DIR", Path.home() / "Downloads" / "基因"))
LOCAL_DIR = DATA_DIR / "local"          # 构建中间产物（gitignore）
CACHE_DIR = Path(__file__).resolve().parent / "cache"

SITE_DIR = REPO_ROOT / "site"
REPORTS_DIR = SITE_DIR / "data" / "reports"
GENOME_DIR = SITE_DIR / "data" / "genome"

# ---------------------------------------------------------------------------
# 原始数据文件（gesedna 导出，hg19/build37，正链方向）
# ---------------------------------------------------------------------------
ASA_FILE = RAW_DIR / "1907310017133.gese.asa.txt"    # 芯片实测 ~69.9 万位点（金标准）
IMP_FILE = RAW_DIR / "1907310017133.gese.Imp.txt"    # 填充推算 ~476.7 万位点（不含实测位点）

# ---------------------------------------------------------------------------
# 数据库
# ---------------------------------------------------------------------------
SQLITE_PATH = LOCAL_DIR / "genome.sqlite"

# ---------------------------------------------------------------------------
# 用户前期人工整理的清单（用于交叉校验 + 面板定义参考）
# 用户笔记目录默认与原始数据同目录
USER_NOTES = {
    "life_db": RAW_DIR / "人生基因数据库.txt",
    "gwas_master": RAW_DIR / "2026_GWAS_Master.txt",
    "gwas_advanced": RAW_DIR / "2026_GWAS_Advanced.txt",
    "cancer": RAW_DIR / "cancer_snps.txt",
    "high_altitude": RAW_DIR / "high_altitude_snps.txt",
    "high_altitude_pro": RAW_DIR / "high_altitude_pro.txt",
    "immunity": RAW_DIR / "immunity_snps.txt",
    "personality": RAW_DIR / "personality_psychology.txt",
    "pharmacogenomics": RAW_DIR / "pharmacogenomics.txt",
}

# ---------------------------------------------------------------------------
# 个体信息（可按需修改；默认最小化，避免隐私泄露）
# ---------------------------------------------------------------------------
PROFILE = {
    "project_name": "我的基因组 · Open Genome Report",
    "data_generated": "2019-12-05",     # gesedna 导出日期（ASA）
    "data_platform": "Illumina ASA (Asian Screening Array) + 1000 Genomes 填充",
    "genome_build": "GRCh37 / hg19 (build 37)",
    "owner_note": "数据所有者本人确认并同意开源展示本人基因分型数据。",
}

VERSION = "0.1.0"

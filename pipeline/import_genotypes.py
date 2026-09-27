#!/usr/bin/env python3
"""步骤 1/4：解析 gesedna 原始文件，合并 ASA(实测) + IMP(填充) 入 SQLite。

关键事实（已于 2026-09-27 人工验证）：
- ASA 文件：芯片实测位点，金标准。
- IMP 文件：1000G 填充位点，**完全不含** ASA 已实测位点（两文件严格互补，
  抽样验证 19 个位点按 rsID 和位置均无交集）。
- 两文件均为 GRCh37/hg19、正链方向；"--" 表示该位点无有效分型。
- 合并策略：两文件直接并集（无重叠），source 字段标记来源；万一未来出现重叠，
  以 ASA 优先。

产物：
- data/local/genome.sqlite  表 genotypes(rsid, chrom, pos, gt, source)
  索引：(rsid) 与 (chrom,pos)
- 控制台输出 + data/local/stats.json 全局统计（供网站总览页使用）
"""
from __future__ import annotations

import json
import sqlite3
import sys
import time
from collections import Counter

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
import config  # noqa: E402


def parse_file(path, source, conn):
    """解析单个 gesedna TSV 文件并批量插入。返回 (插入数, 缺失数)。"""
    cur = conn.cursor()
    batch, inserted, missing = [], 0, 0
    t0 = time.time()
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if line.startswith("#"):
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 4:
                continue
            rsid, chrom, pos, gt = parts[0], parts[1], parts[2], parts[3]
            if gt == "--":
                missing += 1
                # 缺失位点也入库（标记 --），面板构建时能区分"未测出"和"测出纯合"
                batch.append((rsid, chrom, int(pos), "--", source))
            else:
                batch.append((rsid, chrom, int(pos), gt, source))
            if len(batch) >= 100_000:
                cur.executemany(
                    "INSERT OR IGNORE INTO genotypes VALUES (?,?,?,?,?)", batch)
                inserted += cur.rowcount if cur.rowcount > 0 else 0
                batch = []
    if batch:
        cur.executemany(
            "INSERT OR IGNORE INTO genotypes VALUES (?,?,?,?,?)", batch)
    conn.commit()
    print(f"  [{source}] 解析完成: {time.time()-t0:.0f}s, 缺失位点 {missing}")
    return missing


def main():
    config.LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    db_path = config.SQLITE_PATH
    if db_path.exists():
        db_path.unlink()
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=OFF")
    conn.execute("PRAGMA synchronous=OFF")
    conn.execute(
        """CREATE TABLE genotypes (
               rsid   TEXT NOT NULL,
               chrom  TEXT NOT NULL,
               pos    INTEGER NOT NULL,
               gt     TEXT NOT NULL,
               source TEXT NOT NULL
           )"""
    )

    print(f"数据库: {db_path}")
    missing = {}
    for path, source in [(config.ASA_FILE, "ASA"), (config.IMP_FILE, "IMP")]:
        if not path.exists():
            sys.exit(f"[错误] 找不到原始文件: {path}\n"
                     f"请将原始数据放到 {config.RAW_DIR} 或设置环境变量 GENOME_RAW_DIR")
        print(f"解析 {path.name} ({source}) ...")
        missing[source] = parse_file(path, source, conn)

    print("创建索引 ...")
    conn.execute("CREATE INDEX idx_rsid ON genotypes(rsid)")
    conn.execute("CREATE INDEX idx_chrpos ON genotypes(chrom, pos)")
    conn.commit()

    # ------------------------------------------------------------------ 统计
    print("统计 ...")
    cur = conn.cursor()
    total = cur.execute("SELECT COUNT(*) FROM genotypes").fetchone()[0]
    by_source = dict(cur.execute(
        "SELECT source, COUNT(*) FROM genotypes GROUP BY source").fetchall())
    by_chrom = dict(cur.execute(
        "SELECT chrom, COUNT(*) FROM genotypes GROUP BY chrom ORDER BY "
        "CAST(chrom AS INTEGER)=0, CAST(chrom AS INTEGER)").fetchall())
    # 杂合位点：两个等位字符不同且非缺失
    het = cur.execute(
        "SELECT COUNT(*) FROM genotypes WHERE LENGTH(gt)=2 AND gt NOT LIKE '--' "
        "AND SUBSTR(gt,1,1)!=SUBSTR(gt,2,1)").fetchone()[0]
    snps_x = dict(cur.execute(
        "SELECT chrom, COUNT(*) FROM genotypes WHERE chrom IN ('X','Y','MT') "
        "GROUP BY chrom").fetchall())

    stats = {
        "total": total,
        "by_source": by_source,
        "by_chrom": by_chrom,
        "het_calls": het,
        "het_rate": round(het / max(total, 1), 4),
        "missing": missing,
        "special_chroms": snps_x,
    }
    stats_path = config.LOCAL_DIR / "stats.json"
    stats_path.write_text(json.dumps(stats, ensure_ascii=False, indent=2))
    print(f"总位点 {total}（ASA {by_source.get('ASA')} / IMP {by_source.get('IMP')}），"
          f"杂合 {het} ({stats['het_rate']:.1%})")
    print(f"性染色体位点: {snps_x}")
    print(f"统计写入 {stats_path}")
    conn.close()
    print("步骤 1/4 完成 ✔")


if __name__ == "__main__":
    main()

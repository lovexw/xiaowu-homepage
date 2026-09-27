#!/usr/bin/env python3
"""步骤 4：全基因组导出 + 统计。

1) 按染色体导出排序后的 TSV.gz（rsid/chr/pos/gt/source）到 site/data/genome/，
   供网站"数据下载"页与未来浏览器端查询使用（每文件远小于 Cloudflare Pages
   单文件 25MB 限制）。
2) 生成全基因组统计 site/data/genome/stats.json（每染色体位点数、密度、
   缺失率、杂合率、来源构成），供网站"基因组概览"页的 SVG 图表使用。
"""
from __future__ import annotations

import gzip
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config  # noqa: E402

# hg19 染色体长度（Mb），用于密度估算
HG19_LEN_MB = {
    "1": 249.25, "2": 243.2, "3": 198.02, "4": 190.21, "5": 181.54,
    "6": 170.81, "7": 159.35, "8": 145.14, "9": 138.39, "10": 133.8,
    "11": 135.09, "12": 133.28, "13": 114.36, "14": 107.04, "15": 101.99,
    "16": 90.34, "17": 83.26, "18": 80.37, "19": 58.62, "20": 63.44,
    "21": 46.71, "22": 50.82, "X": 155.27, "Y": 59.37, "MT": 0.01657,
}


def main():
    if not config.SQLITE_PATH.exists():
        sys.exit("请先运行 make import")
    conn = sqlite3.connect(config.SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    out_dir = config.GENOME_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    chroms = [r[0] for r in conn.execute(
        "SELECT DISTINCT chrom FROM genotypes ORDER BY "
        "CAST(chrom AS INTEGER)=0, CAST(chrom AS INTEGER)")]

    stats = []
    for chrom in chroms:
        rows = conn.execute(
            "SELECT rsid, chrom, pos, gt, source FROM genotypes "
            "WHERE chrom=? ORDER BY pos", (chrom,)).fetchall()
        gz_path = out_dir / f"chr{chrom}.tsv.gz"
        typed = missing = het = 0
        asa = imp = 0
        with gzip.open(gz_path, "wt", encoding="utf-8", compresslevel=9) as gz:
            gz.write("#rsid\tchrom\tpos\tgenotype\tsource\n")
            for r in rows:
                gz.write(f"{r['rsid']}\t{r['chrom']}\t{r['pos']}\t"
                         f"{r['gt']}\t{r['source']}\n")
                if r["gt"] == "--":
                    missing += 1
                else:
                    typed += 1
                    if len(r["gt"]) == 2 and r["gt"][0] != r["gt"][1] \
                            and r["gt"] not in ("DI", "ID", "DD", "II"):
                        het += 1
                if r["source"] == "ASA":
                    asa += 1
                else:
                    imp += 1
        n = len(rows)
        size_kb = gz_path.stat().st_size // 1024
        entry = {
            "chrom": chrom,
            "total": n,
            "typed": typed,
            "missing": missing,
            "het": het,
            "het_rate": round(het / max(typed, 1), 4),
            "missing_rate": round(missing / max(n, 1), 4),
            "asa": asa,
            "imp": imp,
            "density_per_mb": round(n / HG19_LEN_MB.get(chrom, 1), 1)
            if chrom != "MT" else round(n / 0.01657, 1),
            "file_kb": size_kb,
        }
        stats.append(entry)
        print(f"chr{chrom}: {n} 位点 ({asa} 实测/{imp} 填充), "
              f"杂合率 {entry['het_rate']:.1%}, 文件 {size_kb}KB")

    (out_dir / "stats.json").write_text(
        json.dumps({"build": config.PROFILE["genome_build"],
                    "chromosomes": stats}, ensure_ascii=False, indent=1))
    readme = out_dir / "README.md"
    readme.write_text(
        "# 全基因组原始分型导出\n\n"
        "每条染色体一个排序后的 TSV.gz：`rsid chrom pos genotype source`。\n"
        "source=ASA 为芯片实测；source=IMP 为 1000G 填充。genotype 为正链方向，\n"
        "'--' 表示该位点无有效分型。坐标系统 GRCh37/hg19。\n\n"
        "由 `make export` 重新生成。\n")
    print("步骤 4 完成 ✔")


if __name__ == "__main__":
    main()

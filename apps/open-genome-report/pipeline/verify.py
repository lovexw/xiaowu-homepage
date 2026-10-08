#!/usr/bin/env python3
"""步骤 2b：双重校验。

1) 用户人工提取清单 vs 原始数据：逐 rsid 比对基因型，确认前期整理可靠度。
2) 面板位点 vs dbSNP 缓存：比对位置（GRCh37）与正链等位基因合法性。

产出：data/local/verify_report.json（gitignore）+ site/data/quality.json（提交，
网站「数据质量」页展示）。校验结论同时供 build_reports 使用（设置位点 flag）。
"""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config  # noqa: E402


def load_db():
    conn = sqlite3.connect(config.SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def load_user_notes():
    notes = {}
    for name, path in config.USER_NOTES.items():
        if not path.exists():
            continue
        rows = []
        for line in path.read_text().splitlines():
            parts = line.rstrip().split("\t")
            if len(parts) >= 4 and parts[0].startswith("rs"):
                rows.append({"rsid": parts[0], "chrom": parts[1],
                             "pos": int(parts[2]), "gt": parts[3]})
        notes[name] = rows
    return notes


def main():
    if not config.SQLITE_PATH.exists():
        sys.exit("请先运行 make import")
    conn = load_db()

    # ---------------------------------------------------------- 1. 用户清单比对
    note_check = {}
    for name, rows in load_user_notes().items():
        match = mismatch = absent = 0
        details = []
        for r in rows:
            db = conn.execute(
                "SELECT gt, source, chrom, pos FROM genotypes WHERE rsid=?",
                (r["rsid"],)).fetchone()
            if db is None:
                absent += 1
                details.append({"rsid": r["rsid"], "issue": "not_in_db"})
                continue
            if db["gt"] == r["gt"]:
                match += 1
            else:
                mismatch += 1
                details.append({"rsid": r["rsid"], "note_gt": r["gt"],
                                "db_gt": db["gt"], "issue": "gt_mismatch"})
        note_check[name] = {"total": len(rows), "match": match,
                            "mismatch": mismatch, "absent": absent,
                            "issues": details[:50]}
        print(f"[{name}] 共 {len(rows)}：一致 {match}，不一致 {mismatch}，库中无 {absent}")

    # ---------------------------------------------------------- 2. dbSNP 校验
    cache_dir = config.CACHE_DIR / "dbsnp"
    dbsnp = {}
    if cache_dir.exists():
        for f in cache_dir.glob("rs*.json"):
            d = json.loads(f.read_text())
            dbsnp[d["rsid"]] = d

    def gt_alleles(gt: str) -> set[str]:
        if gt in ("--", ""):
            return set()
        return {c for c in gt if c in "ACGT"}

    panel_issues = []
    panel_checked = 0
    panels_dir = Path(__file__).parent / "panels"
    for pf in sorted(panels_dir.glob("*.json")):
        if pf.name.startswith("_") or pf.name == "annotations_curated.json":
            continue
        data = json.loads(pf.read_text())
        for e in data.get("entries", []):
            rsid = e.get("rsid", "")
            if not rsid.startswith("rs"):
                continue
            db = conn.execute("SELECT gt, chrom, pos FROM genotypes WHERE rsid=?",
                              (rsid,)).fetchone()
            if db is None:
                continue  # 芯片未覆盖，报告里会显示"未测出"
            panel_checked += 1
            ref = dbsnp.get(rsid)
            if ref and ref.get("plus_alleles"):
                gt_alle = gt_alleles(db["gt"])
                if gt_alle and not gt_alle.issubset(set(ref["plus_alleles"])):
                    panel_issues.append({
                        "rsid": rsid, "module": data["module"],
                        "issue": "allele_mismatch",
                        "db_gt": db["gt"],
                        "dbsnp_plus_alleles": ref["plus_alleles"],
                    })
                pos37 = ref.get("grch37_pos")
                # indel 位置有 ±1 偏差惯例，给 3bp 容差
                if pos37 is not None and abs(pos37 - db["pos"]) > 3:
                    panel_issues.append({
                        "rsid": rsid, "module": data["module"],
                        "issue": "position_mismatch_vs_grch37",
                        "db_pos": db["pos"], "dbsnp_grch37_pos": pos37,
                    })

    quality = {
        "generated": "由 pipeline/verify.py 生成",
        "note_check": note_check,
        "panel_checked": panel_checked,
        "panel_issues": panel_issues,
        "dbsnp_cached": len(dbsnp),
    }
    config.LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    (config.LOCAL_DIR / "verify_report.json").write_text(
        json.dumps(quality, ensure_ascii=False, indent=2))
    # 网站质量页（精简版，提交）
    site_q = {
        "user_note_check": {k: {kk: vv for kk, vv in v.items() if kk != "issues"}
                            for k, v in note_check.items()},
        "panel_checked": panel_checked,
        "panel_issue_count": len(panel_issues),
        "panel_issues": panel_issues,
        "dbsnp_cached": len(dbsnp),
    }
    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (config.SITE_DIR / "data" / "quality.json").write_text(
        json.dumps(site_q, ensure_ascii=False, indent=2))
    print(f"面板校验：{panel_checked} 个位点已查库，{len(panel_issues)} 个问题")
    for iss in panel_issues:
        print(f"  [{iss['issue']}] {iss['rsid']}: {iss}")
    print("步骤 2b 完成 ✔")


if __name__ == "__main__":
    main()

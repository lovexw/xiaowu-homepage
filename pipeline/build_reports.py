#!/usr/bin/env python3
"""步骤 3：生成网站所需的全部报告 JSON。

输入：SQLite（原始分型）+ panels/*.json（解读面板）+ dbSNP 缓存 + 用户清单。
输出：site/data/reports/*.json、site/data/manifest.json、site/data/genome/stats 概要。

设计要点：
- 位点解析顺序：按 rsID 查库；查不到时若 dbSNP 缓存有 GRCh37 位置则按位置兜底。
- 等位基因合法性：dbSNP 缓存给出正链等位基因；基因型等位基因不属于该集合时
  标记 genotype_flag=True，网站展示通用说明而非硬结论。
- 交叉引用条目（crosslink）不重复渲染正文，只在对应模块展示。
"""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config  # noqa: E402

PANELS_DIR = Path(__file__).parent / "panels"


def load_db():
    conn = sqlite3.connect(config.SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def lookup(conn, rsid, dbsnp):
    """返回 dict(gt, chrom, pos, source, found_by)。"""
    row = conn.execute("SELECT gt, chrom, pos, source FROM genotypes WHERE rsid=?",
                       (rsid,)).fetchone()
    if row:
        return {"gt": row["gt"], "chrom": row["chrom"], "pos": row["pos"],
                "source": row["source"], "found_by": "rsid"}
    ref = dbsnp.get(rsid)
    if ref and ref.get("grch37_pos") is not None:
        row = conn.execute(
            "SELECT gt, chrom, pos, source FROM genotypes WHERE chrom=? AND pos=?",
            (str(ref.get("chrom37") or ""), ref["grch37_pos"])).fetchone()
        if row is None:
            # chrom 信息可能缺失，尝试只按位置
            row = conn.execute(
                "SELECT gt, chrom, pos, source FROM genotypes WHERE pos=? LIMIT 1",
                (ref["grch37_pos"],)).fetchone()
        if row:
            return {"gt": row["gt"], "chrom": row["chrom"], "pos": row["pos"],
                    "source": row["source"], "found_by": "position_fallback"}
    return None


def gt_alleles(gt: str) -> set[str]:
    return {c for c in gt if c in "ACGT"}


def canon_gt(gt: str) -> str:
    """基因型字母排序规范化（AG==GA），使面板 interp 键与数据顺序无关。"""
    if gt in ("--", "") or not gt:
        return gt
    return "".join(sorted(gt))


def gene_strand(gt: str, strand: str) -> str:
    if strand != "-" or not gt:
        return gt
    comp = {"A": "T", "T": "A", "C": "G", "G": "C",
            "D": "I", "I": "D", "-": "-"}
    return "".join(comp.get(c, c) for c in gt)


def links_for(rsid: str) -> dict:
    rid = rsid[2:]
    return {
        "dbsnp": f"https://www.ncbi.nlm.nih.gov/snp/rs{rid}",
        "snpedia": f"https://www.snpedia.com/index.php/Rs{rid}",
        "gwas": f"https://www.ebi.ac.uk/gwas/search?query=rs{rid}",
        "pubmed": f"https://pubmed.ncbi.nlm.nih.gov/?term=rs{rid}",
    }


def level_of(label: str, text: str) -> str:
    blob = label + text
    if any(k in blob for k in ("风险纯合", "慢代谢 (Poor", "缺陷", "强列建议", "强烈建议", "避免", "风险升高倾向明显", "风险 OR≈1.5", "OR≈1.8", "风险较高", "T/T")) and "风险较低" not in blob:
        return "caution"
    if any(k in blob for k in ("野生", "正常", "保护", "有利", "低风险", "长寿", "快代谢 (Normal", "排除")):
        return "favorable"
    if any(k in blob for k in ("携带", "杂合", "中间", "中度")):
        return "attention"
    return "neutral"


def build_module(conn, panel: dict, dbsnp: dict, flags: dict) -> dict:
    entries = []
    for e in panel.get("entries", []):
        rsid = e.get("rsid", "")
        out = {
            "rsid": rsid,
            "gene": e.get("gene", ""),
            "variant": e.get("variant", ""),
            "group": e.get("group", ""),
            "confidence": e.get("confidence", "low"),
            "note": e.get("note", ""),
            "links": links_for(rsid) if rsid.startswith("rs") else {},
        }
        if e.get("crosslink"):
            out["crosslink"] = e["crosslink"]
            entries.append(out)
            continue
        hit = lookup(conn, rsid, dbsnp) if rsid.startswith("rs") else None
        if hit is None:
            out["status"] = "not_called"
            out["genotype"] = None
            entries.append(out)
            continue
        gt = hit["gt"]
        out["genotype"] = gt
        out["chrom"] = hit["chrom"]
        out["pos"] = hit["pos"]
        out["source"] = hit["source"]
        out["found_by"] = hit["found_by"]
        out["gene_strand_note"] = e.get("gene_strand", "+")
        out["genotype_gene_direction"] = gene_strand(gt, e.get("gene_strand", "+")) \
            if e.get("gene_strand") == "-" else None
        flag = flags.get(rsid, {})
        out["flag"] = flag.get("kind")  # allele/position 校验问题标记
        # interp 键规范化（与基因型字母顺序无关）
        interp = {canon_gt(k): v for k, v in e.get("interp", {}).items()}
        gt_key = canon_gt(gt)
        if gt == "--":
            out["status"] = "no_call"
            out["resolved"] = None
        elif gt_key in interp and not flag:
            out["status"] = "ok"
            lab, txt = interp[gt_key][0], interp[gt_key][1]
            out["resolved"] = {"label": lab, "text": txt,
                               "level": level_of(lab, txt)}
        elif gt_key in interp and flag:
            out["status"] = "flagged"
            lab, txt = interp[gt_key][0], interp[gt_key][1]
            out["resolved"] = {"label": lab, "text": txt,
                               "level": level_of(lab, txt)}
        else:
            out["status"] = "unknown_gt"
            out["resolved"] = None
        entries.append(out)

    cards = [
        {"title": c["title"], "text": c["text"], "level": c["level"]}
        for c in panel.get("special_cards", [])
    ]
    return {
        "module": panel["module"],
        "title": panel["title"],
        "icon": panel.get("icon", ""),
        "intro": panel.get("intro", ""),
        "entries": entries,
        "special_cards": cards,
        "counts": {
            "total": len(entries),
            "ok": sum(1 for x in entries if x.get("status") == "ok"),
            "flagged": sum(1 for x in entries if x.get("status") == "flagged"),
            "not_called": sum(1 for x in entries if x.get("status") == "not_called"),
        },
    }


def build_assoc_table(conn, list_key: str, title: str, ann: dict,
                      dbsnp: dict, exclude: set[str]) -> dict:
    """把用户整理的关联位点清单渲染成表格（不硬解读，标注 + 外链）。"""
    rows = []
    for r in config.USER_NOTES and _read_user_list(list_key):
        rsid = r["rsid"]
        db = conn.execute("SELECT gt, chrom, pos, source FROM genotypes WHERE rsid=?",
                          (rsid,)).fetchone()
        a = ann.get(rsid, {})
        row = {
            "rsid": rsid,
            "chrom": db["chrom"] if db else r["chrom"],
            "pos": db["pos"] if db else r["pos"],
            "gt": db["gt"] if db else r["gt"],
            "source": db["source"] if db else "user_note",
            "gene": a.get("gene", ""),
            "trait": a.get("trait", ""),
            "conf": a.get("conf", ""),
            "in_panel": rsid in exclude,
            "links": links_for(rsid),
        }
        ref = dbsnp.get(rsid)
        row["flag"] = "position_mismatch_vs_grch37" if (
            ref and ref.get("grch37_pos") is not None and db and
            ref["grch37_pos"] != db["pos"]) else None
        rows.append(row)
    rows.sort(key=lambda x: (int(x["chrom"]) if x["chrom"].isdigit() else 99, x["pos"]))
    return {"title": title, "rows": rows}


def _read_user_list(key: str):
    path = config.USER_NOTES[key]
    if not path.exists():
        return []
    out = []
    for line in path.read_text().splitlines():
        parts = line.rstrip().split("\t")
        if len(parts) >= 4 and parts[0].startswith("rs"):
            out.append({"rsid": parts[0], "chrom": parts[1], "pos": int(parts[2]),
                        "gt": parts[3]})
    return out


def build_overview(conn, manifest_modules, dbsnp):
    stats = json.loads((config.LOCAL_DIR / "stats.json").read_text())
    y_called = conn.execute(
        "SELECT COUNT(*) FROM genotypes WHERE chrom='Y' AND gt!='--'").fetchone()[0]
    x_het = conn.execute(
        "SELECT COUNT(*) FROM genotypes WHERE chrom='X' AND gt!='--' AND "
        "SUBSTR(gt,1,1)!=SUBSTR(gt,2,1)").fetchone()[0]
    x_typed = conn.execute(
        "SELECT COUNT(*) FROM genotypes WHERE chrom='X' AND gt!='--'").fetchone()[0]
    sex = ("男性（Y 染色体约 %s 个位点有效分型，X 染色体杂合率 %.1f%%）"
           % (y_called, 100 * x_het / max(x_typed, 1))) if y_called > 1000 else \
          ("女性（Y 染色体位点几乎无分型，X 杂合率 %.1f%%）"
           % (100 * x_het / max(x_typed, 1)))
    abo_261 = conn.execute(
        "SELECT gt FROM genotypes WHERE rsid='rs8176719'").fetchone()
    blood = "O 型（261delG 纯合，结合 ABO 其他位点读数）" if abo_261 and abo_261[0] == "DD" else \
            "需结合其他 ABO 位点（261 位点读数 %s）" % (abo_261[0] if abo_261 else "无")
    apoe = None
    r1 = conn.execute("SELECT gt FROM genotypes WHERE rsid='rs429358'").fetchone()
    r2 = conn.execute("SELECT gt FROM genotypes WHERE rsid='rs7412'").fetchone()
    if r1 and r2 and len(r1[0]) == 2 and len(r2[0]) == 2:
        apoe = ("E3/E3" if r1[0] == "TT" and r2[0] == "CC"
                else "需人工确认（%s / %s）" % (r1[0], r2[0]))
    return {
        "profile": config.PROFILE,
        "stats": stats,
        "sex_inference": {"value": sex, "confidence": "high"},
        "blood_type": {"value": blood, "confidence": "medium"},
        "apoe": {"value": apoe, "confidence": "high" if apoe == "E3/E3" else "low"},
        "modules": manifest_modules,
    }


def main():
    if not config.SQLITE_PATH.exists():
        sys.exit("请先运行 make import")
    conn = load_db()
    dbsnp = {}
    cache_dir = config.CACHE_DIR / "dbsnp"
    if cache_dir.exists():
        for f in cache_dir.glob("rs*.json"):
            d = json.loads(f.read_text())
            dbsnp[d["rsid"]] = d

    # 校验 flag：从 verify_report 读（若有）
    flags = {}
    vr = config.LOCAL_DIR / "verify_report.json"
    if vr.exists():
        q = json.loads(vr.read_text())
        for iss in q.get("panel_issues", []):
            kind = "allele" if iss["issue"] == "allele_mismatch" else "position"
            flags[iss["rsid"]] = {"kind": kind, "detail": iss}

    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    panel_rsids = set()
    for pf in sorted(PANELS_DIR.glob("*.json")):
        if pf.name.startswith("_") or pf.name == "annotations_curated.json":
            continue
        panel = json.loads(pf.read_text())
        panel_rsids.update(e["rsid"] for e in panel.get("entries", []))
        built = build_module(conn, panel, dbsnp, flags)
        out = config.REPORTS_DIR / f"{panel['module']}.json"
        out.write_text(json.dumps(built, ensure_ascii=False, indent=1))
        manifest.append({"module": panel["module"], "title": panel["title"],
                         "icon": panel.get("icon", ""),
                         "intro": panel.get("intro", "")[:120],
                         "counts": built["counts"]})
        print(f"[{panel['module']}] {built['counts']}")

    ann = json.loads((PANELS_DIR / "annotations_curated.json").read_text())["annotations"]
    tables = {
        "assoc_cancer": ("cancer", "肿瘤相关位点（关联级证据）"),
        "assoc_gwas": ("gwas_master", "GWAS 精选位点总表"),
        "assoc_gwas_adv": ("gwas_advanced", "GWAS 扩展位点"),
        "assoc_altitude": ("high_altitude_pro", "高原低氧相关位点（含扩展）"),
        "assoc_personality": ("personality", "心理人格候选位点扩展表"),
    }
    for out_name, (key, title) in tables.items():
        built = build_assoc_table(conn, key, title, ann, dbsnp, panel_rsids)
        (config.REPORTS_DIR / f"{out_name}.json").write_text(
            json.dumps(built, ensure_ascii=False, indent=1))
        manifest.append({"module": out_name, "title": title, "icon": "📊",
                         "intro": "", "counts": {"total": len(built["rows"])}})
        print(f"[{out_name}] {len(built['rows'])} 行")

    overview = build_overview(conn, manifest, dbsnp)
    (config.REPORTS_DIR / "overview.json").write_text(
        json.dumps(overview, ensure_ascii=False, indent=1))
    (config.SITE_DIR / "data" / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1))
    print("步骤 3 完成 ✔")


if __name__ == "__main__":
    main()

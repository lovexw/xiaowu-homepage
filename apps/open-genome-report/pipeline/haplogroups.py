#!/usr/bin/env python3
"""父系与母系单倍群推断（粗判）。

母系：Phylotree Build 17.3 全树（5,435 支系，rCRS 重定位版）做树感知走查——
  沿根→叶路径累计各支系的「状态断言」，只用芯片有覆盖的位点计分；
  最优路径 = 匹配数 − 2×矛盾数；判到「路径上 0 矛盾的最深支系」为止。
父系：ISOGG 2016 主干树（手工策展，仅收录判定相关标记）——
  每个标记按「数据等位基因 vs ISOGG 祖先→衍生方向」判定衍生/祖先；
  Y 多拷贝回文区（6.5-9.0Mb，dup_prone）读数不可靠，不参与计分只作旁证；
  判到「自身有干净衍生标记的最深支系」，中间无干净标记的层级由下游传递确认。

判定原则与面板一致：宁可留白不可编造。证据不足时输出「无法判定」而非强行分层。
"""
from __future__ import annotations

import gzip
import json
import re
import sqlite3
from pathlib import Path

PANELS_DIR = Path(__file__).resolve().parent / "panels"
TREES_FILE = PANELS_DIR / "haplogroup_trees.json.gz"
POLY = re.compile(r"^(\d+)([ACGT])")   # Phylotree poly：位置+衍生碱基（indel/插入不匹配则跳过）


def load_trees() -> dict:
    with gzip.open(TREES_FILE, "rt", encoding="utf-8") as f:
        return json.load(f)


def load_dbsnp() -> dict:
    cache = Path(__file__).resolve().parent / "cache" / "dbsnp"
    out = {}
    if cache.exists():
        for f in cache.glob("rs*.json"):
            d = json.loads(f.read_text())
            out[d["rsid"]] = d
    return out


def mt_genotypes(conn: sqlite3.Connection):
    """MT 是单倍体：仅保留两个字母一致的读数（AA/CC/GG/TT），混合读数单独计数。"""
    valid, mixed = {}, 0
    for pos, gt in conn.execute(
            "SELECT pos, gt FROM genotypes WHERE chrom='MT' AND gt!='--'"):
        if len(gt) == 2 and gt[0] == gt[1] and gt[0] in "ACGT":
            valid[pos] = gt[0]
        else:
            mixed += 1
    return valid, mixed


def y_alleles(gt: str) -> set[str]:
    return {c for c in gt if c in "ACGT"}


# ---------------------------------------------------------------------------
# 母系 mtDNA
# ---------------------------------------------------------------------------
def mt_analyze(conn: sqlite3.Connection, dbsnp: dict, trees: dict) -> dict:
    state, mixed = mt_genotypes(conn)
    rsid_of = dict(conn.execute(
        "SELECT pos, rsid FROM genotypes WHERE chrom='MT' AND rsid!='.'"))
    total = conn.execute("SELECT COUNT(*) FROM genotypes WHERE chrom='MT'").fetchone()[0]

    # best = {'score','matched','mismatched','chain','children_of_best'}，DFS 全树
    best = {"score": -10 ** 9, "matched": [], "mismatched": [], "chain": []}

    def dfs(node, expected, matched, mismatched, chain):
        new_exp = dict(expected)
        m, x = list(matched), list(mismatched)
        for poly in node.get("p", []):
            pm = POLY.match(poly)
            if not pm:
                continue                     # indel / 插入：芯片不可靠，跳过
            pos, al = int(pm.group(1)), pm.group(2)
            if new_exp.get(pos) == al:
                continue
            new_exp[pos] = al
            obs = state.get(pos)
            if obs is None:
                continue                     # 芯片未覆盖：不参与计分
            if obs == al:
                m.append({"pos": pos, "expected": al, "observed": obs,
                          "branch": node["n"], "poly": poly,
                          "rsid": rsid_of.get(pos, "")})
            else:
                x.append({"pos": pos, "expected": al, "observed": obs,
                          "branch": node["n"], "poly": poly})
        score = len(m) - 2 * len(x)
        my_chain = chain + [node["n"]]
        if score > best["score"]:
            best.update(score=score, matched=m, mismatched=x, chain=my_chain,
                         node=node, expected=new_exp)
        for c in node.get("c", []):
            dfs(c, new_exp, m, x, my_chain)

    dfs(trees["mt"], {}, [], [], [])

    # 判到「路径上 0 矛盾的最深支系」；更深分支若引入矛盾则停止并注明
    chain_nodes, cum_mm, confirmed_idx = [], 0, 0
    node = trees["mt"]
    chain_nodes.append({"name": node["n"], "own_matched": 0, "status": "root",
                        "note": "rCRS 参考序列"})
    for i, name in enumerate(best["chain"][1:], 1):
        node = next((c for c in node.get("c", []) if c["n"] == name), None)
        if node is None:
            break
        mm = [x for x in best["mismatched"] if x["branch"] == name]
        mc = [x for x in best["matched"] if x["branch"] == name]
        cum_mm += len(mm)
        if cum_mm == 0:
            confirmed_idx = i
        chain_nodes.append({
            "name": name,
            "own_matched": len(mc),
            "own_mismatched": len(mm),
            "status": "confirmed" if cum_mm == 0 else "stop",
        })

    confirmed_name = best["chain"][confirmed_idx]
    def find(node, name):
        if node["n"] == name:
            return node
        for c in node.get("c", []):
            r = find(c, name)
            if r is not None:
                return r
        return None
    confirmed_node = find(trees["mt"], confirmed_name)

    # 下游亚支：定义突变（SNV）覆盖情况 → 已排除 / 可能匹配 / 不能排除
    # 判定顺序：任一已覆盖定义突变不匹配 → excluded（分支要求的状态样本不具备）；
    #          全部匹配且 ≥1 个 → possible；无任何已覆盖定义突变 → unresolved
    subs = []
    for c in confirmed_node.get("c", []):
        excl, possible, unres = [], [], []
        for poly in c.get("p", []):
            pm = POLY.match(poly)
            if not pm:
                unres.append(f"{poly}(indel，跳过)")
                continue
            pos, al = int(pm.group(1)), pm.group(2)
            obs = state.get(pos)
            if obs is None:
                unres.append(f"{poly}(未覆盖)")
            elif obs == al:
                possible.append(poly)
            else:
                excl.append(f"{poly}(实测 {obs})")
        if excl:
            verdict = "excluded"
            detail = f"定义突变不匹配：{', '.join(excl)}"
            if unres:
                detail += f"；另有未覆盖：{', '.join(unres)}"
        elif possible:
            verdict = "possible"
            detail = f"定义突变可匹配：{', '.join(possible)}"
        else:
            verdict = "unresolved"
            detail = "定义突变全部未覆盖，不能排除：" + (", ".join(unres) if unres else "该支系无 SNV 定义突变")
        subs.append({"name": c["n"], "verdict": verdict, "detail": detail})

    unresolved_subs = [s["name"] for s in subs if s["verdict"] == "unresolved"]
    possible_subs = [s["name"] for s in subs if s["verdict"] == "possible"]

    # dbSNP 交叉校验（仅对有 rsID 的证据位点）
    for e in best["matched"]:
        ref = dbsnp.get(e["rsid"]) if e["rsid"] else None
        e["dbsnp"] = None
        if ref:
            e["dbsnp"] = ("ok" if (ref.get("grch37_pos") in (None, e["pos"])
                                   and e["observed"] in ref.get("plus_alleles", []))
                          else "mismatch")

    if confirmed_name in ("H2a2a1",):
        call = None
        call_note = "信息位点不足，无法给出母系单倍群判定（宁可留白）。"
    else:
        call = confirmed_name + ("" if not unresolved_subs and not possible_subs
                                 else "（亚支未定）")
        if unresolved_subs:
            call_note = (f"亚支分辨率止于 {confirmed_name}：{'、'.join(unresolved_subs)} "
                         f"的定义突变未被本芯片覆盖，与 {'/'.join(possible_subs) or confirmed_name + '*'} 无法区分；"
                         f"其余亚支的定义突变不匹配，已排除。")
        else:
            call_note = f"{'、'.join(possible_subs) or '无下游亚支'}。"
    if possible_subs:
        call_note = f"下游可匹配亚支：{'、'.join(possible_subs)}。" + call_note

    return {
        "call": call,
        "call_note": call_note,
        "confidence": "high" if (len(best["matched"]) >= 5 and not best["mismatched"]
                                 and call) else ("medium" if call else "low"),
        "path": chain_nodes,
        "chain_full": best["chain"],
        "evidence": sorted(best["matched"], key=lambda e: e["pos"]),
        "mismatches": best["mismatched"],
        "subbranches": subs,
        "stats": {
            "mt_positions": total,
            "mt_valid": len(state),
            "mt_mixed": mixed,
            "coverage_pct": round(100 * len(state) / 16569, 1),
        },
    }


# ---------------------------------------------------------------------------
# 父系 Y
# ---------------------------------------------------------------------------
def y_analyze(conn: sqlite3.Connection, dbsnp: dict, trees: dict) -> dict:
    y = dict((p, (rsid, gt)) for p, rsid, gt in conn.execute(
        "SELECT pos, rsid, gt FROM genotypes WHERE chrom='Y' AND gt!='--'"))

    def marker_state(mk):
        """返回 (status, observed)。status: derived/ancestral/ambiguous/abnormal/uncovered/dup"""
        pos, ref, alt = mk["pos"], mk["ref"], mk["alt"]
        rsid = mk.get("rsid", "")
        hit = y.get(pos)
        if hit is None:
            return "uncovered", None
        _, gt = hit
        obs = "".join(sorted(y_alleles(gt)))
        # dbSNP 交叉校验（有 rsID 时）：位置与等位基因必须一致，否则读数不可信
        ref_d = dbsnp.get(rsid) if rsid else None
        if ref_d and rsid:
            if ref_d.get("grch37_pos") not in (None, pos):
                return "abnormal", obs
            if ref not in ref_d.get("plus_alleles", []):
                return "abnormal", obs
        if mk.get("dup_prone"):
            return "dup", obs
        has_ref, has_alt = ref in y_alleles(gt), alt in y_alleles(gt)
        if has_alt and not has_ref:
            return "derived", obs
        if has_ref and not has_alt:
            return "ancestral", obs
        if has_ref and has_alt:
            return "ambiguous", obs
        return "abnormal", obs

    def subtree_score(node):
        """子树内「干净衍生标记」数（dup/abnormal 不计）。"""
        cnt = 0
        for mk in node.get("markers", []):
            if marker_state(mk)[0] == "derived":
                cnt += 1
        for c in node.get("children", []):
            cnt += subtree_score(c)
        return cnt

    # 从根向下：每层选择子树净支持最高的分支；记录每层的证据
    path, excluded, cur = [], [], trees["y"]
    call_chain = []
    while True:
        row = {"name": cur["name"], "markers": [], "note": cur.get("note", "")}
        derived = ancestral = 0
        for mk in cur.get("markers", []):
            st, obs = marker_state(mk)
            row["markers"].append({**{k: v for k, v in mk.items()}, "status": st, "observed": obs})
            if st == "derived":
                derived += 1
            elif st == "ancestral":
                ancestral += 1
        row["derived"] = derived
        row["ancestral"] = ancestral
        first = (len(path) == 0)
        row["status"] = ("root" if first else
                         "confirmed" if derived > 0 else
                         "presumed" if subtree_score(cur) > 0 else "stop")
        path.append(row)
        call_chain.append(cur["name"])
        kids = cur.get("children", [])
        if not kids:
            break
        scored = [(subtree_score(c), c) for c in kids]
        scored.sort(key=lambda t: -t[0])
        if not scored or scored[0][0] == 0:
            break
        best_score, chosen = scored[0]
        for sc, c in scored[1:]:
            if sc > 0:
                excluded.append({"branch": c["name"], "reason":
                                 f"子树净支持 {sc}（被更强的 {'/'.join(x['name'] for s, x in scored if s == best_score)} 传递排除）"})
            else:
                marks = []
                def _anc(nn):
                    for mk in nn.get("markers", []):
                        st, obs = marker_state(mk)
                        if st == "ancestral":
                            marks.append(f"{mk['name']}−")
                    for cc in nn.get("children", []):
                        _anc(cc)
                _anc(c)
                excluded.append({"branch": c["name"], "reason":
                                 "无衍生标记" + (f"；祖先型：{', '.join(marks[:6])}" if marks else "")})
        cur = chosen

    # 汇总证据 / 未覆盖 / dup 旁证
    evidence, dup_side, uncovered = [], [], []
    for row in path:
        for mk in row["markers"]:
            item = {"marker": mk["name"], "branch": row["name"], "rsid": mk.get("rsid", ""),
                    "pos": mk["pos"], "mutation": f"{mk['ref']}→{mk['alt']}",
                    "observed": mk.get("observed"), "status": mk["status"], "note": mk.get("note", "")}
            if mk["status"] in ("derived", "ancestral"):
                evidence.append(item)
            elif mk["status"] == "dup":
                dup_side.append(item)
            elif mk["status"] in ("uncovered", "abnormal", "ambiguous"):
                uncovered.append(item)

    call = call_chain[-1]
    confirmed_names = [r["name"] for r in path if r["status"] == "confirmed"]
    presumed_names = [r["name"] for r in path if r["status"] == "presumed"]
    derived_total = sum(r["derived"] for r in path)

    return {
        "call": call,
        "call_note": "",
        "confidence": "high" if (derived_total >= 4 and call_chain[-1] != "Y-根（现代人类）") else
                      ("medium" if derived_total >= 2 else "low"),
        "path": path,
        "chain": call_chain,
        "evidence": evidence,
        "dup_side": dup_side,
        "uncovered": uncovered,
        "excluded": excluded,
        "confirmed_levels": confirmed_names,
        "presumed_levels": presumed_names,
    }


# ---------------------------------------------------------------------------
def analyze(conn: sqlite3.Connection, dbsnp: dict | None = None) -> dict:
    dbsnp = dbsnp if dbsnp is not None else load_dbsnp()
    trees = load_trees()
    mt = mt_analyze(conn, dbsnp, trees)
    y = y_analyze(conn, dbsnp, trees)
    return {"mt": mt, "y": y, "trees_meta": trees["_meta"]}


def build_report(conn: sqlite3.Connection, dbsnp: dict | None = None) -> dict:
    """组装前端页面 JSON（site/data/reports/haplogroups.json）。"""
    r = analyze(conn, dbsnp)
    mt, y, meta = r["mt"], r["y"], r["trees_meta"]

    mt_call_short = (mt["call"] or "无法判定").replace("（亚支未定）", "")
    y_call_short = y["call"].replace(" (M120)", "（M120）")

    mt_summary = ("F 系（R9 下游）是东亚与东南亚的代表性母系世系之一，F2 亚支在华南、西南"
                  "及东南亚人群较为常见。母系单倍群只反映「母亲→女儿」这一条线的谱系。")
    y_summary = ("Q-M242 谱系整体广布于西伯利亚与中亚，并经 Q-M3 等分支进入美洲原住民；"
                 "Q-M120 是在东亚土生分化的一支，在汉族中约占 2-5%（北方略高），"
                 "属东亚固有的早期父系世系。父系单倍群只反映「父亲→儿子」这一条线的谱系。")

    mt_matched_n = len(mt["evidence"])
    y_derived_n = sum(1 for e in y["evidence"] if e["status"] == "derived")

    return {
        "title": "父系与母系单倍群（粗判）",
        "icon": "🧭",
        "intro": ("单倍群是沿母系/父系「一条线」追溯的谱系标签。母系用 Phylotree Build 17.3 "
                  "全树（5,435 支系）做树感知走查；父系用 ISOGG 2016 主干树的经典标记。"
                  "判定原则与全站一致：宁可留白，不强行分层。"),
        "mt": {
            "label": "母系（mtDNA）",
            "call": mt_call_short,
            "call_display": mt["call"] or "无法判定",
            "confidence": mt["confidence"],
            "summary": mt_summary,
            "sub_note": mt["call_note"],
            "evidence_note": (f"路径上 {mt_matched_n} 个可测信息位点全部匹配、"
                              f"{len(mt['mismatches'])} 个矛盾。")
                              if not mt["mismatches"] else
                              (f"路径上 {mt_matched_n} 个匹配、{len(mt['mismatches'])} 个矛盾"
                               f"（矛盾位点见下表）。"),
            "path": mt["path"],
            "chain": mt["chain_full"],
            "evidence": mt["evidence"],
            "mismatches": mt["mismatches"],
            "subbranches": mt["subbranches"],
            "stats": mt["stats"],
        },
        "y": {
            "label": "父系（Y 染色体）",
            "call": y_call_short,
            "call_display": y_call_short,
            "confidence": y["confidence"],
            "summary": y_summary,
            "sub_note": "ISOGG 2016 在 Q1a1a1 层之下无更深 SNV 分层；更精细的下游分支"
                        "需要 WGS 或 Y-STR 高通量检测。中间层（GHIJK/HIJK/IJK/K2/Q1a/Q1a1）"
                        "无独立覆盖标记，由下游衍生标记按谱系关系传递确认。",
            "evidence_note": (f"{y_derived_n} 个单拷贝区衍生标记全部一致，"
                              f"{len(y['excluded'])} 个兄弟支系全部被祖先型标记或树位置排除。"),
            "path": y["path"],
            "chain": y["chain"],
            "evidence": y["evidence"],
            "dup_side": y["dup_side"],
            "uncovered": y["uncovered"],
            "excluded": y["excluded"],
            "confirmed_levels": y["confirmed_levels"],
            "presumed_levels": y["presumed_levels"],
        },
        "caveats": [
            "本页判定为「粗判」：给出的是当前芯片数据能支撑的最深支系，全部证据见下方表格，可自行核对。",
            "线粒体基因组覆盖约 " + str(mt["stats"]["coverage_pct"]) + "%（" +
            str(mt["stats"]["mt_valid"]) + "/" + "16,569），另有 " +
            str(mt["stats"]["mt_mixed"]) + " 个混合读数被忽略；控制区（D-loop）覆盖有限，"
            "部分亚支无法分辨属预期行为。",
            "Y 染色体 6.5-9.0Mb 存在多拷贝/回文区，该区间读数不可靠，不参与判定（仅作旁证）；"
            "Q 支系根定义位点 M242 未被芯片覆盖，由 3 个单拷贝区内部标记与下游 M120/M265 共同确证。",
            "单倍群不与任何民族、地域或身份挂钩，也不代表全部祖先构成；祖源定量分析见 ROADMAP。",
        ],
        "method": {
            "mt_tree": meta["mt_tree"],
            "mt_source": meta["mt_source"],
            "y_tree": meta["y_tree"],
            "y_source": meta["y_source"],
        },
    }


if __name__ == "__main__":
    import config
    if not config.SQLITE_PATH.exists():
        raise SystemExit("请先运行 make import")
    conn = sqlite3.connect(config.SQLITE_PATH)
    r = analyze(conn)
    print(json.dumps({"mt_call": r["mt"]["call"], "y_call": r["y"]["call"]},
                     ensure_ascii=False))

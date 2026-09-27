#!/usr/bin/env python3
"""步骤 2a（可选但推荐）：从 NCBI dbSNP 拉取面板位点的权威等位基因信息。

目的：gesedna 文件的 rsID→位置映射可能存在个别错误，且文献常用"基因方向"写法，
与正链互补。本脚本为每个面板位点获取 dbSNP 官方记录：
- GRCh37 (hg19) 的位置（用于与本地数据比对）
- 正链等位基因集合（用于校验原始数据的基因型合法性）

结果缓存在 pipeline/cache/dbsnp/rsNNN.json 并提交到仓库，
后续运行（包括离线）不再重复请求。
"""
from __future__ import annotations

import json
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config  # noqa: E402

REFSNP_API = "https://api.ncbi.nlm.nih.gov/variation/v0/refsnp/{rid}"
DELAY = 0.45  # NCBI 免费限速 ~3 req/s


def all_panel_rsids() -> set[str]:
    import gzip
    rsids = set()
    for pf in sorted((Path(__file__).parent / "panels").glob("*.json")):
        if pf.name.startswith("_"):
            continue
        data = json.loads(pf.read_text())
        for e in data.get("entries", []):
            r = e.get("rsid", "")
            if r.startswith("rs"):
                rsids.add(r)
    ann = json.loads((Path(__file__).parent / "panels" / "annotations_curated.json").read_text())
    rsids.update(k for k in ann["annotations"] if k.startswith("rs"))
    hg = Path(__file__).parent / "panels" / "haplogroup_trees.json.gz"
    if hg.exists():
        data = json.loads(gzip.open(hg, "rt", encoding="utf-8").read())

        def walk(node):
            for mk in node.get("markers", []):
                r = mk.get("rsid", "")
                if r.startswith("rs"):
                    rsids.add(r)
            for c in node.get("children", []):
                walk(c)

        walk(data.get("y", {}))
        rsids.update(r for r in data.get("mt_evidence_rsids", []) if r.startswith("rs"))
    return rsids


def parse_refsnp(payload: dict) -> dict | None:
    """从 refsnp JSON 提取 GRCh37 位置与正链等位基因。

    结构要点（实测）：
    - placement_annot.seq_id_traits_by_assembly[].assembly_name = "GRCh37.p13" 等
    - allele.allele.spdi.inserted_sequence / deleted_sequence（正链）
    - spdi.position 为 0 基，1 基坐标 = position + 1
    - 参考等位基因的 inserted == deleted；变异等位基因则不同
    - 只取主染色体 placement（is_chromosome），避免 alt/scaffold 混入错误位置
    """
    try:
        placements = payload["primary_snapshot_data"]["placements_with_allele"]
    except (KeyError, TypeError):
        return None

    def placement_pos_and_alleles(pl, asm_want):
        annot = pl.get("placement_annot", {})
        traits = (annot.get("seq_id_traits_by_assembly") or [{}])[0]
        if not (annot.get("seq_type") == "refseq_chromosome"
                and traits.get("is_top_level") and traits.get("is_chromosome")
                and asm_want in traits.get("assembly_name", "")):
            return None
        pos, ref, alts = None, None, set()
        for a in pl.get("alleles", []):
            spdi = a.get("allele", {}).get("spdi", {})
            dele = spdi.get("deleted_sequence", "")
            ins = spdi.get("inserted_sequence", "")
            p = spdi.get("position")
            if p is not None and pos is None:
                pos = p + 1
            if dele and ref is None:
                ref = dele
            if ins and ins != dele:
                alts.add(ins)
        return {"pos": pos, "ref": ref, "alts": sorted(alts)}

    got37 = got38 = None
    for pl in placements:
        r37 = placement_pos_and_alleles(pl, "GRCh37")
        if r37 and got37 is None:
            got37 = r37
        r38 = placement_pos_and_alleles(pl, "GRCh38")
        if r38 and got38 is None:
            got38 = r38
    main = got37 or got38
    if not main or not main["alts"] and not main["ref"]:
        return None
    alleles = set()
    if main["ref"]:
        alleles.add(main["ref"])
    alleles.update(main["alts"])
    return {
        "grch37_pos": got37["pos"] if got37 else None,
        "grch38_pos": got38["pos"] if got38 else None,
        "ref_allele": main["ref"],
        "alt_alleles": main["alts"],
        "plus_alleles": sorted(alleles),
    }


def main():
    cache_dir = config.CACHE_DIR / "dbsnp"
    cache_dir.mkdir(parents=True, exist_ok=True)
    rsids = sorted(all_panel_rsids())
    print(f"面板位点共 {len(rsids)} 个")
    ok = miss = 0
    for i, rsid in enumerate(rsids, 1):
        cache_path = cache_dir / f"{rsid}.json"
        if cache_path.exists():
            continue
        rid = rsid[2:]
        url = REFSNP_API.format(rid=rid)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "open-genome-report/0.1"})
            with urllib.request.urlopen(req, timeout=20) as resp:
                payload = json.load(resp)
            info = parse_refsnp(payload)
            if info:
                info["rsid"] = rsid
                cache_path.write_text(json.dumps(info, ensure_ascii=False))
                ok += 1
            else:
                miss += 1
                print(f"  [警告] {rsid} 无法解析 refsnp 结构")
        except Exception as exc:  # noqa: BLE001
            miss += 1
            print(f"  [错误] {rsid}: {exc}")
        if i % 25 == 0:
            print(f"  进度 {i}/{len(rsids)}（成功 {ok}）")
        time.sleep(DELAY)
    print(f"完成：新拉取 {ok}，失败/无法解析 {miss}，缓存目录 {cache_dir}")


if __name__ == "__main__":
    main()

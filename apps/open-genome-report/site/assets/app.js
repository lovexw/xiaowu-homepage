/* Open Genome Report — 前端渲染（零依赖，hash 路由）
 * 数据源：data/manifest.json + data/reports/*.json + data/genome/stats.json + data/quality.json
 */
"use strict";

const $app = document.getElementById("app");
const $nav = document.getElementById("top-nav");

let MANIFEST = null;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

/* ---------------- 导航 ---------------- */
async function loadManifest() {
  if (!MANIFEST) MANIFEST = await getJSON("data/manifest.json");
  const items = [
    { href: "#/", label: "🏠 总览" },
    ...MANIFEST.map((m) => ({ href: `#/${m.module.startsWith("assoc") ? "table" : "module"}/${m.module}`, label: `${m.icon} ${m.title}` })),
    { href: "#/haplogroups", label: "🧭 单倍群" },
    { href: "#/genome", label: "🧫 基因组概览与下载" },
    { href: "#/methods", label: "🔬 方法与数据质量" },
  ];
  $nav.innerHTML = items
    .map((i) => `<a href="${i.href}">${esc(i.label)}</a>`)
    .join("");
}

/* ---------------- 总览页 ---------------- */
async function renderHome() {
  const ov = await getJSON("data/reports/overview.json");
  const s = ov.stats;
  const total = s.total ?? (s.by_source ? Object.values(s.by_source).reduce((a, b) => a + b, 0) : 0);
  const owner = ov.profile.owner_name || "数据主人";
  const popsciHtml = (ov.home_popsci || [])
    .map((c) => `<div class="popsci-card"><span class="ic">${esc(c.icon)}</span><h4>${esc(c.title)}</h4><p>${esc(c.text)}</p></div>`)
    .join("");
  const modulesHtml = MANIFEST
    .filter((m) => !m.module.startsWith("assoc"))
    .map((m) => `
      <a class="module-card" href="#/module/${m.module}">
        <span class="ic">${esc(m.icon)}</span>
        <h3>${esc(m.title)}</h3>
        <p>${esc(m.intro)}</p>
        <div class="cnt">已解读 ${m.counts.ok} / 覆盖 ${m.counts.total - m.counts.not_called} / ${m.counts.total} 个位点</div>
      </a>`)
    .join("");
  const tablesHtml = MANIFEST
    .filter((m) => m.module.startsWith("assoc"))
    .map((m) => `
      <a class="module-card" href="#/table/${m.module}">
        <span class="ic">📊</span>
        <h3>${esc(m.title)}</h3>
        <p>前期整理的位点清单 + 文献注释 + 外链，共 ${m.counts.total} 行。</p>
      </a>`)
    .join("");

  $app.innerHTML = `
    <div class="hero">
      <div class="stat-card"><div class="num">${(total / 10000).toFixed(1)} 万</div><div class="lbl">基因组位点（实测+填充）</div></div>
      <div class="stat-card"><div class="num">${((s.by_source?.ASA ?? 0) / 10000).toFixed(1)} 万</div><div class="lbl">芯片实测位点</div></div>
      <div class="stat-card"><div class="num">${((s.by_source?.IMP ?? 0) / 10000).toFixed(1)} 万</div><div class="lbl">1000G 填充位点</div></div>
      <div class="stat-card"><div class="num">${(s.het_rate * 100).toFixed(1)}%</div><div class="lbl">杂合率</div></div>
    </div>

    <div class="profile-card">
      <h3>👤 关于${esc(owner)}（最小化原则，仅必要内容）</h3>
      <p>
        <span class="badge hl">数据主人：${esc(owner)}（本人乐意公开）</span>
        <span class="badge hl">${esc(ov.sex_inference.value)}</span>
        <span class="badge hl">血型推断：${esc(ov.blood_type.value)}</span>
        <span class="badge hl">APOE：${esc(ov.apoe.value ?? "—")}</span>
        ${ov.y_haplogroup ? `<span class="badge hl">父系单倍群：${esc(ov.y_haplogroup.value)}</span>` : ""}
        ${ov.mt_haplogroup ? `<span class="badge hl">母系单倍群：${esc(ov.mt_haplogroup.value)}</span>` : ""}
      </p>
      <p style="margin-top:8px">
        <span class="badge">检测平台：${esc(ov.profile.data_platform)}</span>
        <span class="badge">坐标系统：${esc(ov.profile.genome_build)}</span>
        <span class="badge">原始数据导出：${esc(ov.profile.data_generated)}</span>
      </p>
    </div>

    <h2 class="sec">🌟 30 秒读懂你的基因组</h2>
    <p class="sec-sub">先看这段科普，后面的报告会好读很多。</p>
    <div class="popsci-hero">${popsciHtml}</div>

    <h2 class="sec">📚 报告模块</h2>
    <p class="sec-sub">按科学可靠度排序：药物基因组学最可靠；健康风险仅作统计参考。每个位点都配了「🗣️ 人话版」。</p>
    <div class="module-grid">${modulesHtml}</div>

    <h2 class="sec">📊 关联位点总表</h2>
    <p class="sec-sub">前期整理的位点清单，与文献注释、GWAS Catalog/dbSNP/SNPedia 外链合并展示。</p>
    <div class="module-grid">${tablesHtml}</div>
  `;
}

/* ---------------- 模块页（解读面板） ---------------- */
function entryHtml(e) {
  if (e.crosslink) {
    const m = MANIFEST.find((x) => x.module === e.crosslink);
    return `<div class="entry">
      <div class="entry-head"><h3>${esc(e.gene)}</h3>
        <span class="cross-tag">→ 已归入「${esc(m ? m.title : e.crosslink)}」模块</span></div>
      <p class="nc-note">${esc(e.note || "")}</p>
    </div>`;
  }
  const gtChip = e.genotype
    ? `<span class="gt-chip">${esc(e.genotype)}</span>` +
      (e.genotype_gene_direction && e.genotype_gene_direction !== e.genotype
        ? `<span class="gt-chip dim">基因方向 ${esc(e.genotype_gene_direction)}</span>` : "")
    : `<span class="gt-chip dim">未测出</span>`;
  const src = e.source ? `<span class="src-tag">${e.source === "ASA" ? "芯片实测" : "填充推断"}${e.found_by === "position_fallback" ? " · 按位置回查" : ""}</span>` : "";
  const plainHtml = e.plain ? `<div class="plain">${esc(e.plain)}</div>` : "";

  let body = "";
  if (e.status === "ok" || e.status === "flagged") {
    body = `<div class="resolved ${e.resolved.level}">
      <div class="label">${esc(e.resolved.label)}</div>
      <p>${esc(e.resolved.text)}</p>
    </div>`;
  } else if (e.status === "no_call") {
    body = `<p class="nc-note">该位点在原始数据中无有效分型（"--"），不作解读。</p>`;
  } else if (e.status === "not_called") {
    body = `<p class="nc-note">芯片未覆盖该位点，填充数据亦未提供。</p>`;
  } else if (e.status === "unknown_gt") {
    body = `<p class="nc-note">基因型读数（${esc(e.genotype)}）与面板预设等位基因不符，为避免错误解读暂不给出结论。详见「方法与数据质量」页。</p>`;
  }
  const flagHtml = e.flag
    ? `<div class="flag-note">⚠️ dbSNP 校验提示（${e.flag === "allele" ? "等位基因不匹配" : "位置与 GRCh37 不符"}）：该位点解读可能受链方向/映射问题影响，以下结论仅供参考。</div>`
    : "";
  const links = Object.entries(e.links || {})
    .map(([k, v]) => `<a href="${v}" target="_blank" rel="noopener">${{ dbsnp: "dbSNP", snpedia: "SNPedia", gwas: "GWAS Catalog", pubmed: "PubMed 检索" }[k] || k}</a>`)
    .join("");
  return `<div class="entry" id="${esc(e.rsid)}">
    <div class="entry-head">
      <span class="gene">${esc(e.gene)}</span>
      <h3>${esc(e.rsid)}</h3>
      <span class="variant">${esc(e.variant)}</span>
    </div>
    <div class="gt-row">${gtChip}${src}</div>
    ${plainHtml}${flagHtml}${body}
    <div class="entry-foot">
      <span class="conf ${e.confidence}">证据等级：${e.confidence === "high" ? "高" : e.confidence === "medium" ? "中" : "低"}</span>
      ${links}
    </div>
    ${e.note ? `<p class="nc-note" style="margin-top:6px">${esc(e.note)}</p>` : ""}
  </div>`;
}

async function renderModule(name) {
  const m = await getJSON(`data/reports/${name}.json`);
  const groups = {};
  for (const e of m.entries) {
    const g = e.group || "其他";
    (groups[g] = groups[g] || []).push(e);
  }
  const sections = Object.entries(groups).map(([g, list]) => `
    <h2 class="sec">${esc(g)}</h2>
    <p class="sec-sub">${list.length} 个位点</p>
    ${list.map(entryHtml).join("")}`).join("");
  const cards = (m.special_cards || [])
    .map((c) => `<div class="card-note ${c.level}"><h4>📌 ${esc(c.title)}</h4><p>${esc(c.text)}</p>${(c.links || [])
      .map((l) => `<p style="margin-top:4px"><a href="${esc(l.url)}" target="_blank" rel="noopener">📄 ${esc(l.label)} ↗</a></p>`)
      .join("")}</div>`)
    .join("");
  const popsci = (m.popsci_cards || [])
    .map((c) => `<div class="popsci-card"><h4>💡 ${esc(c.title)}</h4><p>${esc(c.text)}</p></div>`)
    .join("");
  const c = m.counts;
  $app.innerHTML = `
    <h2 class="sec">${esc(m.icon)} ${esc(m.title)}</h2>
    <p class="sec-sub">${esc(m.intro)}</p>
    <p class="sec-sub">位点覆盖：${c.ok} 条已解读 · ${c.flagged} 条带校验标记 · ${c.not_called} 条未覆盖，共 ${c.total} 条。</p>
    <h2 class="sec">💡 科普时间</h2>
    <p class="sec-sub">先看点背景知识，下面的位点更好懂。</p>
    ${popsci}
    <h2 class="sec">🔬 位点解读</h2>
    ${cards}${sections}`;
}

/* ---------------- 关联表页 ---------------- */
async function renderTable(name) {
  const t = await getJSON(`data/reports/${name}.json`);
  const confBadge = (c) => c ? `<span class="conf ${c}">${{ high: "高", medium: "中", low: "低" }[c] || "—"}</span>` : "—";
  const rows = t.rows.map((r) => `
    <tr id="${esc(name)}-${esc(r.rsid)}">
      <td class="mono">${esc(r.rsid)}</td>
      <td>chr${esc(r.chrom)}</td>
      <td class="mono">${esc(r.pos)}</td>
      <td class="mono">${esc(r.gt)}</td>
      <td>${esc(r.gene || "—")}</td>
      <td>${esc(r.trait || "—")}</td>
      <td>${confBadge(r.conf)}</td>
      <td>${r.in_panel ? '<a href="#/" title="已归入报告模块">✔ 已入面板</a>' : ""}${r.flag ? ' ⚠️' : ""}</td>
      <td>
        <a href="${r.links.dbsnp}" target="_blank" rel="noopener">dbSNP</a>
        <a href="${r.links.gwas}" target="_blank" rel="noopener">GWAS</a>
        <a href="${r.links.snpedia}" target="_blank" rel="noopener">SNPedia</a>
      </td>
    </tr>`).join("");
  $app.innerHTML = `
    <h2 class="sec">📊 ${esc(t.title)}</h2>
    <p class="sec-sub">本表为「位点 + 注释 + 外链」的关联级展示，不做个人化结论；trait 为文献常见关联，效应量普遍很小。⚠ = 位置与 dbSNP GRCh37 记录不符（gesedna 映射问题），解读请以外链源为准。</p>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>rsID</th><th>Chr</th><th>位置 (hg19)</th><th>基因型</th><th>基因/区域</th><th>常见关联</th><th>证据</th><th>状态</th><th>外链</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

/* ---------------- 基因组概览与下载 ---------------- */
async function renderGenome() {
  const st = await getJSON("data/genome/stats.json");
  const maxTotal = Math.max(...st.chromosomes.map((c) => c.total));
  const bars = st.chromosomes.map((c) => `
    <div class="bar-row">
      <span>chr${esc(c.chrom)}</span>
      <div class="bar-track" title="实测 ${c.asa} + 填充 ${c.imp}">
        <div class="bar-asa" style="width:${(c.asa / maxTotal) * 100}%"></div>
        <div class="bar-imp" style="width:${(c.imp / maxTotal) * 100}%"></div>
      </div>
      <span class="bar-num">${c.total.toLocaleString()} 位点</span>
    </div>`).join("");
  const dl = st.chromosomes
    .map((c) => `<a href="data/genome/chr${esc(c.chrom)}.tsv.gz" download>chr${esc(c.chrom)} (${Math.max(c.file_kb / 1024, 0.01).toFixed(2)} MB)</a>`)
    .join(" · ");
  $app.innerHTML = `
    <h2 class="sec">🧫 全基因组概览</h2>
    <p class="sec-sub">坐标 ${esc(st.build)}。青色=芯片实测（ASA），深蓝=填充（IMP）。MT 为线粒体基因组（3,738 位点覆盖，可另做单倍型分析，见 ROADMAP）。</p>
    <div class="chr-chart">${bars}</div>
    <h2 class="sec">⬇️ 原始分型下载（gzip TSV）</h2>
    <p class="sec-sub">列：rsid / chrom / pos / genotype / source。genotype 为正链方向，"--" 表示无有效分型。数据以 CC BY-NC-ND 4.0 公开（禁商用、禁演绎；使用边界见数据许可声明）。</p>
    <div class="card-note"><p>${dl}</p></div>`;
}

/* ---------------- 方法与数据质量 ---------------- */
async function renderMethods() {
  let q = null;
  try { q = await getJSON("data/quality.json"); } catch { /* 可选 */ }
  const noteRows = q ? Object.entries(q.user_note_check)
    .map(([k, v]) => `<div class="kv"><b>${esc(k)}</b>共 ${v.total} 条 · 一致 ${v.match} · 不一致 ${v.mismatch} · 库中无 ${v.absent}</div>`)
    .join("") : "";
  const issues = q && q.panel_issues ? q.panel_issues.map((i) =>
    `<div class="kv"><b>${esc(i.rsid)}（${esc(i.module)}）</b>${esc(i.issue)}：数据读数 ${esc(i.db_gt || "-")} vs dbSNP 正链等位基因 [${esc((i.dbsnp_plus_alleles || []).join("/"))}] ${i.dbsnp_grch37_pos ? `；位置：数据 ${i.db_pos} vs dbSNP ${i.dbsnp_grch37_pos}` : ""}</div>`
  ).join("") : "";
  $app.innerHTML = `
    <h2 class="sec">🔬 方法说明</h2>
    <div class="kv-list">
      <div class="kv"><b>数据来源</b>gesedna 导出（2019-12），Illumina ASA 芯片实测 + 1000 Genomes 填充</div>
      <div class="kv"><b>坐标系统</b>GRCh37 / hg19，正链方向；文献"基因方向"写法已做互补换算并标注</div>
      <div class="kv"><b>合并策略</b>ASA 实测与 IMP 填充严格互补（无重叠），直接并集；冲突时以 ASA 为准</div>
      <div class="kv"><b>解读原则</b>只使用分型明确的位点；每个结论附证据等级与外链；结构变异（CYP2D6、HLA、5-HTTLPR 等）明确不推断</div>
      <div class="kv"><b>许可</b>代码 MIT；数据 CC BY-NC-ND 4.0（禁商用 / 禁演绎，原样署名转载）；解读文字原创</div>
    </div>
    <h2 class="sec">✅ 数据质量校验</h2>
    <p class="sec-sub">用户前期人工提取清单 vs 原始数据比对：</p>
    <div class="kv-list">${noteRows || "<p>未运行校验。</p>"}</div>
    <p class="sec-sub">面板位点 vs dbSNP（正链等位基因 + GRCh37 位置）校验问题（${q ? q.panel_issue_count : 0} 个）：</p>
    <div class="kv-list">${issues || "<p>✅ 无问题（或未运行 dbSNP 校验）。</p>"}</div>
    <div class="card-note attention"><h4>⚠️ 使用边界</h4>
      <p>消费级芯片 + 填充数据的分型质量达不到临床标准（原始文件头亦声明仅供科研）。填充位点是统计推断，可能出错；罕见变异、拷贝数变异、结构变异均不可靠。请勿将本报告用于医疗决策。</p>
    </div>`;
}

/* ---------------- 单倍群（父系 Y / 母系 mtDNA） ---------------- */
function confBadge(c) {
  if (!c) return "";
  return `<span class="conf ${c}">证据等级：${c === "high" ? "高" : c === "medium" ? "中" : "低"}</span>`;
}

function pathChain(nodes) {
  const cls = (s) => s === "confirmed" ? "confirmed" : s === "presumed" ? "presumed"
    : s === "root" ? "root" : "stop";
  return nodes.map((n) => {
    const extra = n.own_matched ? ` <small>+${n.own_matched}</small>` : "";
    return `<span class="path-chip ${cls(n.status)}" title="${esc(n.note || "")}">${esc(n.name)}${extra}</span>`;
  }).join('<span class="path-arrow">→</span>');
}

function haplogroupEvidenceTable(hg) {
  const rows = hg.evidence.map((e) => `
    <tr>
      <td class="mono">${esc(e.marker || "m." + e.pos)}</td>
      <td>${esc(e.branch)}</td>
      <td class="mono">${e.rsid ? esc(e.rsid) : (e.pos != null ? "hg19:" + esc(e.pos) : "—")}</td>
      <td class="mono">${esc(e.mutation || e.poly || "—")}</td>
      <td class="mono">${esc(e.observed ?? "—")}</td>
      <td>${e.status === "derived" || e.dbsnp === "ok" ? "✅ 衍生（匹配）" :
            e.status === "ancestral" ? "⭕ 祖先型" : "✅ 匹配"}</td>
    </tr>`).join("");
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>标记/位点</th><th>支系</th><th>rsID / 位置</th><th>树期望（衍生）</th><th>实测</th><th>判定</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

async function renderHaplogroups() {
  const d = await getJSON("data/reports/haplogroups.json");
  const mt = d.mt, y = d.y;

  const mtSubs = mt.subbranches.map((s) => `
    <tr><td>${esc(s.name)}</td>
    <td>${s.verdict === "excluded" ? "❌ 已排除" : s.verdict === "possible" ? "✅ 可匹配" : "❓ 不能排除"}</td>
    <td>${esc(s.detail)}</td></tr>`).join("");

  const yExcluded = y.excluded.map((x) => `
    <tr><td>${esc(x.branch)}</td><td>${esc(x.reason)}</td></tr>`).join("");

  const ySideNotes = [];
  if (y.dup_side.length) ySideNotes.push(
    `<p class="nc-note">多拷贝区旁证（不参与判级）：${y.dup_side.map((e) => `${esc(e.marker)}=${esc(e.observed)}（衍生）`).join("、")}。该区间读数不可靠，仅记录。</p>`);
  if (y.uncovered.length) ySideNotes.push(
    `<p class="nc-note">未覆盖/读数异常位点：${y.uncovered.map((e) => `${esc(e.marker)}（${e.status === "uncovered" ? "芯片未覆盖" : e.status === "ambiguous" ? "杂合读数" : "读数异常"}）`).join("、")}。</p>`);

  const mtMism = (mt.mismatches || []).map((e) =>
    `<tr><td class="mono">m.${esc(e.pos)}</td><td>${esc(e.branch)}</td><td class="mono">${esc(e.poly)}</td><td class="mono">${esc(e.observed)}</td></tr>`).join("");

  $app.innerHTML = `
    <h2 class="sec">🧭 父系与母系单倍群（粗判）</h2>
    <p class="sec-sub">${esc(d.intro)}</p>

    <div class="hg-grid">
      <div class="card-note hg-call-card">
        <h4>🧬 ${esc(mt.label)} ${confBadge(mt.confidence)}</h4>
        <div class="hg-call">${esc(mt.call_display)}</div>
        <p>${esc(mt.summary)}</p>
        <p class="nc-note">${esc(mt.sub_note)}</p>
      </div>
      <div class="card-note hg-call-card">
        <h4>🧬 ${esc(y.label)} ${confBadge(y.confidence)}</h4>
        <div class="hg-call">${esc(y.call_display)}</div>
        <p>${esc(y.summary)}</p>
        <p class="nc-note">${esc(y.sub_note)}</p>
      </div>
    </div>

    <h2 class="sec">🗺️ 母系判定路径</h2>
    <p class="sec-sub">${esc(mt.evidence_note)} 树根为 rCRS 参考序列；<span class="path-chip confirmed">绿</span>=该层有覆盖标记直接确证。</p>
    <div class="path-chain">${pathChain(mt.path)}</div>
    ${haplogroupEvidenceTable({ evidence: mt.evidence.map((e) => ({ ...e, marker: "m." + e.pos, mutation: e.poly })) })}
    <h3 class="sec-sub" style="margin-top:18px">F2 下游亚支判定</h3>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>亚支</th><th>结论</th><th>依据</th></tr></thead>
      <tbody>${mtSubs}</tbody></table></div>
    ${mtMism ? `<h3 class="sec-sub">矛盾位点</h3>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>位点</th><th>支系</th><th>树期望</th><th>实测</th></tr></thead>
      <tbody>${mtMism}</tbody></table></div>` : ""}

    <h2 class="sec">🗺️ 父系判定路径</h2>
    <p class="sec-sub">${esc(y.evidence_note)} <span class="path-chip confirmed">绿</span>=该层有单拷贝区标记直接确证；<span class="path-chip presumed">灰</span>=无独立覆盖标记，由下游传递确认。</p>
    <div class="path-chain">${pathChain(y.path)}</div>
    ${haplogroupEvidenceTable(y)}
    ${ySideNotes.join("")}
    <h3 class="sec-sub" style="margin-top:18px">兄弟支系排除（干净位置的祖先型证据）</h3>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>支系</th><th>排除依据</th></tr></thead>
      <tbody>${yExcluded}</tbody></table></div>

    <div class="card-note attention"><h4>⚠️ 解读边界</h4>
      <p>${d.caveats.map(esc).join("</p><p>")}</p>
    </div>
    <div class="kv-list">
      <div class="kv"><b>母系树数据</b>${esc(d.method.mt_tree)} · ${esc(d.method.mt_source)}</div>
      <div class="kv"><b>父系树数据</b>${esc(d.method.y_tree)} · ${esc(d.method.y_source)}</div>
      <div class="kv"><b>MT 覆盖</b>${mt.stats.mt_valid} / 16,569 位点（${mt.stats.coverage_pct}%），另忽略 ${mt.stats.mt_mixed} 个混合读数</div>
    </div>`;
}

/* ---------------- 站内搜索 ---------------- */
/* 索引由 build_reports.py 生成（data/search_index.json），首次聚焦时懒加载 */
let SEARCH_INDEX = null;
let SEARCH_LOADING = null;
let SEARCH_TIMER = null;
let SEARCH_ACTIVE = -1;
let SEARCH_ITEMS = [];

const $searchBox = document.querySelector(".search-box");
const $searchInput = document.getElementById("site-search");
const $searchResults = document.getElementById("search-results");

function ensureSearchIndex() {
  if (!SEARCH_LOADING) {
    SEARCH_LOADING = (async () => {
      const idx = await getJSON("data/search_index.json");
      for (const it of idx.entries) {
        it._hay = `${it.rsid} ${it.gene} ${it.title} ${it.sub} ${it.module} ${it.text}`.toLowerCase();
      }
      for (const p of idx.pages) {
        p._hay = `${p.title} ${p.text}`.toLowerCase();
        p.sub = "";
        p.anchor = null;
      }
      SEARCH_INDEX = idx;
    })();
  }
  return SEARCH_LOADING;
}

function scoreItem(it, tokens) {
  let total = 0;
  const rsid = (it.rsid || "").toLowerCase();
  const gene = (it.gene || "").toLowerCase();
  const title = (it.title || "").toLowerCase();
  for (const q of tokens) {
    let s = 0;
    if (rsid && rsid === q) s = 1000;
    else if (rsid && q.startsWith("rs") && rsid.startsWith(q)) s = 900;
    else if (gene && gene === q) s = 800;
    else if (gene && gene.startsWith(q)) s = 700;
    else if (title.startsWith(q)) s = 600;
    else if (title.includes(q)) s = 500;
    else if (it._hay.includes(q)) s = 300;
    if (!s) return 0;           // 所有词都必须命中
    total += s;
  }
  return total;
}

function doSearch(q) {
  if (!SEARCH_INDEX) return;   // 索引未就绪（ensureSearchIndex 会先加载再调用本函数）
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) { hideResults(); return; }
  const scored = [];
  for (const it of [...SEARCH_INDEX.entries, ...SEARCH_INDEX.pages]) {
    const s = scoreItem(it, tokens);
    if (s) scored.push([s, it]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const kindRank = { panel: 1, table: 2, page: 3 };
  scored.forEach(([s, it]) => { it._s = s; });
  SEARCH_ITEMS = scored.slice(0, 40).map(([, it]) => it)
    .sort((a, b) => (kindRank[a.kind] || 9) - (kindRank[b.kind] || 9) || b._s - a._s);
  renderResults(SEARCH_ITEMS, q);
}

function renderResults(items, q) {
  SEARCH_ACTIVE = -1;
  if (!items.length) {
    $searchResults.innerHTML = `<div class="search-empty">未找到与「${esc(q)}」相关的内容（检索范围：110 个解读位点 + 330 关联表行 + 各页面）</div>`;
    $searchResults.hidden = false;
    return;
  }
  const KIND_LABEL = { panel: "📖 位点解读", table: "📊 关联表", page: "📄 页面" };
  let lastKind = "";
  let html = "";
  for (const it of items) {
    if (it.kind !== lastKind) {
      html += `<div class="search-group">${KIND_LABEL[it.kind] || it.kind}</div>`;
      lastKind = it.kind;
    }
    html += `<div class="search-item" data-href="${esc(it.href)}" data-anchor="${esc(it.anchor || "")}">
      <div class="si-title">${esc(it.title)}</div>
      <div class="si-sub">${esc(it.sub || it.module || "")}${it.module && it.sub ? " · " : ""}${esc(it.module || "")}</div>
    </div>`;
  }
  html += `<div class="search-foot">↩ 打开首个结果 · ↑↓ 选择 · Esc 关闭</div>`;
  $searchResults.innerHTML = html;
  $searchResults.hidden = false;
}

function hideResults() {
  $searchResults.hidden = true;
  $searchResults.innerHTML = "";
  SEARCH_ACTIVE = -1;
  SEARCH_ITEMS = [];
}

function jumpToItem(item) {
  hideResults();
  $searchInput.blur();
  PENDING_ANCHOR = item.anchor || null;
  if (location.hash === item.href) {
    route();                    // 同页跳锚点：重渲染后滚动
  } else {
    location.hash = item.href;  // 触发 hashchange → route → afterRender
  }
}

function setActiveResult(i) {
  const nodes = [...$searchResults.querySelectorAll(".search-item")];
  if (!nodes.length) return;
  SEARCH_ACTIVE = (i + nodes.length) % nodes.length;
  nodes.forEach((n, j) => n.classList.toggle("active", j === SEARCH_ACTIVE));
  nodes[SEARCH_ACTIVE].scrollIntoView({ block: "nearest" });
}

if ($searchInput) {
  $searchInput.addEventListener("focus", async () => {
    try {
      await ensureSearchIndex();
      if ($searchInput.value.trim()) doSearch($searchInput.value);
    } catch (err) {
      $searchResults.innerHTML = `<div class="search-empty">索引加载失败：${esc(err.message)}</div>`;
      $searchResults.hidden = false;
    }
  });
  $searchInput.addEventListener("input", () => {
    clearTimeout(SEARCH_TIMER);
    SEARCH_TIMER = setTimeout(async () => {
      try {
        await ensureSearchIndex();
        doSearch($searchInput.value);
      } catch (err) {
        $searchResults.innerHTML = `<div class="search-empty">索引加载失败：${esc(err.message)}</div>`;
        $searchResults.hidden = false;
      }
    }, 120);
  });
  $searchInput.addEventListener("keydown", (e) => {
    if ($searchResults.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveResult(SEARCH_ACTIVE + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveResult(SEARCH_ACTIVE - 1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const target = SEARCH_ITEMS[Math.max(SEARCH_ACTIVE, 0)];
      if (target) jumpToItem(target);
    } else if (e.key === "Escape") {
      hideResults();
      $searchInput.blur();
    }
  });
  $searchResults.addEventListener("pointerdown", (e) => {
    const item = e.target.closest(".search-item");
    if (!item) return;
    e.preventDefault();         // 防止 input blur 抢先关闭下拉
    jumpToItem({
      href: item.dataset.href,
      anchor: item.dataset.anchor || null,
    });
  });
  document.addEventListener("pointerdown", (e) => {
    if (!$searchBox.contains(e.target)) hideResults();
  });
  document.addEventListener("keydown", (e) => {
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
    if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !inField)) {
      e.preventDefault();
      $searchInput.focus();
      $searchInput.select();
    }
  });
}

/* ---------------- 路由 ---------------- */
/* 搜索跳转的锚点目标：路由渲染完成后滚动到位并高亮（见 route/afterRender） */
let PENDING_ANCHOR = null;

function afterRender() {
  if (PENDING_ANCHOR) {
    const anchor = PENDING_ANCHOR;
    PENDING_ANCHOR = null;
    const el = document.getElementById(anchor);
    if (el) {
      /* 用 instant：smooth 会被重渲染与 content-visibility 估算高度的变化打断；
         渲染沉降后再校正一次（离屏条目真实高度与估算值的偏差） */
      el.scrollIntoView({ block: "center", behavior: "instant" });
      el.classList.add("flash-target");
      setTimeout(() => {
        const el2 = document.getElementById(anchor);
        if (el2) el2.scrollIntoView({ block: "center", behavior: "instant" });
      }, 350);
      setTimeout(() => el.classList.remove("flash-target"), 2600);
      return;
    }
    /* 锚点不存在（数据变动等）则退回页首 */
  }
  /* 切换页面后回到该页顶部；instant 避免与 html 的 smooth 行为叠加 */
  window.scrollTo({ top: 0, behavior: "instant" });
}

async function route() {
  const hash = location.hash || "#/";
  try {
    await loadManifest();
    document.querySelectorAll("#top-nav a").forEach((a) => {
      const target = a.getAttribute("href");
      a.classList.toggle("active",
        target === hash || (hash.startsWith(target) && target !== "#/" && target !== "#"));
    });
    const m = hash.match(/^#\/(module|table)\/([\w-]+)$/);
    if (hash === "#/" || hash === "#" || hash === "") await renderHome();
    else if (m) await (m[1] === "module" ? renderModule(m[2]) : renderTable(m[2]));
    else if (hash === "#/genome") await renderGenome();
    else if (hash === "#/methods") await renderMethods();
    else if (hash === "#/haplogroups") await renderHaplogroups();
    else await renderHome();
    afterRender();
  } catch (err) {
    console.error(err);
    $app.innerHTML = `<div class="card-note caution"><h4>加载失败</h4><p>${esc(err.message)}。若在本地预览，请确保通过 HTTP 服务访问（make serve），而非直接打开文件。</p></div>`;
    afterRender();
  }
}

window.addEventListener("hashchange", route);
route();

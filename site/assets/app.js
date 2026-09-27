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
        <p>你前期整理的位点清单 + 文献注释 + 外链，共 ${m.counts.total} 行。</p>
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
      <h3>👤 基本信息（最小化原则，仅必要内容）</h3>
      <p>
        <span class="badge hl">${esc(ov.sex_inference.value)}</span>
        <span class="badge hl">血型推断：${esc(ov.blood_type.value)}</span>
        <span class="badge hl">APOE：${esc(ov.apoe.value ?? "—")}</span>
        <span class="badge">检测平台：${esc(ov.profile.data_platform)}</span>
        <span class="badge">坐标系统：${esc(ov.profile.genome_build)}</span>
        <span class="badge">原始数据导出：${esc(ov.profile.data_generated)}</span>
      </p>
    </div>

    <h2 class="sec">📚 报告模块</h2>
    <p class="sec-sub">按科学可靠度排序：药物基因组学最可靠；健康风险仅作统计参考。</p>
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
    ${flagHtml}${body}
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
    .map((c) => `<div class="card-note ${c.level}"><h4>📌 ${esc(c.title)}</h4><p>${esc(c.text)}</p></div>`)
    .join("");
  const c = m.counts;
  $app.innerHTML = `
    <h2 class="sec">${esc(m.icon)} ${esc(m.title)}</h2>
    <p class="sec-sub">${esc(m.intro)}</p>
    <p class="sec-sub">位点覆盖：${c.ok} 条已解读 · ${c.flagged} 条带校验标记 · ${c.not_called} 条未覆盖，共 ${c.total} 条。</p>
    ${cards}${sections}`;
}

/* ---------------- 关联表页 ---------------- */
async function renderTable(name) {
  const t = await getJSON(`data/reports/${name}.json`);
  const confBadge = (c) => c ? `<span class="conf ${c}">${{ high: "高", medium: "中", low: "低" }[c] || "—"}</span>` : "—";
  const rows = t.rows.map((r) => `
    <tr>
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
    <p class="sec-sub">列：rsid / chrom / pos / genotype / source。genotype 为正链方向，"--" 表示无有效分型。数据所有者已同意以 CC BY 4.0 公开。</p>
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
      <div class="kv"><b>许可</b>代码 MIT；数据 CC BY 4.0（所有者本人确认公开）；解读文字原创</div>
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

/* ---------------- 路由 ---------------- */
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
    if (hash === "#/" || hash === "#" || hash === "") return await renderHome();
    if (m) return m[1] === "module" ? await renderModule(m[2]) : await renderTable(m[2]);
    if (hash === "#/genome") return await renderGenome();
    if (hash === "#/methods") return await renderMethods();
    return await renderHome();
  } catch (err) {
    console.error(err);
    $app.innerHTML = `<div class="card-note caution"><h4>加载失败</h4><p>${esc(err.message)}。若在本地预览，请确保通过 HTTP 服务访问（make serve），而非直接打开文件。</p></div>`;
  }
}

window.addEventListener("hashchange", route);
route();

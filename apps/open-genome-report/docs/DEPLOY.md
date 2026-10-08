# 部署手册（GitHub + Cloudflare Pages）

## 架构

```
本机原始数据 (gitignore)
      │ make import/verify/reports/export
      ▼
site/（静态产物，提交进 Git）
      │ git push
      ▼
GitHub (lovexw/open-genome-report)
      │ Cloudflare Pages Git 集成（自动）或 wrangler 手动
      ▼
Cloudflare Pages CDN
```

纯静态、无构建步骤、无后端 → Pages 零配置。

## GitHub

- 仓库：`lovexw/open-genome-report`（public）
- 推送：`git push origin main`
- CI：`.github/workflows/ci.yml` 只做产物一致性检查（面板 JSON 合法性 + 报告内
  rsID 与面板一致），因原始数据在本机，CI 不重建数据。

## Cloudflare Pages

### 方式 A：Dashboard 连接仓库（推荐，自动部署）
1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
2. 选 `open-genome-report` 仓库
3. 构建设置：
   - Framework preset: **None**
   - Build command: **留空**
   - Build output directory: **site**
4. 保存 → 每次 push 到 main 自动部署

### 方式 B：wrangler 手动部署
```bash
npx wrangler login            # 首次需浏览器授权
npx wrangler pages project create open-genome-report --production-branch main
npx wrangler pages deploy site --project-name=open-genome-report
```

### 自定义域名（可选）
Pages 项目 → Custom domains → 添加域名，按提示加 CNAME。

## 更新逻辑

| 变更 | 操作 |
|---|---|
| 解读内容 | 改 `pipeline/panels/*.json` → `make reports` → commit & push |
| 数据更新 | 新原始文件放 `GENOME_RAW_DIR` → `make all` → commit & push |
| 前端 | 改 `site/assets/*` → commit & push |

push 后 Pages 自动重建（约 30 秒）。**更新后记得同步 AI_HANDOFF.md 的状态。**

## 当前部署状态

- ⏳ 首次部署：见 AI_HANDOFF.md「部署状态」小节（本文件不重复维护状态，以 HANDOFF 为准）。

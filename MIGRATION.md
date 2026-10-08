# Monorepo 迁移手册

本仓库是小吴乐意所有网站的唯一总仓库（monorepo）。主站在仓库根目录，每个小工具在 `apps/` 下有独立目录，各自部署到 Cloudflare，绑定独立二级域名。本文档记录每个项目的部署参数、从旧仓库切换到本仓库的完整流程，以及双仓库并行期间的代码同步方法。

## 一、架构总览

```
xiaowu-homepage/
├── index.html  css/  js/  src/  public/     主站 → www.xiaowuleyi.com
├── apps/
│   ├── brand-kit/                           品牌视觉规范
│   ├── xw-music/                            私人音乐播放器（Worker）
│   ├── subtitle-collage/                    台词拼图
│   ├── password-generator/                  密码生成器
│   ├── open-genome-report/                  基因报告（站点在其 site/ 子目录）
│   └── fitlab-videos/                       FitLab 健身视频库
├── scripts/                                 主站构建脚本
└── MIGRATION.md                             本文件
```

对应关系一览：

| 目录 | Cloudflare 项目 | 项目类型 | 当前线上地址 | 部署内容目录 | 构建命令 |
|---|---|---|---|---|---|
| 根目录 | xiaowu-homepage | Pages | www.xiaowuleyi.com | 根目录 | `node scripts/build.mjs` |
| apps/brand-kit | brand-kit | Pages 纯静态 | brand-kit-1kb.pages.dev（待绑域名） | apps/brand-kit | 无 |
| apps/xw-music | xw-music | Worker + 静态资源 + R2 | xw-music.0471666.workers.dev（待绑域名） | 见下文 | `npm install && wrangler deploy` |
| apps/subtitle-collage | subtitle-collage | Pages 纯静态 | pintu.xiaowuleyi.com | apps/subtitle-collage | 无 |
| apps/password-generator | password-generator | Pages 纯静态 | pd.xiaowuleyi.com | apps/password-generator | 无 |
| apps/open-genome-report | open-genome-report | Pages 纯静态 | dna.xiaowuleyi.com | apps/open-genome-report/site | 无（数据管线见第五节） |
| apps/fitlab-videos | fitlab-videos | Pages + Functions + R2 | fit.xiaowuleyi.com | apps/fitlab-videos | 无 |

## 二、在 Cloudflare 重新绑定仓库（Dashboard Git 集成，推荐）

目标：让每个 Cloudflare 项目直接连接本 monorepo，以后 `git push` 自动部署，不再依赖本地 wrangler。

**项目已经存在、且原来连接着旧仓库（password-generator 属于这种）：**

1. Cloudflare Dashboard → Workers & Pages → 点开该项目
2. Settings → Builds & deployments → 找到 Git integration，点 Disconnect 断开旧仓库
3. 同一位置点 Connect to Git，重新选择 `lovexw/xiaowu-homepage` 仓库
4. 按下表填写构建设置，保存后触发一次部署
5. 项目的自定义域名和 R2 绑定都保留，全程不需要动域名

**项目已存在、但没有连接仓库（Git Provider 显示 No，其余四个 Pages 属于这种）：**

1. 进入项目 → Settings → Builds & deployments → Connect to Git
2. 选择 `lovexw/xiaowu-homepage`，按下表填写后保存

**全新项目（以后新增工具时）：**

Workers & Pages → Create → Pages → Connect to Git → 选本仓库，按下表填写。

各项目构建设置填写：

| 项目 | Root directory | Build command | Build output directory |
|---|---|---|---|
| brand-kit | `apps/brand-kit` | 留空 | 留空 |
| subtitle-collage | `apps/subtitle-collage` | 留空 | 留空 |
| password-generator | `apps/password-generator` | 留空 | 留空 |
| fitlab-videos | `apps/fitlab-videos` | 留空 | 留空 |
| open-genome-report | `apps/open-genome-report` | 留空 | `site` |

说明：Root directory 告诉 Pages 只关注哪个子目录；纯静态项目没有构建步骤，Build command 留空；output 留空表示 Root directory 本身就是站点；open-genome-report 的站点产物在 `site/`，所以 output 填 `site`。fitlab-videos 的 `functions/` 目录位于 Root directory 之下，Pages 会自动识别并部署，无需额外配置。

**xw-music 是 Worker，不走 Pages。** 两种方式任选：

- 继续手动部署：在 `apps/xw-music` 目录执行 `npm install` 后 `wrangler deploy`
- 开启 Workers Builds 自动部署：Dashboard → Workers → xw-music → Settings → Builds → Connect Git，选择本仓库，设置 Root path 为 `apps/xw-music`，安装命令 `npm install`，部署命令 `npx wrangler deploy`

## 三、绑定 / 切换二级域名（零停机）

全新项目绑定域名：项目 → Custom domains → Add a domain → 填入如 `brand.xiaowuleyi.com`，Cloudflare 自动配置 DNS 和证书，按提示继续即可。

把域名从旧项目切到新项目（适用于以后重建项目的场景）：

1. 先让新项目部署完成，打开它的 `*.pages.dev` 地址验证功能正常
2. 旧项目 → Custom domains → 找到该域名 → Remove
3. 立刻在新项目 → Custom domains → Add a domain，填入同一个域名
4. 因为新旧项目内容一致，DNS 切换的几十秒内访问无感知，不需要改域名注册商的 NS

## 四、用 Wrangler 手动部署（当前使用的方式）

在仓库根目录执行：

```bash
# 纯静态 Pages 项目（brand-kit / subtitle-collage / password-generator / fitlab-videos）
wrangler pages deploy apps/<目录名> --project-name=<项目名> --branch main --commit-dirty=true

# open-genome-report，只部署 site 子目录
wrangler pages deploy apps/open-genome-report/site --project-name=open-genome-report --branch main --commit-dirty=true

# xw-music，Worker 项目，先装依赖
cd apps/xw-music
npm install
wrangler deploy
```

`--commit-dirty=true` 让 wrangler 在工作区有未跟踪文件（如 node_modules）时也能部署，不影响内容。Pages 上传时会按文件哈希去重，内容没变的文件不会重复上传。

## 五、特殊项目说明

**open-genome-report 的数据管线**

站点是纯静态，但 `site/data/` 下的报告数据由 Python 管线生成，需要本机的原始基因芯片文件，Cloudflare 不执行这一步：

```bash
cd apps/open-genome-report
make reports      # 改了解读面板后重新生成报告 JSON
make all          # 完整重建报告与全基因组导出
cd site && python3 -m http.server 8080   # 本地预览
```

生成产物提交进 Git，再按第四节部署 `site/`。

**R2 存储桶绑定**

xw-music 绑定 R2 桶 `xw-music`（代码里变量名 `BUCKET`），fitlab-videos 绑定 R2 桶 `fitlab-videos`（变量名 `VIDEO_BUCKET`，由 `functions/media/[[path]].js` 读取）。桶已经存在，只要不删除重建项目，绑定一直有效。若以后新建项目，在 Settings → Bindings → R2 bucket 手动添加，变量名和桶名必须与上面一致。

## 六、旧仓库还在更新时，如何同步代码

旧仓库目前全部保留、有的还在使用。并入本仓库时用的是 git subtree（没有 squash，完整历史都在），同步命令如下。

从旧仓库拉取最新代码进本仓库（推荐的权威方向，旧仓库为源头）：

```bash
git subtree pull --prefix=apps/<目录名> https://github.com/lovexw/<旧仓库名>.git main
```

具体六个：

```bash
git subtree pull --prefix=apps/brand-kit          https://github.com/lovexw/xiaowu-brand-kit.git main
git subtree pull --prefix=apps/xw-music           https://github.com/lovexw/xw-music.git main
git subtree pull --prefix=apps/subtitle-collage   https://github.com/lovexw/subtitle-collage.git main
git subtree pull --prefix=apps/password-generator https://github.com/lovexw/password-generator.git main
git subtree pull --prefix=apps/open-genome-report https://github.com/lovexw/open-genome-report.git main
git subtree pull --prefix=apps/fitlab-videos      https://github.com/lovexw/fitlab-videos.git main
```

拉取后按第四节重新部署，再 `git push`。

反向操作，把本仓库 apps 目录里的改动推回旧仓库：

```bash
git subtree push --prefix=apps/<目录名> https://github.com/lovexw/<旧仓库名>.git main
```

双向都改容易冲突。建议约定旧仓库为权威源头，本仓库只通过 pull 接收更新；等正式把 Git 集成切到本仓库后，再反过来以本仓库为权威、归档旧仓库。

## 七、以后新增一个小工具的标准动作

1. 仓库里建 `apps/<工具名>/`（若代码已有独立仓库，用 `git subtree add --prefix=apps/<工具名> <仓库地址> main` 并入，历史自动保留）
2. Cloudflare 新建 Pages 项目并连接本仓库，Root directory 设为 `apps/<工具名>`，纯静态则构建命令留空
3. 打开 `*.pages.dev` 验证
4. Custom domains 绑定二级域名
5. 更新本文件第一节的对照表

## 八、当前状态（2026-10-08）

- 六个工具全部并入 `apps/`，各自完整 git 历史可追溯
- 六个项目均已从本仓库用 wrangler 手动部署成功，线上全部返回 200
- brand-kit 为新建项目，地址 brand-kit-1kb.pages.dev，二级域名待绑定
- xw-music 为 Worker，地址 xw-music.0471666.workers.dev，二级域名待绑定
- password-generator 的 Git 集成仍连着旧仓库，其余 Pages 项目未连接 Git 仓库
- 六个旧仓库全部保留，未归档；同步走第六节的 subtree pull

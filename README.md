# 小吴乐意的个人主页

这是一个简洁的个人主页项目，集合了我的社交媒体账号和个人项目展示。

## 功能特点

- 响应式设计，适配各种设备
- 社交媒体链接整合
- 个人项目展示
  - 小吴乐意个人微博
  - 比特币纪念站
  - 随机密码在线生成
  - 好物分享
  - 比特币30D-700D价格均线
  - FitLab 健身视频库
  - 轻图 LitePic（图片压缩）
- 比特币地址展示（带二维码）

## 技术栈

- HTML5
- CSS3
- JavaScript
- QRCode Generator

## SEO

- 完整的 title / description，Open Graph 与 Twitter Card 分享卡（图：`public/og-image.jpg`，设计源文件为根目录 `og-template.html`，可用无头 Chrome 重新渲染：`chrome --headless --screenshot=public/og-image.png --window-size=1200,630 file://$(pwd)/og-template.html`）
- `rel="canonical"` 指向 `https://www.xiaowuleyi.com/`；裸域 → www 的 301 需在 Cloudflare 控制台配置 Redirect Rule（`_redirects` 文件内有说明，Pages 的 `_redirects` 不支持带主机名的 source）
- `robots.txt` 与 `sitemap.xml`（部署后请在 Google Search Console、Bing Webmaster Tools 提交站点与 sitemap）
- schema.org `Person` + `WebSite` 结构化数据（JSON-LD）
- 所有外链统一 `rel="noopener noreferrer"`，头像声明 `width/height` 减少布局偏移（CLS）

## 本地开发

无需 npm 依赖，使用 Node.js 20+ 生成静态页面：

```sh
node scripts/build.mjs
node scripts/check.mjs
python3 -m http.server 8000 --bind 127.0.0.1
```

打开 http://127.0.0.1:8000/ 。内容在 `src/data.mjs`，模板在 `scripts/build.mjs`，样式源文件在 `css/`。`index.html` 与 `css/main.css` 是生成产物，一并提交后可直接部署到静态托管平台。

新版支持深浅主题、项目筛选、完整 BTC 地址与按需加载二维码，咖啡会员区域改为「即将开放」神秘卡片。详细结构、降级行为与验证范围见 [开发说明](LOCAL-DEVELOPMENT.md)。
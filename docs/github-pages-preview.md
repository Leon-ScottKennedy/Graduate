# GitHub Pages 前端展示版

访问地址：https://leon-scottkennedy.github.io/Graduate/

- Pages 来源：`gh-pages` 分支的根目录。
- 仅发布 `dist` 内的静态构建文件，不包含后端、数据库、`.env` 或密钥。
- 现有首页效果、亮暗主题、配置生成、硬件对比、拖动替换等前端交互保留。
- 子页面使用哈希路由，例如 `/Graduate/#/smart-build`，可以直接分享和刷新。
- 在线AI、数据库更新和商品采集暂不连接。展示版使用本地型号和参考价，不代表实时售价。
- 发布未覆盖 `main`；工作区里的源码和后端修改仍保留在本机。

重新构建展示文件：

```powershell
npm.cmd run build:pages
```

发布只应使用该命令产生的 `dist` 内容；普通 `npm run build` 是根路径应用，不适合直接覆盖这个项目型 Pages 地址。

本地开发仍使用原来的前端/后端启动方式。未来部署后端时，再准备独立的完整线上配置，不要把密钥放到前端或 Pages 分支。

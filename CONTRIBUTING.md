# 贡献指南

## 开发模式

本项目使用原生 HTML/CSS/JavaScript，并通过 Tauri 2 打包 Windows 桌面应用。无需引入前端框架。

```bash
npm install
npm run check
npm run tauri dev
```

## 提交前检查

- 不提交 API Key、token、个人数据或 localStorage 导出文件；
- 运行 `npm run check`；
- 修改 UI 时优先使用 `assets/css/style.css` 的设计令牌；
- 修改数据字段时同步更新 `docs/DATA-SCHEMA.md`。

Windows 安装包由 GitHub Actions 编译，普通贡献者不需要在本地安装 Rust 或 Visual Studio。

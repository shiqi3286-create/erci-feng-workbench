# 晴笺 · AI 小说创作台

> 面向 **10 万 ~ 100 万字长篇** 的本地 AI 小说写作工具 · UI 骨架版（v0.1.0）
> 界面风格：**猫与晴天 · 二次元清新风**（暖奶油 / 暖杏阳光 / 马卡龙点缀）

本地优先：全书文稿默认存储在用户本机，AI 请求只发送**手动选中**的文本与设定卡片，不自动上传全文。

---

## 快速开始

本项目为纯前端静态工程，无需安装依赖，直接用浏览器打开即可预览：

```bash
# 方式一：直接双击
index.html

# 方式二：本地静态服务（推荐，后续会用到 fetch 数据）
cd novel-studio
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000
```

> 提示：字体通过 CDN 加载（`miaoda.feishu.cn` 自托管镜像），断网时自动回退到系统圆体，不影响使用。

## 页面清单

| 文件 | 页面 | 作用 |
|---|---|---|
| `index.html` | 作品库首页 | 多作品管理、字数统计、继续写作入口 |
| `workspace.html` | **AI 创作台（核心）** | 左栏资源树 / 中栏 AI 轨迹+正文+指令 / 右栏上下文面板 |
| `outline.html` | 大纲管理 | 分卷 → 章节大纲卡片 → 卡片详情 |
| `world.html` | 设定库 | 人物 / 地点 / 物品 / 伏笔 / 时间线 |
| `template.html` | 模板 · API | 提示词模板编辑、API 渠道管理 |

## 目录结构

```
novel-studio/
├── index.html                 # 作品库首页
├── workspace.html             # AI 创作台（核心工作界面）
├── outline.html               # 大纲与分卷管理
├── world.html                 # 设定库
├── template.html              # 模板与 API 设置
├── assets/
│   ├── css/style.css          # ★ 全局样式：设计令牌 + 组件库（风格锁定核心）
│   ├── js/
│   │   ├── data.js            # 示例数据层（UI 阶段固化，后续迁移为本地文件）
│   │   ├── common.js          # 公共组件：图标 / Toast / 顶栏 / 工具函数
│   │   ├── index.js           # 作品库逻辑
│   │   ├── workspace.js       # 创作台逻辑
│   │   ├── outline.js         # 大纲逻辑
│   │   ├── world.js           # 设定库逻辑
│   │   └── template.js        # 模板·API 逻辑
│   └── img/                   # 封面插画（二次元清新风，已压缩）
├── docs/
│   ├── DEVELOPMENT.md         # 开发文档：架构、数据流、工作流、迭代路线
│   └── DATA-SCHEMA.md         # 数据模型规范（未来本地存储结构）
└── README.md
```

## UI 风格锁定（改风格前必读）

风格定义全部收敛在 `assets/css/style.css` 顶部的 **设计令牌（`:root`）**，改一处即全局生效：

| 令牌 | 值 | 用途 |
|---|---|---|
| `--cream / --cream-deep` | `#FAF4EA / #F3E9DA` | 页面底色（暖奶油渐变） |
| `--paper` | `#FFFDF8` | 卡片纸白 |
| `--ink / --muted` | `#4B3F35 / #9A8B7C` | 正文 / 次要文字（不用纯黑） |
| `--sun` | `#E89B54` | 主强调：暖杏阳光 |
| `--peach / --sky / --lilac / --mint / --coral` | 马卡龙辅助色 | 标签 / 状态 / 点缀 |
| `--r-lg / --r-md / --r-sm` | 22 / 14 / 9px | 大圆角体系 |
| `--shadow-card` | 暖色系阴影 | 低对比、不发灰 |

**铁律**：不引入纯黑、不高饱和撞色、不加发光霓虹；动画克制，服务于"写作时不被打扰"。

## 当前状态

- ✅ 五个页面的完整 UI 与页面间跳转
- ✅ 作品库：新建/删除作品、统计与 localStorage 持久化
- ✅ 创作台：章节切换、正文 contenteditable 编辑、段落选择、AI 标记确认、手动/自动保存
- ✅ AI 客户端：OpenAI 兼容接口、流式输出、多渠道失败切换、无 Key 演示降级
- ✅ 大纲：新建分卷、AI 生成大纲、生成正文、扩写卡片、剧情分支
- ✅ 设定库：人物/地点/物品/伏笔新建，人物编辑删除，AI 设定生成与写作区引用
- ✅ 模板·API：模板保存/新建/删除，API 渠道增删改/启停/设默认/发送测试
- ✅ 视觉资源：二次元清新风封面与人物头像已生成并接入
- ⚠️ 纯前端阶段使用浏览器 `localStorage` 持久化；尚未落盘为磁盘目录文件
- ⚠️ 真实 API 需要用户在「模板·API」页面填写自己的兼容接口与 Key；未配置时自动使用离线演示模式

## 配置真实 API

打开「模板·API」页面，添加或编辑渠道，填写：

- 接口地址：OpenAI 兼容的 `/v1` 地址（客户端会请求 `/chat/completions`）
- 模型名称：如 `deepseek-v3`
- API Key：用户自己的密钥，仅保存在本地浏览器存储
- 启用渠道并设为默认

真实请求仅在用户主动点击生成、测试或校验时发送；正文不会自动上传全文。主渠道失败时会按可用渠道顺序自动切换，所有渠道不可用则回退为演示输出。

## Windows 打包

项目已经加入 Tauri 2 桌面工程和 GitHub Actions 云端构建：

- Tauri 配置：`src-tauri/tauri.conf.json`
- Rust 存储命令：`src-tauri/src/storage.rs`
- Windows 构建：`.github/workflows/build-windows.yml`
- Tag 发布：`.github/workflows/release.yml`
- GitHub 仓库：[shiqi3286-create/erci-feng-workbench](https://github.com/shiqi3286-create/erci-feng-workbench)

本项目约定**不要求本地安装 Rust、Visual Studio 或 Tauri 工具链**。推送到 GitHub 后，Actions 会在 `windows-latest` 中自动安装 Node/Rust 并生成 `.exe` / `.msi`。普通提交只需维护前端源码、Rust 源码和配置文件。

本地浏览器预览仍可使用静态服务；桌面模式下，`APP.store` 提供 Tauri command 入口，后续章节保存和项目数据会写入应用数据目录。


## 给 AI 的填充约定

后续由 AI 在框架内填充功能时：
1. **先读 `docs/DEVELOPMENT.md` 与 `docs/DATA-SCHEMA.md`**，数据模型以规范为准；
2. **风格只改令牌**，不另起视觉体系；
3. 页面级功能在各页面对应的 `assets/js/*.js` 中实现，公共能力放 `common.js`；
4. 正文一律用原生 JS + 字符串模板渲染，不引入框架。

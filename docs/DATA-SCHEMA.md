# 数据模型规范 · 晴笺 AI 小说创作台

> 面向百万字长篇的本地存储结构。原则：**分文件存储、一章一正文、设定独立 JSON、元数据与正文分离**。
> UI 骨架阶段的示例数据在 `assets/js/data.js`，字段与本规范保持一致，后续迁移为本地文件时按本规范落盘。

## 1. 磁盘目录结构

```
novel-studio/
└── data/
    └── <projectId>/                # 一个项目一个文件夹
        ├── project.json            # 项目配置（见 §2）
        ├── setting/
        │   ├── characters.json     # 人物设定
        │   ├── locations.json      # 地点档案
        │   ├── items.json          # 物品 / 功法
        │   ├── foreshadows.json    # 伏笔库
        │   └── timeline.json       # 故事时间线
        ├── outline/
        │   ├── vol1.json           # 第一卷大纲（章节卡片）
        │   └── vol2.json
        ├── chapters/
        │   ├── vol1/
        │   │   ├── ch01.md         # 第 1 章正文（唯一正文文件）
        │   │   ├── ch01.json       # 第 1 章元数据（字数/伏笔/快照指针）
        │   │   └── ch01.snap/      # 版本快照目录
        │   └── vol2/
        ├── ai/
        │   ├── templates.json      # 提示词模板
        │   ├── apis.json           # API 渠道配置（密钥本地保存）
        │   └── calls.log.jsonl     # AI 调用记录（token 统计）
        └── index.json              # 项目内全文索引（关键词→章节定位，可重建）
```

## 2. project.json

```jsonc
{
  "id": "p-starlight",
  "title": "星落之森",
  "genre": "奇幻 · 治愈",
  "intro": "一句话简介",
  "targetWords": 1000000,
  "createdAt": "2026-01-01T00:00:00+08:00",
  "updatedAt": "2026-09-13T15:42:00+08:00",
  "novelStyle": "细腻治愈 · 慢热叙事",
  "defaultModel": "deepseek-v3",
  "settings": {
    "autoSaveSec": 60,
    "contextTokenLimit": 16000,
    "aiAutoSend": false
  },
  "stat": { "words": 428600, "chapters": 86, "volumes": 4 }
}
```

## 3. setting/characters.json（人物）

```jsonc
{
  "id": "c-lin",
  "name": "凛",
  "role": "女主角 · 失忆的星之子",
  "avatar": "assets/avatars/lin.png",        // 本地头像路径
  "brief": "在灰烬之城雨夜醒来的少女…",
  "traits": ["安静", "倔强"],
  "speech": "「我不记得了。但我想记得。」",   // 习惯台词
  "relations": [                              // 关系（可生成关系图）
    { "with": "c-lu", "label": "互为救赎" },
    { "with": "c-aq", "label": "被守护" }
  ],
  "meta": { "age": "外表18岁", "race": "星之子（疑似）", "power": "星辉之力" },
  "level": "core",                            // core 核心设定 / minor 次要设定（控制 prompt 加载优先级）
  "summary": "…简短摘要（≤200字，专供 AI prompt 使用）",  // 与 brief 分离：brief 给人看，summary 给模型看
  "confirmed": true,                          // AI 提取的新角色须人工确认后置 true
  "firstSeen": { "chapter": "ch-001", "vol": "v1" }
}
```

> 核心设计：`brief`（完整人设，本地查阅）与 `summary`（精简摘要，投喂 AI）分离，控制 token 占用。

## 4. setting/foreshadows.json（伏笔）

```jsonc
{
  "id": "f4",
  "text": "森林会吞噬记忆，但凛的记忆回廊完好",
  "plantedAt": { "vol": "v2", "chapter": "ch-012" },   // 埋设位置
  "status": "open",                                     // open 未回收 / closed 已回收
  "note": "暗示凛与森林同源",
  "relatedChapters": ["ch-012", "ch-017"],              // 关联章节（回收时引用）
  "keywords": ["记忆", "回廊"]                          // 供语义检索
}
```

## 5. outline/volN.json（分卷大纲）

```jsonc
{
  "id": "v2",
  "title": "第二卷 · 星落之森",
  "chapters": 28,
  "beats": [
    {
      "id": "b2-4",
      "no": 17,                                        // 章序号（可含前缀）
      "title": "灯火熄灭之后",
      "goal": "铺垫『星之子』身份揭露；星辉第一次主动回应",
      "keyEvents": ["森林核心灯火无风自灭", "…"],
      "chars": ["c-lin", "c-lu"],
      "fsPlanted": ["星之子"],                          // 本章埋设伏笔（引用伏笔库关键词）
      "ending": "凛望向森林深处：『如果我是星之子，那我为什么要忘记？』",
      "status": "writing",                              // todo / writing / done
      "bindChapter": "chapters/vol2/ch017.md",          // 绑定正文（双向跳转）
      "aiSummary": "…章节摘要（用于组装 prompt 与全卷总结）"
    }
  ]
}
```

## 6. chapters/vol2/ch017.json（章节元数据，正文在 ch017.md）

```jsonc
{
  "id": "ch-017",
  "vol": "v2",
  "no": 17,
  "title": "灯火熄灭之后",
  "beatId": "b2-4",
  "words": 5230,
  "modifiedCount": 3,
  "updatedAt": "2026-09-13T15:47:00+08:00",
  "aiGenerated": { "chars": 2140, "model": "deepseek-v3" },
  "fsRefs": ["f4"],                                     // 本章相关伏笔
  "newChars": ["c-old"],                                // 本章新出场人物（待确认）
  "snapshots": ["ch017.snap/20260913-1547.json"],       // 快照指针（可回退）
  "summary": "…本章摘要（自动生成，用于上下文组装）"
}
```

## 7. ai/templates.json（提示词模板）

```jsonc
{
  "id": "tp1",
  "group": "创作生成",
  "name": "续写正文",
  "icon": "pen",
  "desc": "按当前大纲与上文风格续写",
  "prompt": "你是一位资深小说家。请根据以下内容生成：\n…\n{{本章大纲}}\n{{上文}}",
  "vars": ["{{本章大纲}}", "{{上文}}"],                  // 发送前替换
  "params": { "model": "", "temperature": 0.8, "maxTokens": 2000 },
  "updatedAt": "2026-09-01T10:00:00+08:00"
}
```

## 8. ai/apis.json（API 渠道，密钥仅本地保存）

```jsonc
{
  "channels": [
    {
      "id": "a1",
      "name": "主力中转",
      "base": "https://api.example.com/v1",   // OpenAI 兼容端点
      "model": "deepseek-v3",
      "apiKey": "sk-…",                        // 明文存本地（用户自有密钥，不上传）
      "enabled": true,
      "fallback": ["a2"],                      // 失败切换顺序
      "params": { "temperature": 0.8 }
    }
  ],
  "usage": { "a1": { "tokens": 1284000, "cost": 38.60 } }  // 本地 token / 费用统计
}
```

## 9. 上下文组装规范（AI 请求）

每次 AI 请求按以下优先级组装 prompt，**禁止全量加载全书**：

| 层级 | 内容 | 默认预算 |
|---|---|---|
| 全局常驻 | 世界观摘要 + 全部 core 人物 summary | ≤ 1k tokens |
| 检索注入 | 语义检索到的相关伏笔 / 时间线 / 设定 | ≤ 600 tokens |
| 近期上下文 | 上一章 summary + 本章已生成正文（截断） | ≤ 3k tokens |
| 临时素材 | 当前章节大纲卡片 + 用户选中文本 + 模板 | 按需 |

超限策略：先截断最旧正文 → 再合并次要设定 → 仍超限则明确报错并提示缩小范围，不静默丢弃关键设定。

## 10. 迁移约定

- UI 阶段：`assets/js/data.js` 提供首屏种子，`assets/js/store.js` 通过 `localStorage` 保存完整快照，字段与上述 schema 对齐；
- 当前存储键：`novel-studio:data:v1`；项目级数据（分卷/人物/地点/物品/伏笔/时间线）按项目存放在 `DATA.projectData[projectId]`，`APP.store.useProject(pid)` 将当前项目的集合物化到顶层供页面读写，序列化时剔除顶层副本避免双份数据；
- 桌面模式（Tauri）下 `save()` 防抖调用 `save_store` 命令把同一快照双写磁盘 `store.json`；本地缓存为空时 `init()` 通过 `load_store` 自动恢复，`onReady(cb)` 供页面在恢复后重渲染；
- 业务代码统一调用 `APP.store`，不直接依赖 localStorage；
- 正式磁盘阶段：按本规范建立 `data/<projectId>/` 下的 JSON / MD 文件，一章一个正文文件；
- 索引（index.json）可随时重建，不作为唯一数据源。

/* ============================================================
 * 晴笺 · AI 小说创作台 — 示例数据层
 * 说明：UI 骨架阶段所有数据固化在 JS 中（file:// 协议下无法 fetch JSON）。
 * 正式开发阶段：数据应改为本地文件读写（见 docs/DATA-SCHEMA.md），
 * 本项目目录结构即未来磁盘存储结构的映射。
 * ============================================================ */

window.DATA = {

  /* ---------- 用户与偏好 ---------- */
  user: {
    name: "阿晴",
    theme: "sunny",            // sunny 奶油浅色 / night 暗色（预留）
    defaultModel: "deepseek-v3",
    autoSave: 60,              // 秒
    novelStyle: "细腻治愈 · 慢热叙事"
  },

  /* ---------- 项目列表 ---------- */
  projects: [
    {
      id: "p-starlight",
      title: "星落之森",
      genre: "奇幻 · 治愈",
      cover: "assets/img/cover-forest.jpg",
      words: 428600,
      chapters: 86,
      volumes: 4,
      status: "连载中",
      progress: 0.42,
      updated: "今天 15:42",
      targetWords: 1000000
    },
    {
      id: "p-window",
      title: "晴天与猫",
      genre: "日常 · 青春",
      cover: "assets/img/cover-window.jpg",
      words: 186200,
      chapters: 34,
      volumes: 2,
      status: "连载中",
      progress: 0.31,
      updated: "昨天 22:10",
      targetWords: 600000
    },
    {
      id: "p-sunset",
      title: "黄昏信号",
      genre: "都市 · 情感",
      cover: "assets/img/cover-sunset.jpg",
      words: 0,
      chapters: 0,
      volumes: 0,
      status: "草稿",
      progress: 0,
      updated: "9月10日",
      targetWords: 800000
    }
  ],

  /* ---------- 当前项目（主界面默认打开《星落之森》） ---------- */
  current: {
    projectId: "p-starlight",
    volumeId: "v2",
    chapterId: "b2-4",
    chapterTitle: "第17章 · 灯火熄灭之后",
    chapterWords: 5230,
    chapterOrder: 17
  },

  /* ---------- AI 调用记录（追加式日志） ---------- */
  aiCalls: [],

  /* ---------- 默认 API 渠道 id ---------- */
  defaultApi: "a1",

  /* ---------- 分卷与大纲 ---------- */
  volumes: [
    {
      id: "v1", title: "第一卷 · 灰烬之城", chapters: 22, done: 22,
      beats: [
        { id: "b1-1", no: "01", title: "雨夜苏醒", sum: "失忆少女凛在废墟城市醒来，体内残留未知的星辉力量，被巡夜人陆沉发现。", chars: ["凛", "陆沉"], fs: ["星辉之力"], status: "done", paras: [] },
        { id: "b1-2", no: "04", title: "灰烬教会", sum: "凛初入教会，得知星辉之力与『深渊裂隙』有关，埋下身世伏笔。", chars: ["凛", "陆沉", "阿澈"], fs: ["深渊裂隙"], status: "done", paras: [] },
        { id: "b1-3", no: "09", title: "第一次坠落", sum: "凛失控坠入裂隙边缘，被陆沉拼死救回，两人关系破冰。", chars: ["凛", "陆沉"], fs: ["失控", "约定"], status: "done", paras: [] },
        { id: "b1-4", no: "16", title: "离城的信", sum: "阿澈留下信离开，真相的一角开始松动。", chars: ["凛", "阿澈"], fs: ["阿澈的过去"], status: "done", paras: [] }
      ]
    },
    {
      id: "v2", title: "第二卷 · 星落之森", chapters: 28, done: 14,
      beats: [
        { id: "b2-1", no: "01", title: "入林", sum: "凛与陆沉进入星落之森寻找星辉本源，森林会吞噬记忆。", chars: ["凛", "陆沉"], fs: ["记忆吞噬"], status: "done", paras: [] },
        { id: "b2-2", no: "06", title: "守林人", sum: "遇到守林人阿澈的师父，得知森林中心封印着一颗『坠落的星』。", chars: ["凛", "陆沉", "老师傅"], fs: ["坠落的星"], status: "done", paras: [] },
        { id: "b2-3", no: "12", title: "记忆回廊", sum: "凛在回廊中看到零碎记忆：自己似乎来自百年前。", chars: ["凛"], fs: ["百年之谜"], status: "done", paras: [] },
        { id: "b2-4", no: "17", title: "灯火熄灭之后", sum: "森林核心的灯火熄灭，凛的星辉第一次主动回应她。本章：铺垫『星之子』身份揭露。", chars: ["凛", "陆沉", "守林人"], fs: ["星之子", "灯火"], status: "writing", paras: [
          { cls: "", text: "星落之森的夜，比灰烬之城来得更早。当最后一线天光从树冠间收走，整座森林便沉入一种近乎凝固的深蓝里。只有那些悬在枝桠间的萤火，像碎掉的信纸一样，一片一片亮起来。" },
          { cls: "", text: "守林人提着灯走在前面，脚步很轻。凛跟在陆沉身边，听见自己的呼吸在安静的林间被放得很大。他们走了很久，久到她几乎以为今夜会就这样平淡地过去——直到前方那一团暖黄的光，忽然熄了。" },
          { cls: "", text: "不是被风吹灭的。那光像是被什么东西从内部抽走，先是一颤，然后整个森林核心的灯火同时暗下去，像一口气吹熄了满桌的蜡烛。黑暗兜头罩下来，只有头顶的星子还亮着。" },
          { cls: "ai-mark", text: "“守林人说过，这盏灯烧了百年，从没熄过。”陆沉的声音从黑暗里传来，比平时低了一些。凛看不清他的表情，却能感觉到他停下脚步时衣料摩擦的声响，“现在它熄了。”" },
          { cls: "ai-mark", text: "凛低下头，看见自己的掌心不知什么时候泛起一点微光，细碎的，像雪落在水面。那光很淡，却让周围的黑暗退开了一小步。她听见守林人沙哑的声音在更深处响起：“星之子……是星之子回来了。”" },
          { cls: "", text: "“什么星之子。”凛下意识说，“我只是——不记得自己是谁。”她攥紧手掌，那点光便熄了，森林重新被黑暗吞没。可她知道刚才那一刻是真的，星辉第一次没有失控，而是温顺地、像在回应什么。" },
          { cls: "", text: "陆沉没有追问。他只是把腰间的燃灯摘下来，用拇指拨亮，递到凛面前。“拿好。夜里看不清路的人，最容易走丢。”灯火映着他的脸，凛忽然想起阿澈说过的话：巡夜人从不把灯给别人。" },
          { cls: "", text: "她接过灯，指尖碰到陆沉的手。凉的。森林深处传来一声极轻的叹息，像有什么东西在百年的沉睡里翻了个身。守林人站在熄灭的灯火前，终于说：“你想知道你是谁吗？那就跟我来。森林记得一切。”" }
        ] },
        { id: "b2-5", no: "20", title: "银月之井", sum: "在井中见到星的倒影，获得关键道具『碎星盏』。", chars: ["凛", "陆沉"], fs: ["碎星盏"], status: "todo", paras: [] },
        { id: "b2-6", no: "24", title: "守林人的选择", sum: "老师傅牺牲自己修复封印，临别揭示凛的身世真相。", chars: ["凛", "老师傅"], fs: ["身世"], status: "todo", paras: [] }
      ]
    },
    {
      id: "v3", title: "第三卷 · 百年前的雪", chapters: 0, done: 0,
      beats: [
        { id: "b3-1", no: "01", title: "（待规划）", sum: "本卷大纲未生成，可用 AI 大纲助手按梗概生成。", chars: [], fs: [], status: "todo", paras: [] }
      ]
    }
  ],

  /* ---------- 当前章节大纲（右侧上下文） ---------- */
  chapterBeat: {
    title: "灯火熄灭之后",
    goal: "铺垫『星之子』身份揭露；凛的星辉第一次主动回应",
    keyEvents: [
      "森林核心灯火无风自灭",
      "守林人说出『星之子』传闻",
      "凛手掌泛起星光，第一次自主回应"
    ],
    chars: ["凛", "陆沉", "守林人"],
    fsPlanted: ["星之子", "灯火之约"],
    ending: "凛望向森林深处，说出：『如果我是星之子，那我为什么要忘记？』"
  },

  /* ---------- 人物设定 ---------- */
  characters: [
    {
      id: "c-lin", name: "凛", role: "女主角 · 失忆的星之子",
      avatar: "assets/img/avatar-lin.png",
      color: "linear-gradient(135deg,#9FC4DE,#B9A7E0)",
      tag: "sun",
      brief: "在灰烬之城雨夜醒来的少女，失去全部记忆，体内残留星辉之力。性格安静、倔强、害怕被抛下。",
      traits: ["安静", "倔强", "害怕被抛下"],
      speech: "「我不记得了。但我想记得。」",
      relation: "陆沉：互为救赎；阿澈：被守护的人",
      meta: { age: "外表18岁", race: "星之子（疑似）", power: "星辉之力（失控中）" }
    },
    {
      id: "c-lu", name: "陆沉", role: "男主角 · 巡夜人",
      avatar: "assets/img/avatar-lu.png",
      color: "linear-gradient(135deg,#F2B8A8,#E89B54)",
      tag: "peach",
      brief: "灰烬之城的巡夜人，负责处理深渊裂隙异变。表面冷淡毒舌，实际极度护短，背负着上一任守夜人的约定。",
      traits: ["冷淡", "毒舌", "护短"],
      speech: "「别死。死了我不好交代。」",
      relation: "凛：守护对象；老师傅：旧识",
      meta: { age: "24", race: "人类", power: "巡夜术·燃灯" }
    },
    {
      id: "c-aq", name: "阿澈", role: "男配 · 消失的守林人学徒",
      avatar: "assets/img/avatar-aq.png",
      color: "linear-gradient(135deg,#B9A7E0,#8FBF9F)",
      tag: "lilac",
      brief: "第一卷中帮助凛逃离教会的少年，留下一封信后离开。真实身份与星落之森守林人一脉有关。",
      traits: ["温柔", "决绝", "背负秘密"],
      speech: "「等我找到答案，就回来告诉你。」",
      relation: "凛：青梅竹马般的守护者；老师傅：师父",
      meta: { age: "20", race: "半星族", power: "未明" }
    },
    {
      id: "c-old", name: "守林人老师傅", role: "配角 · 星落之森看守",
      avatar: "assets/img/avatar-old.png",
      color: "linear-gradient(135deg,#8FBF9F,#9FC4DE)",
      tag: "mint",
      brief: "在星落之森看守『坠落的星』百年，知道凛身世的关键人物。",
      traits: ["慈祥", "固执", "愧疚"],
      speech: "「森林记得一切，只是人不愿意想起。」",
      relation: "凛：身世知情者；阿澈：师父",
      meta: { age: "百岁以上", race: "星族遗民", power: "封印术" }
    }
  ],

  /* ---------- 伏笔库 ---------- */
  foreshadows: [
    { id: "f1", text: "凛的手腕内侧有一道月牙形旧疤", where: "第1章 · 雨夜苏醒", status: "open", note: "预计在第三卷揭示：来自百年前封印仪式" },
    { id: "f2", text: "陆沉腰间挂着一枚熄灭的灯芯", where: "第4章 · 灰烬教会", status: "open", note: "属于上一任守夜人" },
    { id: "f3", text: "阿澈留下的信末尾画着星落之森的星图", where: "第16章 · 离城的信", status: "open", note: "第二卷呼应" },
    { id: "f4", text: "森林会吞噬记忆，但凛的记忆回廊完好", where: "第12章 · 记忆回廊", status: "open", note: "暗示凛与森林同源" },
    { id: "f5", text: "『坠落的星』封存在森林核心", where: "第6章 · 守林人", status: "open", note: "核心主线" },
    { id: "f6", text: "灰烬教会声称凛是『灾厄』", where: "第9章 · 第一次坠落", status: "open", note: "与『星之子』传闻冲突，伏笔回收点" }
  ],

  /* ---------- 位置 / 物品（简版） ---------- */
  locations: [
    { id: "l1", name: "灰烬之城", type: "城市", desc: "第一、二卷主舞台，被深渊裂隙环绕的边境城市。", tags: ["主舞台"] },
    { id: "l2", name: "星落之森", type: "秘境", desc: "森林核心封印着坠落的星，会吞噬闯入者的记忆。", tags: ["第二卷", "主线"] },
    { id: "l3", name: "银月之井", type: "地标", desc: "森林深处的古井，能映出『真实的倒影』，藏有碎星盏。", tags: ["第二卷"] }
  ],
  items: [
    { id: "i1", name: "碎星盏", type: "神器", desc: "可短暂稳定星辉之力，是森林核心封印的钥匙之一。", owner: "凛" },
    { id: "i2", name: "燃灯", type: "法器", desc: "巡夜人的标志法器，以记忆为燃料驱散裂隙阴影。", owner: "陆沉" }
  ],

  /* ---------- AI 调用轨迹（示例） ---------- */
  trace: [
    { id: "t1", label: "读取设定", detail: "已加载 4 位人物 · 世界观摘要", status: "done", time: "15:42:11" },
    { id: "t2", label: "检索伏笔", detail: "命中 2 条相关伏笔：星之子 / 灯火之约", status: "done", time: "15:42:12" },
    { id: "t3", label: "组装上下文", detail: "本章大纲 + 上章摘要 + 精简设定 · 约 3.8k tokens", status: "done", time: "15:42:13" },
    { id: "t4", label: "生成初稿", detail: "deepseek-v3 · 输出 2,140 字", status: "running", time: "15:42:15" },
    { id: "t5", label: "一致性校验", detail: "待生成后自动执行", status: "todo", time: "—" }
  ],

  /* ---------- 上下文预算 ---------- */
  contextBudget: {
    used: 3860, limit: 16000, percent: 24,
    parts: [
      { name: "全局精简设定", tokens: 820 },
      { name: "本章大纲卡片", tokens: 340 },
      { name: "上一章摘要", tokens: 640 },
      { name: "检索到的伏笔", tokens: 260 },
      { name: "已生成正文(部分)", tokens: 1800 }
    ]
  },

  /* ---------- 修改建议（示例） ---------- */
  suggestions: [
    { type: "一致性", text: "本章凛称守林人为『老伯』，但第6章两人已互报姓名，建议改为『老师傅』。" },
    { type: "节奏", text: "灯火熄灭场景已连续 3 段外部描写，建议插入一句凛的内心独白，避免信息密度断层。" },
    { type: "伏笔", text: "检测到『星之子』相关伏笔 f4 可在本段自然呼应，建议在星光回应时点一句" }
  ],

  /* ---------- 提示词模板 ---------- */
  templates: [
    {
      group: "创作生成",
      items: [
        { id: "tp1", name: "续写正文", desc: "按当前大纲与上文风格续写，保持人物口吻。", icon: "pen", vars: ["{{本章大纲}}", "{{上文}}"], params: { temp: 0.8, max: 2000 } },
        { id: "tp2", name: "场景描写", desc: "生成环境氛围描写，可指定时间、天气、情绪。", icon: "sun", vars: ["{{地点}}", "{{氛围}}"], params: { temp: 0.9, max: 800 } },
        { id: "tp3", name: "对话生成", desc: "按人物设定生成角色对话，保持口头禅与性格。", icon: "chat", vars: ["{{角色A}}", "{{角色B}}", "{{情境}}"], params: { temp: 0.85, max: 1200 } }
      ]
    },
    {
      group: "精修打磨",
      items: [
        { id: "tp4", name: "润色段落", desc: "在不改变情节前提下提升文笔与节奏。", icon: "brush", vars: ["{{选中文本}}"], params: { temp: 0.6, max: 2000 } },
        { id: "tp5", name: "扩写细节", desc: "补充感官细节、动作与心理描写。", icon: "plus", vars: ["{{选中文本}}"], params: { temp: 0.8, max: 1500 } },
        { id: "tp6", name: "精简冗余", desc: "压缩啰嗦段落，保留信息量与节奏。", icon: "cut", vars: ["{{选中文本}}"], params: { temp: 0.5, max: 1500 } }
      ]
    },
    {
      group: "一致性校验",
      items: [
        { id: "tp7", name: "人设一致性", desc: "扫描本章，检查角色言行是否 OOC。", icon: "check", vars: ["{{人物设定}}", "{{本章正文}}"], params: { temp: 0.3, max: 2500 } },
        { id: "tp8", name: "伏笔扫描", desc: "提取本章新伏笔并对比伏笔库。", icon: "flag", vars: ["{{伏笔库}}", "{{本章正文}}"], params: { temp: 0.3, max: 2000 } },
        { id: "tp9", name: "名词统一", desc: "找出前后不一致的人名、地名、叫法。", icon: "search", vars: ["{{全文索引}}"], params: { temp: 0.2, max: 1500 } }
      ]
    }
  ],

  /* ---------- API 渠道 ---------- */
  apis: [
    { id: "a1", name: "主力中转", base: "https://api.example.com/v1", model: "deepseek-v3", key: "sk-••••••••4f2a", status: "on", enabled: false, temp: 0.8, used: 1284000, quota: "¥38.60" },
    { id: "a2", name: "备用渠道", base: "https://relay.example.org/v1", model: "glm-4-flash", key: "sk-••••••••9c11", status: "on", enabled: false, temp: 0.8, used: 402000, quota: "¥12.10" },
    { id: "a3", name: "未配置", base: "", model: "—", key: "", status: "off", enabled: false, temp: 0.7, used: 0, quota: "—" }
  ]
};

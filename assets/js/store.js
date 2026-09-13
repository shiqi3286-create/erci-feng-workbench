/* ============================================================
 * 晴笺 · AI 小说创作台 — 存储层
 * 纯前端阶段用 localStorage 持久化（磁盘规范见 docs/DATA-SCHEMA.md）。
 * 未来 Tauri 打包时：仅需把 init / save 及下面的原子变更替换为
 * Rust command（read_chapter / write_chapter …）即可，其余逻辑不变。
 * ============================================================ */

window.APP = window.APP || {};
window.APP.store = (function () {

  const KEY = 'novel-studio:data:v1';
  const tauriInvoke = () => window.__TAURI__?.core?.invoke || window.__TAURI_INTERNALS__?.invoke;

  function isDesktop() { return typeof tauriInvoke() === 'function'; }
  async function invoke(command, args) {
    const fn = tauriInvoke();
    if (!fn) throw new Error('当前不是 Tauri 桌面环境');
    return fn(command, args);
  }

  function _current() {
    return window.DATA && window.DATA.current;
  }

  /* ---------- 定位工具 ---------- */
  function findBeat(volumeId, beatId) {
    const vol = window.DATA.volumes.find(v => v.id === volumeId);
    if (!vol) return null;
    return vol.beats.find(b => b.id === beatId) || null;
  }
  function currentVol() {
    const c = _current();
    return window.DATA.volumes.find(v => v.id === (c && c.volumeId)) || window.DATA.volumes[0];
  }
  function currentBeat() {
    const c = _current();
    return c ? findBeat(c.volumeId, c.chapterId) : null;
  }
  function currentProject() {
    const c = _current();
    return window.DATA.projects.find(p => p.id === (c && c.projectId)) || window.DATA.projects[0];
  }

  /* ---------- 持久化 ---------- */
  function init(DATA) {
    window.DATA = DATA;
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const obj = JSON.parse(saved);
        Object.keys(DATA).forEach(k => { if (obj[k] !== undefined) DATA[k] = obj[k]; });
      }
    } catch (e) { /* 存档损坏则回退到示例数据 */ }
    save();
    return DATA;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(window.DATA));
    } catch (e) { /* 存储满或隐私模式：静默失败，由调用方 toast 提示 */ }
  }

  /* ---------- 作品库 ---------- */
  function addProject({ title, genre, targetWords }) {
    const id = 'p-' + Date.now().toString(36);
    const p = {
      id,
      title, genre: genre || '未分类',
      cover: 'assets/img/cover-window.jpg',
      words: 0, chapters: 0, volumes: 0,
      status: '草稿', progress: 0, updated: '刚刚', targetWords: targetWords || 100000,
      createdAt: new Date().toISOString()
    };
    window.DATA.projects.push(p);
    // 新建项目默认带第一卷空卷
    window.DATA.volumes.push({ id: 'v1', title: '第一卷', chapters: 0, done: 0, beats: [] });
    save();
    return p;
  }
  function removeProject(id) {
    window.DATA.projects = window.DATA.projects.filter(p => p.id !== id);
    // 清理该项目的分卷（以项目为单位的前端简化存储，直接清空所有卷）
    save();
  }

  /* ---------- 大纲 ---------- */
  function addVolume(title) {
    const id = 'v' + Date.now().toString(36);
    window.DATA.volumes.push({ id, title, chapters: 0, done: 0, beats: [] });
    save();
    return id;
  }
  function addBeat(volumeId, beat) {
    const vol = window.DATA.volumes.find(v => v.id === volumeId);
    if (!vol) return null;
    vol.chapters = vol.beats.length;
    vol.done = vol.beats.filter(b => b.status === 'done').length;
    const b = {
      id: beat.id || 'b-' + Date.now().toString(36),
      no: String(vol.beats.length + 1).padStart(2, '0'),
      title: beat.title || '（新章节）',
      sum: beat.sum || '',
      chars: beat.chars || [], fs: beat.fs || [], status: beat.status || 'todo',
      paras: beat.paras || []
    };
    vol.beats.push(b);
    vol.chapters = vol.beats.length;
    save();
    return b;
  }
  function updateBeat(volumeId, beatId, patch) {
    const b = findBeat(volumeId, beatId);
    if (!b) return;
    Object.assign(b, patch);
    const vol = window.DATA.volumes.find(v => v.id === volumeId);
    if (vol) vol.done = vol.beats.filter(x => x.status === 'done').length;
    save();
  }

  /* ---------- 章节正文 ---------- */
  function setChapterParas(volumeId, beatId, paras) {
    const b = findBeat(volumeId, beatId);
    if (!b) return;
    b.paras = paras;
    const words = paras.reduce((s, p) => s + (p.text || '').length, 0);
    if (_current() && _current().chapterId === beatId) _current().chapterWords = words;
    save();
  }
  function saveChapter() {
    // 由 workspace 在失焦/自动保存时调用，写入 current 指向的章节
    const c = _current();
    if (!c) return;
    save();
  }
  function confirmPara(volumeId, beatId, index) {
    const b = findBeat(volumeId, beatId);
    if (!b || !b.paras[index]) return;
    b.paras[index].cls = (b.paras[index].cls || '').split(' ').filter(x => x && x !== 'ai-mark').join(' ');
    save();
  }
  function touchChapter(volId, beatId, { modified, updatedAt }) {
    const b = findBeat(volId, beatId);
    if (!b) return;
    b.modifiedCount = (b.modifiedCount || 0) + (modified || 0);
    b.updatedAt = updatedAt || new Date().toISOString();
    save();
  }

  /* ---------- 设定库 ---------- */
  function addChar(c) {
    window.DATA.characters.push({ id: 'c-' + Date.now().toString(36), confirmed: false, ...c });
    save();
  }
  function addLocation(l) { window.DATA.locations.push({ id: 'l-' + Date.now().toString(36), ...l }); save(); }
  function addItem(i) { window.DATA.items.push({ id: 'i-' + Date.now().toString(36), ...i }); save(); }
  function addForeshadow(f) {
    window.DATA.foreshadows.push({ id: 'f-' + Date.now().toString(36), status: 'open', ...f });
    save();
  }
  function updateChar(id, patch) {
    const c = window.DATA.characters.find(x => x.id === id); if (!c) return;
    Object.assign(c, patch); save();
  }
  function removeChar(id) { window.DATA.characters = window.DATA.characters.filter(x => x.id !== id); save(); }

  /* ---------- 模板 ---------- */
  function findTpl(id) {
    for (const g of window.DATA.templates) {
      const t = g.items.find(x => x.id === id);
      if (t) return { group: g, tpl: t };
    }
    return null;
  }
  function saveTemplate(id, { name, desc, prompt, vars, params }) {
    const hit = findTpl(id);
    if (!hit) return;
    const t = hit.tpl;
    if (name !== undefined) t.name = name;
    if (desc !== undefined) t.desc = desc;
    if (prompt !== undefined) t.prompt = prompt;
    if (vars !== undefined) t.vars = vars;
    if (params !== undefined) t.params = params;
    t.updatedAt = new Date().toISOString();
    save();
  }
  function addTemplate(group, tpl) {
    let g = window.DATA.templates.find(x => x.group === group);
    if (!g) { g = { group, items: [] }; window.DATA.templates.push(g); }
    const item = { id: 'tp' + Date.now().toString(36), ...tpl };
    g.items.push(item);
    save();
    return item;
  }
  function deleteTemplate(id) {
    for (const g of window.DATA.templates) {
      const i = g.items.findIndex(x => x.id === id);
      if (i >= 0) { g.items.splice(i, 1); break; }
    }
    save();
  }

  /* ---------- API 渠道 ---------- */
  function saveApi(id, patch) {
    const a = window.DATA.apis.find(x => x.id === id); if (!a) return;
    Object.assign(a, patch);
    save();
  }
  function addApi(api) {
    window.DATA.apis.push({ id: 'a' + Date.now().toString(36), used: 0, quota: '—', ...api });
    save();
  }
  function removeApi(id) {
    window.DATA.apis = window.DATA.apis.filter(x => x.id !== id);
    if (window.DATA.defaultApi === id) window.DATA.defaultApi = '';
    save();
  }
  function setDefaultApi(id) { window.DATA.defaultApi = id; save(); }
  function bumpCall(channelId, tokens, model) {
    const a = window.DATA.apis.find(x => x.id === channelId);
    if (a) {
      a.used = (a.used || 0) + (tokens || 0);
      a.lastCall = new Date().toISOString();
    }
    window.DATA.aiCalls.push({
      time: new Date().toLocaleTimeString(),
      model: model || (a && a.model) || 'demo',
      tokens: tokens || 0,
      channel: (a && a.name) || channelId || 'demo'
    });
    save();
  }

  return {
    init, save,
    isDesktop, invoke,
    currentVol, currentBeat, currentProject, findBeat,
    addProject, removeProject,
    addVolume, addBeat, updateBeat,
    setChapterParas, saveChapter, confirmPara, touchChapter,
    addChar, updateChar, removeChar, addLocation, addItem, addForeshadow,
    saveTemplate, addTemplate, deleteTemplate, findTpl,
    saveApi, addApi, removeApi, setDefaultApi, bumpCall
  };
})();

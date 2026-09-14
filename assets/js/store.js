/* ============================================================
 * 晴笺 · AI 小说创作台 — 存储层
 * 主存储：localStorage（浏览器 file:// 与 Tauri WebView 通用）。
 * 桌面模式（Tauri）下 save() 会防抖双写磁盘 store.json 作为第二
 * 持久层；首次启动若本地缓存为空则从磁盘恢复。
 * 多项目隔离：项目级数据统一存放在 DATA.projectData[projectId]，
 * 通过 useProject() 物化到 DATA.volumes / characters / ... 供页面
 * 直接读写；顶层键在序列化时剔除，避免数据重复。
 * ============================================================ */

window.APP = window.APP || {};
window.APP.store = (function () {

  const KEY = 'novel-studio:data:v1';
  const SCOPED = ['volumes', 'characters', 'locations', 'items', 'foreshadows', 'timeline'];
  const tauriInvoke = () => window.__TAURI__?.core?.invoke || window.__TAURI_INTERNALS__?.invoke;

  function isDesktop() { return typeof tauriInvoke() === 'function'; }
  async function invoke(command, args) {
    const fn = tauriInvoke();
    if (!fn) throw new Error('当前不是 Tauri 桌面环境');
    return fn(command, args);
  }

  /* ---------- 就绪回调：桌面端磁盘恢复后触发页面重渲染 ---------- */
  const readyCbs = [];
  function onReady(cb) { readyCbs.push(cb); }

  function _current() {
    return window.DATA && window.DATA.current;
  }

  /* ---------- 项目数据隔离 ---------- */
  function emptyProjectData() {
    return { volumes: [], characters: [], locations: [], items: [], foreshadows: [], timeline: [] };
  }
  function projectData(pid) {
    const D = window.DATA;
    if (!D) return emptyProjectData();
    if (!D.projectData) D.projectData = {};
    if (!D.projectData[pid]) D.projectData[pid] = emptyProjectData();
    const pd = D.projectData[pid];
    SCOPED.forEach(k => { if (!Array.isArray(pd[k])) pd[k] = []; });
    return pd;
  }
  /* 把项目数据物化到顶层（页面代码读 DATA.volumes 等） */
  function useProject(pid) {
    const D = window.DATA;
    const c = D.current || (D.current = {});
    if (c.projectId !== pid) {
      D.current = { projectId: pid, volumeId: '', chapterId: '', chapterTitle: '', chapterWords: 0, chapterOrder: 1 };
    }
    const pd = projectData(pid);
    SCOPED.forEach(k => { D[k] = pd[k]; });
    return D;
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

  /* ---------- 序列化（剔除物化视图，避免双份数据） ---------- */
  function serialize() {
    const D = window.DATA;
    const clone = Object.assign({}, D);
    SCOPED.forEach(k => { delete clone[k]; });
    return JSON.stringify(clone);
  }

  /* ---------- 项目统计同步 ---------- */
  function syncStats() {
    const p = currentProject();
    if (!p) return;
    const pd = projectData(p.id);
    let words = 0, chapters = 0;
    pd.volumes.forEach(v => (v.beats || []).forEach(b => {
      chapters++;
      (b.paras || []).forEach(x => { words += (x.text || '').length; });
    }));
    p.words = words;
    p.chapters = chapters;
    p.volumes = pd.volumes.length;
    p.progress = Math.min(1, words / (p.targetWords || 100000));
    p.updated = new Date().toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    p.touchedAt = new Date().toISOString();
  }

  /* ---------- 持久化 ---------- */
  let diskTimer = null;
  function syncDisk() {
    if (!isDesktop()) return;
    clearTimeout(diskTimer);
    diskTimer = setTimeout(() => {
      try { invoke('save_store', { data: serialize() }).catch(() => {}); } catch (e) { /* 桌面落盘失败不影响本地缓存 */ }
    }, 500);
  }
  function init(DATA) {
    window.DATA = DATA;
    let hasLocal = false;
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const obj = JSON.parse(saved);
        Object.keys(DATA).forEach(k => { if (obj[k] !== undefined) DATA[k] = obj[k]; });
        hasLocal = true;
      }
    } catch (e) { /* 存档损坏则回退到示例数据 */ }
    const D = window.DATA;
    /* 旧版存档迁移：顶层集合挂到当前项目名下 */
    if (!D.projectData) {
      D.projectData = {};
      const pid = (D.current && D.current.projectId) || (D.projects[0] && D.projects[0].id) || 'p-default';
      const pd = projectData(pid);
      SCOPED.forEach(k => { pd[k] = Array.isArray(D[k]) ? D[k] : []; });
    }
    D.projects.forEach(p => projectData(p.id));
    useProject((D.current && D.current.projectId) || (D.projects[0] && D.projects[0].id));
    save();
    /* 桌面端：本地缓存为空时从磁盘恢复 */
    if (isDesktop() && !hasLocal) {
      invoke('load_store').then(s => {
        if (!s) return;
        try {
          const obj = JSON.parse(s);
          Object.keys(D).forEach(k => { if (obj[k] !== undefined) D[k] = obj[k]; });
          D.projects.forEach(p => projectData(p.id));
          useProject((D.current && D.current.projectId) || (D.projects[0] && D.projects[0].id));
          readyCbs.splice(0).forEach(cb => { try { cb(); } catch (e) { /* 单页渲染失败不阻塞 */ } });
        } catch (e) { /* 磁盘存档损坏则忽略 */ }
      }).catch(() => {});
    }
    return D;
  }
  function save() {
    try {
      syncStats();
      localStorage.setItem(KEY, serialize());
    } catch (e) { /* 存储满或隐私模式：静默失败 */ }
    syncDisk();
  }

  /* ---------- 备份 / 恢复 ---------- */
  function exportAll() { return serialize(); }
  function restoreAll(json) {
    const obj = JSON.parse(json); // 抛错由调用方提示
    if (!obj || !Array.isArray(obj.projects)) throw new Error('备份文件结构不正确');
    localStorage.setItem(KEY, JSON.stringify(obj));
    if (isDesktop()) { try { invoke('save_store', { data: JSON.stringify(obj) }); } catch (e) { /* 同上 */ } }
    location.reload();
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
      createdAt: new Date().toISOString(),
      touchedAt: new Date().toISOString()
    };
    window.DATA.projects.push(p);
    projectData(id); // 建立空的项目数据区（含第一卷空结构由大纲页创建）
    return p;
  }
  function removeProject(id) {
    window.DATA.projects = window.DATA.projects.filter(p => p.id !== id);
    if (window.DATA.projectData) delete window.DATA.projectData[id];
    const c = window.DATA.current;
    if (c && c.projectId === id) {
      const next = window.DATA.projects[0];
      useProject(next ? next.id : '');
    }
    save();
  }

  /* ---------- 大纲 ---------- */
  function addVolume(title) {
    const id = 'v' + Date.now().toString(36);
    window.DATA.volumes.push({ id, title, chapters: 0, done: 0, beats: [] });
    save();
    return id;
  }
  function removeVolume(volumeId) {
    window.DATA.volumes = window.DATA.volumes.filter(v => v.id !== volumeId);
    save();
  }
  function addBeat(volumeId, beat) {
    const vol = window.DATA.volumes.find(v => v.id === volumeId);
    if (!vol) return null;
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
    vol.done = vol.beats.filter(x => x.status === 'done').length;
    save();
    return b;
  }
  function updateBeat(volumeId, beatId, patch) {
    const b = findBeat(volumeId, beatId);
    if (!b) return;
    Object.assign(b, patch);
    const vol = window.DATA.volumes.find(v => v.id === volumeId);
    if (vol) {
      vol.chapters = vol.beats.length;
      vol.done = vol.beats.filter(x => x.status === 'done').length;
    }
    save();
  }
  function removeBeat(volumeId, beatId) {
    const vol = window.DATA.volumes.find(v => v.id === volumeId);
    if (!vol) return;
    vol.beats = vol.beats.filter(b => b.id !== beatId);
    vol.chapters = vol.beats.length;
    vol.done = vol.beats.filter(x => x.status === 'done').length;
    vol.beats.forEach((b, i) => { b.no = String(i + 1).padStart(2, '0'); });
    const c = _current();
    if (c && c.chapterId === beatId) { c.volumeId = ''; c.chapterId = ''; c.chapterTitle = ''; }
    save();
  }
  function moveBeat(volumeId, from, to) {
    const vol = window.DATA.volumes.find(v => v.id === volumeId);
    if (!vol || from < 0 || to < 0 || from >= vol.beats.length || to >= vol.beats.length) return;
    const [b] = vol.beats.splice(from, 1);
    vol.beats.splice(to, 0, b);
    vol.beats.forEach((x, i) => { x.no = String(i + 1).padStart(2, '0'); });
    save();
  }

  /* ---------- 章节 bundle（浏览器兼容 + Tauri 章节文件） ---------- */
  function chapterBundle(beat) {
    const paras = (beat && beat.paras) || [];
    return {
      content: paras.map(p => p.text || '').join('\n\n'),
      metadata: {
        paragraphs: paras.map((p, index) => ({ index, cls: p.cls || '' })),
        words: paras.reduce((s, p) => s + (p.text || '').length, 0),
        modifiedCount: beat.modifiedCount || 0,
        updatedAt: beat.updatedAt || new Date().toISOString(),
        status: beat.status || 'todo',
        snapshots: beat.snapshots || []
      }
    };
  }
  function applyChapterBundle(beat, bundle) {
    if (!beat || !bundle) return beat;
    const lines = String(bundle.content || '').split(/\n\s*\n/);
    const meta = bundle.metadata || {};
    const marks = Array.isArray(meta.paragraphs) ? meta.paragraphs : [];
    beat.paras = lines.filter((x, i) => x.trim() || i < lines.length - 1).map((text, index) => ({
      text: text.trim(), cls: (marks[index] && marks[index].cls) || ''
    })).filter(p => p.text);
    if (meta.modifiedCount !== undefined) beat.modifiedCount = meta.modifiedCount;
    if (meta.updatedAt) beat.updatedAt = meta.updatedAt;
    if (meta.status) beat.status = meta.status;
    if (Array.isArray(meta.snapshots)) beat.snapshots = meta.snapshots;
    return beat;
  }
  function browserBundleKey(projectId, volumeId, chapterId) {
    return KEY + ':chapter:' + [projectId, volumeId, chapterId].map(x => String(x || '').replace(/[^\w-]/g, '_')).join(':');
  }
  async function loadChapterBundle(projectId, volumeId, chapterId) {
    const beat = findBeat(volumeId, chapterId);
    if (isDesktop()) {
      try {
        const bundle = await invoke('load_chapter_bundle', { projectId, volume: volumeId, chapter: chapterId });
        if (bundle && beat && bundle.content !== undefined) { applyChapterBundle(beat, bundle); return bundle; }
      } catch (e) { /* 文件尚不存在时回退内存数据 */ }
    }
    try {
      const saved = localStorage.getItem(browserBundleKey(projectId, volumeId, chapterId));
      if (saved) { const bundle = JSON.parse(saved); applyChapterBundle(beat, bundle); return bundle; }
    } catch (e) { /* 损坏的章节缓存回退内存 */ }
    return beat ? chapterBundle(beat) : null;
  }
  async function saveChapterBundle(projectId, volumeId, chapterId, bundle) {
    if (isDesktop()) return invoke('save_chapter_bundle', { projectId, volume: volumeId, chapter: chapterId, content: bundle.content || '', metadata: bundle.metadata || {} });
    localStorage.setItem(browserBundleKey(projectId, volumeId, chapterId), JSON.stringify(bundle));
    return true;
  }
  async function createChapterSnapshot(projectId, volumeId, chapterId, bundle, snapshotId) {
    if (isDesktop()) return invoke('create_snapshot', { projectId, volume: volumeId, chapter: chapterId, content: bundle.content || '', snapshotId });
    const key = browserBundleKey(projectId, volumeId, chapterId) + ':snapshot:' + snapshotId;
    localStorage.setItem(key, JSON.stringify(bundle));
    return snapshotId;
  }
  async function restoreChapterSnapshot(projectId, volumeId, chapterId, snapshotId) {
    if (isDesktop()) return invoke('restore_snapshot', { projectId, volume: volumeId, chapter: chapterId, snapshotId });
    const key = browserBundleKey(projectId, volumeId, chapterId) + ':snapshot:' + snapshotId;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  }


  function setChapterParas(volumeId, beatId, paras) {
    const b = findBeat(volumeId, beatId);
    if (!b) return;
    b.paras = paras;
    const words = paras.reduce((s, p) => s + (p.text || '').length, 0);
    if (_current() && _current().chapterId === beatId) _current().chapterWords = words;
    save();
  }
  function saveChapter() { save(); }
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
    const item = Object.assign({ id: 'c-' + Date.now().toString(36), confirmed: false }, c);
    window.DATA.characters.push(item);
    save();
    return item;
  }
  function confirmChar(id) {
    const c = window.DATA.characters.find(x => x.id === id);
    if (c) { c.confirmed = true; save(); }
  }
  function updateChar(id, patch) {
    const c = window.DATA.characters.find(x => x.id === id); if (!c) return;
    Object.assign(c, patch); save();
  }
  function removeChar(id) { window.DATA.characters = window.DATA.characters.filter(x => x.id !== id); save(); }

  function addLocation(l) {
    const item = Object.assign({ id: 'l-' + Date.now().toString(36) }, l);
    window.DATA.locations.push(item); save(); return item;
  }
  function updateLocation(id, patch) {
    const l = window.DATA.locations.find(x => x.id === id); if (!l) return;
    Object.assign(l, patch); save();
  }
  function removeLocation(id) { window.DATA.locations = window.DATA.locations.filter(x => x.id !== id); save(); }

  function addItem(i) {
    const item = Object.assign({ id: 'i-' + Date.now().toString(36) }, i);
    window.DATA.items.push(item); save(); return item;
  }
  function updateItem(id, patch) {
    const it = window.DATA.items.find(x => x.id === id); if (!it) return;
    Object.assign(it, patch); save();
  }
  function removeItem(id) { window.DATA.items = window.DATA.items.filter(x => x.id !== id); save(); }

  function addForeshadow(f) {
    const item = Object.assign({ id: 'f-' + Date.now().toString(36), status: 'open' }, f);
    window.DATA.foreshadows.push(item); save(); return item;
  }
  function updateForeshadow(id, patch) {
    const f = window.DATA.foreshadows.find(x => x.id === id); if (!f) return;
    Object.assign(f, patch); save();
  }
  function removeForeshadow(id) { window.DATA.foreshadows = window.DATA.foreshadows.filter(x => x.id !== id); save(); }

  function addTimeline(n) {
    if (!Array.isArray(window.DATA.timeline)) window.DATA.timeline = [];
    const item = Object.assign({ id: 'tl-' + Date.now().toString(36) }, n);
    window.DATA.timeline.push(item); save(); return item;
  }
  function updateTimeline(id, patch) {
    const n = window.DATA.timeline.find(x => x.id === id); if (!n) return;
    Object.assign(n, patch); save();
  }
  function removeTimeline(id) { window.DATA.timeline = window.DATA.timeline.filter(x => x.id !== id); save(); }

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
  /* 模板导入：按组合并，id 冲突自动重生成 */
  function importTemplates(list) {
    if (!Array.isArray(list)) throw new Error('模板文件结构不正确');
    let count = 0;
    list.forEach(g => {
      if (!g || !g.group || !Array.isArray(g.items)) return;
      let target = window.DATA.templates.find(x => x.group === g.group);
      if (!target) { target = { group: g.group, items: [] }; window.DATA.templates.push(target); }
      g.items.forEach(t => {
        if (!t || !t.name) return;
        const exists = target.items.some(x => x.id === t.id);
        target.items.push(exists
          ? Object.assign({}, t, { id: 'tp' + Date.now().toString(36) + Math.floor(Math.random() * 1e4) })
          : t);
        count++;
      });
    });
    save();
    return count;
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
    if (window.DATA.aiCalls.length > 200) window.DATA.aiCalls = window.DATA.aiCalls.slice(-200);
    save();
  }

  return {
    init, save,
    isDesktop, invoke, onReady,
    projectData, useProject, syncStats,
    chapterBundle, applyChapterBundle, loadChapterBundle, saveChapterBundle,
    createChapterSnapshot, restoreChapterSnapshot,
    currentVol, currentBeat, currentProject, findBeat,
    exportAll, restoreAll,
    addProject, removeProject,
    addVolume, removeVolume, addBeat, updateBeat, removeBeat, moveBeat,
    setChapterParas, saveChapter, confirmPara, touchChapter,
    addChar, confirmChar, updateChar, removeChar,
    addLocation, updateLocation, removeLocation,
    addItem, updateItem, removeItem,
    addForeshadow, updateForeshadow, removeForeshadow,
    addTimeline, updateTimeline, removeTimeline,
    saveTemplate, addTemplate, deleteTemplate, findTpl, importTemplates,
    saveApi, addApi, removeApi, setDefaultApi, bumpCall
  };
})();

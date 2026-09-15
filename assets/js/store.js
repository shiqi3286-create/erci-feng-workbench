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
  const SNAP_KEY = KEY + ':snap';
  const DIRTY_KEY = KEY + ':dirty';
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

  /* ---------- 章节字数缓存（迁移后正文不进主存储，统计走缓存） ---------- */
  function statsEnsure() {
    const D = window.DATA;
    D.stats = D.stats || {};
    D.stats.chapterWords = D.stats.chapterWords || {};
    return D.stats.chapterWords;
  }
  function chapterStatKey(projectId, beatId) { return String(projectId || '') + ':' + String(beatId || ''); }
  function readChapterStat(cw, pid, beatId) { return cw[chapterStatKey(pid, beatId)] || cw[beatId]; }
  function chapterCalc(b) {
    let words = 0, ai = 0;
    (b.paras || []).forEach(x => {
      const n = (x.text || '').length;
      words += n;
      if ((x.cls || '').includes('ai-mark')) ai += n;
    });
    return { words, ai };
  }
  /* 项目实际字数：当前章读内存，其余章节读缓存 */
  function projectWordsCalc(pid) {
    const pd = projectData(pid);
    const cw = statsEnsure();
    const cur = window.DATA.current;
    let words = 0, ai = 0;
    pd.volumes.forEach(v => (v.beats || []).forEach(b => {
      const inMem = cur && cur.projectId === pid && cur.chapterId === b.id && Array.isArray(b.paras) && b.paras.length;
      let c;
      if (inMem) { c = chapterCalc(b); cw[chapterStatKey(pid, b.id)] = c; }
      else c = readChapterStat(cw, pid, b.id) || { words: 0, ai: 0 };
      words += c.words; ai += c.ai;
    }));
    return { words, ai };
  }

  /* ---------- 项目统计同步 ---------- */
  function syncStats() {
    const p = currentProject();
    if (!p) return;
    const pd = projectData(p.id);
    const { words } = projectWordsCalc(p.id);
    p.words = words;
    p.chapters = pd.volumes.reduce((s, v) => s + (v.beats || []).length, 0);
    p.volumes = pd.volumes.length;
    p.progress = Math.min(1, words / (p.targetWords || 100000));
    p.updated = new Date().toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    p.touchedAt = new Date().toISOString();
  }

  /* ---------- 持久化 ---------- */
  let diskTimer = null;
  let baselineWords = null;   // 首次 save 时的总字数基线，吞掉种子/存档的字数口径差异
  function syncDisk() {
    if (!isDesktop()) return;
    clearTimeout(diskTimer);
    diskTimer = setTimeout(() => {
      try { invoke('save_store', { data: serialize() }).catch(() => {}); } catch (e) { /* 桌面落盘失败不影响本地缓存 */ }
    }, 500);
  }

  /* ---------- 写作统计：每日净增字数落库 ---------- */
  function localDate(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function totalWords() {
    return (window.DATA.projects || []).reduce((s, p) => s + (p.words || 0), 0);
  }
  function userStats() {
    const u = window.DATA.user = window.DATA.user || {};
    u.stats = u.stats || {};
    u.stats.daily = u.stats.daily || {};
    return u.stats;
  }
  /* 当天净增字数（写入统计，供 profile 展示） */
  function recordDailyDelta(delta) {
    if (!delta) return;
    const st = userStats();
    const t = localDate();
    st.daily[t] = (st.daily[t] || 0) + delta;
    st.lastWritten = t;
  }
  function writingDays() { return Object.keys(userStats().daily).length; }
  /* 连续写作天数：今天有记录从今天起算，今天没有则从昨天起算 */
  function streakDays() {
    const daily = userStats().daily;
    const d = new Date();
    let count = 0;
    for (let i = 0; i < 3650; i++) {
      const key = localDate(d);
      if (daily[key] !== undefined) { count++; d.setDate(d.getDate() - 1); }
      else if (i === 0) { d.setDate(d.getDate() - 1); }
      else break;
    }
    return count;
  }
  /* 近 7 天（含今天）写作量，供趋势图 */
  function last7Days() {
    const daily = userStats().daily;
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = localDate(d);
      out.push({ date: key, label: (d.getMonth() + 1) + '/' + d.getDate(), words: daily[key] || 0 });
    }
    return out;
  }
  /* AI 生成字数占比：正文中带 ai-mark 的段落字数 / 全书总字数（缓存 + 当前章内存） */
  function aiShare() {
    const cw = statsEnsure();
    const cur = window.DATA.current;
    let total = 0, ai = 0;
    Object.values(window.DATA.projectData || {}).forEach(pd => {
      (pd.volumes || []).forEach(v => (v.beats || []).forEach(b => {
        const inMem = cur && cur.chapterId === b.id && Array.isArray(b.paras) && b.paras.length;
        let c;
        if (inMem) { c = chapterCalc(b); cw[chapterStatKey(pid, b.id)] = c; }
        else c = readChapterStat(cw, pid, b.id);
        if (c) { total += c.words; ai += c.ai; }
      }));
    });
    return total ? Math.round(ai / total * 100) : 0;
  }
  /* 各作品实际字数（写作统计卡 / 分布） */
  function projectWordsAll() {
    return (window.DATA.projects || []).map(p => ({ id: p.id, title: p.title, words: p.words || 0, status: p.status }));
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
    /* 旧版存档迁移：user 偏好字段归位 */
    D.user = D.user || {};
    if (D.user.autoSave !== undefined && D.user.prefs === undefined) D.user.prefs = {};
    if (D.user.prefs) {
      if (D.user.prefs.autoSaveSec === undefined && D.user.autoSave !== undefined) D.user.prefs.autoSaveSec = D.user.autoSave;
      if (D.user.prefs.aiAutoSend === undefined && D.user.aiAutoSend !== undefined) D.user.prefs.aiAutoSend = !!D.user.aiAutoSend;
    }
    /* 旧版存档迁移：顶层集合挂到当前项目名下 */
    if (!D.projectData) {
      D.projectData = {};
      const pid = (D.current && D.current.projectId) || (D.projects[0] && D.projects[0].id) || 'p-default';
      const pd = projectData(pid);
      SCOPED.forEach(k => { pd[k] = Array.isArray(D[k]) ? D[k] : []; });
    }
    D.projects.forEach(p => projectData(p.id));
    useProject((D.current && D.current.projectId) || (D.projects[0] && D.projects[0].id));
    /* 崩溃恢复（§12-2）：dirty 标记残留 = 上次写入未完成 */
    try { if (localStorage.getItem(DIRTY_KEY)) D.snapAvailable = true; } catch (e) { /* 忽略 */ }
    /* 章节懒加载迁移与持久化必须在桌面磁盘恢复之后执行，避免种子数据覆盖真实存档 */
    const finishInit = async () => {
      await migrateBundles();
      save();
      readyCbs.splice(0).forEach(cb => { try { cb(); } catch (e) { /* 单页渲染失败不阻塞 */ } });
    };
    if (isDesktop() && !hasLocal) {
      invoke('load_store').then(async s => {
        if (s) {
          try {
            const obj = JSON.parse(s);
            Object.keys(D).forEach(k => { if (obj[k] !== undefined) D[k] = obj[k]; });
            D.projects.forEach(p => projectData(p.id));
            useProject((D.current && D.current.projectId) || (D.projects[0] && D.projects[0].id));
          } catch (e) { /* 磁盘存档损坏则保留种子数据 */ }
        }
        await finishInit();
      }).catch(() => finishInit());
    } else {
      finishInit();
    }
    return D;
  }
  function save() {
    let persisted = false;
    try {
      const prevTotal = totalWords();
      syncStats();
      const nowTotal = totalWords();
      /* 首次数值基线：种子/存档与实算口径不一致，吞掉这次差异 */
      if (baselineWords === null) baselineWords = nowTotal;
      else if (nowTotal !== prevTotal) recordDailyDelta(nowTotal - prevTotal);
      /* 崩溃恢复：写主键前打 dirty 标记，写完清除；异常退出时标记残留 */
      setDirty();
      localStorage.setItem(KEY, serialize());
      clearDirty();
      persisted = true;
    } catch (e) {
      /* 存储满或隐私模式：保留 dirty 标记并明确告知用户 */
      try { window.APP.toast('本地存储空间不足，当前改动尚未保存，请先导出备份或删除图片', 'warn'); } catch (_) { /* 页面尚未就绪 */ }
    }
    syncDisk();
    autoSnapshot();
    return persisted;
  }

  /* ---------- 崩溃恢复自动快照（§12-2） ---------- */
  let lastSnapAt = 0;
  function setDirty() { try { localStorage.setItem(DIRTY_KEY, '1'); } catch (e) { /* 忽略 */ } }
  function clearDirty() { try { localStorage.removeItem(DIRTY_KEY); } catch (e) { /* 忽略 */ } }
  function autoSnapshot() {
    const now = Date.now();
    if (now - lastSnapAt < 10000) return;   // 10s 节流
    lastSnapAt = now;
    try { localStorage.setItem(SNAP_KEY, serialize()); } catch (e) { /* 存储满则跳过本轮 */ }
    if (isDesktop()) { try { invoke('save_snapshot', { data: serialize() }).catch(() => {}); } catch (e) { /* 桌面快照失败不阻塞 */ } }
  }
  /** 从自动快照恢复（覆盖当前数据），桌面优先读磁盘快照 */
  async function restoreSnapshot() {
    let s = null;
    if (isDesktop()) {
      try { s = await invoke('load_snapshot'); } catch (e) { s = null; }
    }
    if (!s) {
      try { s = localStorage.getItem(SNAP_KEY); } catch (e) { s = null; }
    }
    if (!s) throw new Error('没有可用的自动快照');
    let obj;
    try { obj = JSON.parse(s); } catch (e) {
      try { localStorage.removeItem(SNAP_KEY); } catch (_) { /* ignore */ }
      throw new Error('自动快照已损坏，请使用备份恢复');
    }
    if (!obj || !Array.isArray(obj.projects)) throw new Error('快照文件结构不正确');
    Object.keys(window.DATA).forEach(k => { if (obj[k] !== undefined) window.DATA[k] = obj[k]; });
    window.DATA.projects.forEach(p => projectData(p.id));
    useProject((window.DATA.current && window.DATA.current.projectId) || (window.DATA.projects[0] && window.DATA.projects[0].id));
    save();
    clearDirty();
    return true;
  }

  /* ---------- 章节懒加载迁移（§12-1 P0）：一章一 bundle，正文不进主存储 ---------- */
  async function migrateBundles() {
    const D = window.DATA;
    D.meta = D.meta || {};
    if (D.meta.bundlesMigrated) return false;
    const cw = statsEnsure();
    const cur = D.current;
    let moved = 0;
    const tasks = [];
    Object.entries(D.projectData || {}).forEach(([pid, pd]) => {
      (pd.volumes || []).forEach(v => (v.beats || []).forEach(b => {
        if (!Array.isArray(b.paras) || !b.paras.length) {
          if (b.paras && b.paras.length === 0) { cw[chapterStatKey(pid, b.id)] = { words: 0, ai: 0 }; }
          return;
        }
        const isCurrent = cur && cur.projectId === pid && cur.chapterId === b.id;
        const bundle = chapterBundle(b);
        cw[chapterStatKey(pid, b.id)] = chapterCalc(b);
        tasks.push(Promise.resolve(saveChapterBundle(pid, v.id, b.id, bundle)).catch(() => {}));
        if (!isCurrent) b.paras = [];   // 只保留当前章节正文在内存
        moved++;
      }));
    });
    await Promise.all(tasks);
    D.meta.bundlesMigrated = true;
    save();
    return moved > 0;
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
    if (window.DATA.projectData) {
      /* 清理该作品的章节字数缓存 */
      const cw = window.DATA.stats && window.DATA.stats.chapterWords;
      if (cw) {
        const pd = window.DATA.projectData[id];
        if (pd && Array.isArray(pd.volumes)) {
          pd.volumes.forEach(v => (v.beats || []).forEach(b => delete cw[chapterStatKey(id, b.id)]));
        }
      }
      delete window.DATA.projectData[id];
    }
    const c = window.DATA.current;
    if (c && c.projectId === id) {
      const next = window.DATA.projects[0];
      useProject(next ? next.id : '');
    }
    save();
  }
  function updateProject(id, patch) {
    const p = window.DATA.projects.find(x => x.id === id);
    if (!p) return;
    Object.assign(p, patch);
    save();
    return p;
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
    if (patch.paras !== undefined) statsEnsure()[chapterStatKey((_current() || {}).projectId, beatId)] = chapterCalc(b);
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
    if (window.DATA.stats && window.DATA.stats.chapterWords) delete window.DATA.stats.chapterWords[chapterStatKey(c && c.projectId, beatId)];
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
    statsEnsure()[chapterStatKey((_current() || {}).projectId, beatId)] = chapterCalc(b);
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
  /* ---------- 本地规则校验（§12-3，零 token 成本） ---------- */
  function countOcc(texts, name) {
    let cnt = 0;
    texts.forEach(t => { let i = 0; while ((i = t.indexOf(name, i)) !== -1) { cnt++; i += name.length; } });
    return cnt;
  }
  function fsKeywords(text) {
    const clean = String(text || '').replace(/[「」『』《》【】，。！？、：；·—…\s"'“”‘’（）()]/g, '');
    if (!clean) return [];
    const kws = [clean];
    for (let len = 4; len >= 2; len--) if (clean.length > len) kws.push(clean.slice(0, len));
    return kws.filter(Boolean);
  }
  /** 一致性扫描：here（当前章内存）/ all（全书逐章从 bundle 拉取，用后释放） */
  async function scanLocal(scope) {
    const D = window.DATA;
    const cur = D.current || {};
    const texts = [];
    const loaded = [];
    if (scope === 'all') {
      for (const [pid, pd] of Object.entries(D.projectData || {})) {
        for (const v of pd.volumes || []) {
          for (const b of v.beats || []) {
            const inMem = cur && cur.projectId === pid && cur.chapterId === b.id && Array.isArray(b.paras) && b.paras.length;
            if (inMem) { texts.push(...b.paras.map(x => x.text || '')); continue; }
            try {
              const bundle = await loadChapterBundle(pid, v.id, b.id);
              texts.push(bundle ? bundle.content : '');
              const ref = findBeat(v.id, b.id);
              if (ref) loaded.push(ref);
            } catch (e) { /* 跳过读不到的章节 */ }
          }
        }
      }
    } else {
      texts.push(...((findBeat(cur.volumeId, cur.chapterId)?.paras) || []).map(x => x.text || ''));
    }
    const label = scope === 'all' ? '全书' : '本章';
    const results = [];
    if (!texts.length) return results;
    const full = texts.join('\n');
    const seen = new Set();
    const push = (type, text, kind) => {
      const key = type + text;
      if (seen.has(key)) return;
      seen.add(key);
      results.push({ type, text, kind });
    };
    /* 1. 人物出现 */
    (D.characters || []).filter(c => (c.name || '').length >= 2).forEach(c => {
      if (countOcc(texts, c.name) === 0) push('一致性', '设定人物「' + c.name + '」在' + label + '正文中未出现', 'char');
    });
    /* 2. 地点 / 物品名词统一 */
    [...(D.locations || []).map(l => l.name), ...(D.items || []).map(i => i.name)]
      .filter(n => n && n.length >= 2)
      .forEach(n => { if (countOcc(texts, n) === 0) push('名词统一', '设定「' + n + '」在' + label + '正文中未出现，请核对是否用了其他写法', 'noun'); });
    /* 3. 未回收伏笔的呼应线索 */
    (D.foreshadows || []).filter(f => f.status === 'open').forEach(f => {
      const kws = fsKeywords(f.text);
      if (!kws.length) return;
      const hit = kws.some(k => full.includes(k));
      if (!hit) push('伏笔', '未回收伏笔「' + f.text + '」在' + label + '中没有出现关键词线索，留意后续呼应', 'fs');
    });
    /* 用完释放非当前章正文，保持懒加载 */
    loaded.forEach(b => { b.paras = []; });
    return results;
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
        const normalized = Object.assign({ vars: [], params: { temp: 0.8, max: 2000 }, desc: '' }, t);
        normalized.vars = Array.isArray(normalized.vars) ? normalized.vars : [];
        normalized.params = Object.assign({ temp: 0.8, max: 2000 }, normalized.params || {});
        const exists = target.items.some(x => x.id === normalized.id);
        target.items.push(exists
          ? Object.assign({}, normalized, { id: 'tp' + Date.now().toString(36) + Math.floor(Math.random() * 1e4) })
          : normalized);
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
    window.DATA.apis.push({ id: 'a' + Date.now().toString(36), type: api.type || 'text', used: 0, quota: '—', ...api });
    save();
    return window.DATA.apis[window.DATA.apis.length - 1];
  }
  function removeApi(id) {
    window.DATA.apis = window.DATA.apis.filter(x => x.id !== id);
    if (window.DATA.defaultApi === id) window.DATA.defaultApi = '';
    if (window.DATA.defaultImageApi === id) window.DATA.defaultImageApi = '';
    save();
  }
  /* 默认渠道按类型分别设置：text → defaultApi，image → defaultImageApi */
  function setDefaultApi(id, type) {
    const a = window.DATA.apis.find(x => x.id === id);
    const t = (type || (a && a.type) || 'text') === 'image' ? 'image' : 'text';
    if (t === 'image') window.DATA.defaultImageApi = id;
    else window.DATA.defaultApi = id;
    save();
  }

  /* ---------- 用户资料（profile.html） ---------- */
  function updateUser(patch) {
    const u = window.DATA.user = window.DATA.user || {};
    Object.keys(patch || {}).forEach(k => {
      const v = patch[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) u[k] = Object.assign(u[k] || {}, v);
      else u[k] = v;
    });
    save();
    return u;
  }
  function defaultChannelFor(type) {
    const t = type === 'image' ? 'image' : 'text';
    const id = t === 'image' ? window.DATA.defaultImageApi : window.DATA.defaultApi;
    return window.DATA.apis.find(a => a.id === id) || null;
  }
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
    createChapterSnapshot, restoreChapterSnapshot, migrateBundles,
    restoreSnapshot,
    currentVol, currentBeat, currentProject, findBeat,
    exportAll, restoreAll,
    addProject, removeProject, updateProject,
    addVolume, removeVolume, addBeat, updateBeat, removeBeat, moveBeat,
    setChapterParas, saveChapter, confirmPara, touchChapter,
    addChar, confirmChar, updateChar, removeChar,
    addLocation, updateLocation, removeLocation,
    addItem, updateItem, removeItem,
    addForeshadow, updateForeshadow, removeForeshadow,
    addTimeline, updateTimeline, removeTimeline,
    saveTemplate, addTemplate, deleteTemplate, findTpl, importTemplates,
    saveApi, addApi, removeApi, setDefaultApi, defaultChannelFor, bumpCall,
    updateUser,
    localDate, writingDays, streakDays, last7Days, aiShare, projectWordsAll,
    scanLocal
  };
})();

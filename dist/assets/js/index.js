/* 晴笺 · 作品库首页逻辑
 * 接入 APP.store 持久化：新建/删除项目、字数统计、排序、
 * 备份恢复、跳转创作台（写入 current + 项目数据隔离）
 */
(function () {
  const D = APP.store.init(window.DATA);

  const root = document.getElementById('library-grid');
  let sortMode = 'touched';   // touched 最近更新 / words 字数最多 / progress 进度最高
  const SORT_LABEL = { touched: '最近更新 ↓', words: '字数最多 ↓', progress: '进度最高 ↓' };

  /* ---------- 统计 ---------- */
  function renderStats() {
    let words = 0, chapters = 0, ai = 0;
    D.projects.forEach(p => { words += p.words || 0; chapters += p.chapters || 0; ai += Math.round((p.words || 0) * 0.43); });
    document.getElementById('stat-books').textContent = D.projects.length;
    document.getElementById('stat-words').textContent = APP.fmt(words);
    document.getElementById('stat-chapters').textContent = chapters;
    document.getElementById('stat-ai').textContent = APP.fmt(ai);
    /* 欢迎语随数据更新 */
    const heroLine = document.getElementById('hero-line');
    const cur = APP.store.currentProject();
    if (heroLine) heroLine.innerHTML = `已收录 <b class="mono" style="color:var(--ink)">${D.projects.length}</b> 部作品 · 累计 <b class="mono" style="color:var(--ink)">${APP.fmt(words)}</b> 字。${cur ? '要继续写《' + APP.esc(cur.title) + '》吗？' : '先创建一部作品吧。'}`;
  }

  /* ---------- 打开项目：选定章节目录 ---------- */
  function pickChapter() {
    // 当前项目（useProject 之后）的卷里优先写作中章节；否则第一卷第一张；无则 null
    for (const v of D.volumes) {
      const writing = v.beats.find(b => b.status === 'writing');
      if (writing) return { volumeId: v.id, chapterId: writing.id, chapterOrder: +writing.no };
      if (v.beats.length) { const b = v.beats[0]; return { volumeId: v.id, chapterId: b.id, chapterOrder: +b.no }; }
    }
    return { volumeId: '', chapterId: '', chapterOrder: 1 };
  }

  function openProject(p) {
    APP.store.useProject(p.id);           // 物化该项目数据（切换 current.projectId）
    const pick = pickChapter();
    const vol = pick.volumeId ? D.volumes.find(v => v.id === pick.volumeId) : null;
    const beat = vol && vol.beats.find(b => b.id === pick.chapterId);
    D.current.projectId = p.id;
    D.current.volumeId = pick.volumeId;
    D.current.chapterId = pick.chapterId;
    D.current.chapterTitle = beat ? (`第${beat.no}章 · ${beat.title}`) : (p.title + ' · 待创建章节');
    D.current.chapterWords = beat && beat.paras ? beat.paras.reduce((s, x) => s + (x.text || '').length, 0) : 0;
    D.current.chapterOrder = pick.chapterOrder;
    APP.store.save();
    location.href = 'workspace.html';
  }

  /* ---------- 项目卡片 ---------- */
  function sortedProjects() {
    const arr = D.projects.slice();
    if (sortMode === 'words') arr.sort((a, b) => (b.words || 0) - (a.words || 0));
    else if (sortMode === 'progress') arr.sort((a, b) => (b.progress || 0) - (a.progress || 0));
    else arr.sort((a, b) => new Date(b.touchedAt || b.createdAt || 0) - new Date(a.touchedAt || a.createdAt || 0));
    return arr;
  }

  function renderGrid() {
    root.innerHTML = '';
    sortedProjects().forEach(p => {
      const tagColor = p.status === '连载中' ? 'tag-sun' : 'tag-mute';
      const card = APP.el(`
        <article class="book-card" data-id="${p.id}">
          <div class="book-cover">
            <img src="${p.cover}" alt="${APP.esc(p.title)} 封面" loading="lazy">
            <div class="overlay"></div>
            <span class="tag ${tagColor}" style="position:absolute;top:10px;left:10px;z-index:1">${p.status}</span>
            <button class="book-del" title="删除作品" data-del="${p.id}">${APP.icon('trash')}</button>
          </div>
          <div class="book-body">
            <div class="t">${APP.esc(p.title)}</div>
            <div class="d">${APP.esc(p.genre)} · 更新于 ${APP.esc(p.updated)}</div>
            <div class="book-stats">
              <span><b>${APP.fmt(p.words || 0)}</b> 字</span>
              <span><b>${p.chapters || 0}</b> 章</span>
              <span><b>${p.volumes || 0}</b> 卷</span>
            </div>
            <div class="flex gap-6 mt-8">
              <div class="progress" style="flex:1"><i style="width:${(p.progress || 0) * 100}%"></i></div>
              <span class="small muted mono">${Math.round((p.progress || 0) * 100)}%</span>
            </div>
            <div class="small muted mt-8" style="font-size:11px">目标 ${APP.fmt(p.targetWords || 0)} 字</div>
          </div>
        </article>`);
      card.addEventListener('click', e => {
        if (e.target.closest('[data-del]')) {
          const id = e.target.closest('[data-del]').dataset.del;
          if (confirm('确定删除作品「' + p.title + '」？其分卷、人物、伏笔等全部数据将一并删除，不可撤销。')) {
            APP.store.removeProject(id);
            renderStats(); renderGrid();
            APP.toast('已删除作品及其全部数据', 'success');
          }
          return;
        }
        openProject(p);
      });
      root.appendChild(card);
    });

    /* 新建作品卡 */
    const newCard = APP.el(`
      <div class="new-book-card" id="new-book-btn">
        <span class="plus">${APP.icon('plus')}</span>
        <span>新建作品</span>
        <span class="small" style="font-weight:400">从世界观设定开始，或直接开写</span>
      </div>`);
    newCard.addEventListener('click', openNewModal);
    root.appendChild(newCard);
  }

  /* ---------- 新建作品弹窗（顶部按钮与网格卡片共用） ---------- */
  function openNewModal() {
    APP.modal({
      title: '新建作品',
      submitText: '创建',
      bodyHtml: `
        <div class="field"><label>作品标题</label><input class="input" name="title" placeholder="例如：星落之森"></div>
        <div class="field"><label>题材</label><input class="input" name="genre" placeholder="例如：奇幻 · 治愈"></div>
        <div class="field"><label>目标字数（万）</label><input class="input" name="target" type="number" value="60" min="1"></div>`,
      onSubmit: (root) => {
        const f = APP.formData(root);
        if (!f.title.trim()) { APP.toast('请填写作品标题', 'warn'); return false; }
        const p = APP.store.addProject({
          title: f.title.trim(),
          genre: f.genre.trim() || '未分类',
          targetWords: (parseFloat(f.target) || 60) * 10000
        });
        renderStats(); renderGrid();
        APP.toast('已创建《' + p.title + '》，点击卡片开始写作', 'success');
        return true;
      }
    });
  }
  APP.newProjectModal = openNewModal;

  /* ---------- 排序切换 ---------- */
  const sortBtn = document.getElementById('btn-sort-lib');
  if (sortBtn) {
    sortBtn.textContent = SORT_LABEL[sortMode];
    sortBtn.addEventListener('click', () => {
      const order = ['touched', 'words', 'progress'];
      sortMode = order[(order.indexOf(sortMode) + 1) % order.length];
      sortBtn.textContent = SORT_LABEL[sortMode];
      renderGrid();
      APP.toast('已按「' + SORT_LABEL[sortMode].replace(' ↓', '') + '」排序', 'success');
    });
  }

  /* ---------- 备份 / 恢复 ---------- */
  const backupBtn = document.getElementById('btn-backup');
  const restoreBtn = document.getElementById('btn-restore');
  const restoreFile = document.getElementById('restore-file');
  if (backupBtn) {
    backupBtn.addEventListener('click', () => {
      const stamp = new Date().toISOString().slice(0, 10);
      APP.downloadText('qingjian-backup-' + stamp + '.json', APP.store.exportAll(), 'application/json');
      APP.toast('备份已导出（含全部作品与设定）', 'success');
    });
  }
  if (restoreBtn && restoreFile) {
    restoreBtn.addEventListener('click', () => restoreFile.click());
    restoreFile.addEventListener('change', () => {
      const file = restoreFile.files && restoreFile.files[0];
      restoreFile.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = JSON.parse(reader.result);
          if (!obj || !Array.isArray(obj.projects)) throw new Error('结构不正确');
          if (!confirm('恢复备份将覆盖当前全部数据（' + obj.projects.length + ' 部作品），确定继续？')) return;
          APP.store.restoreAll(reader.result);
        } catch (e) {
          APP.toast('恢复失败：' + e.message, 'warn');
        }
      };
      reader.readAsText(file, 'utf-8');
    });
  }

  /* 顶部头图按钮 / 统计图标 */
  const statIcons = ['book', 'pen', 'grid', 'spark'];
  document.querySelectorAll('#stat-books,#stat-words,#stat-chapters,#stat-ai').forEach((n, i) => {
    const box = n.parentElement.parentElement.querySelector('div:first-child');
    if (box) box.innerHTML = APP.icon(statIcons[i]);
  });

  /* 桌面端磁盘恢复就绪后刷新视图 */
  APP.store.onReady(() => { renderStats(); renderGrid(); });

  renderStats();
  renderGrid();
})();

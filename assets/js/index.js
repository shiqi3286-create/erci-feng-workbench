/* 晴笺 · 作品库首页逻辑
 * 时段问候 / 动态统计（连续写作·本周趋势）/ 搜索筛选排序 /
 * 卡片增强（封面·进度·上次写到·快捷入口）/ 空状态引导 / 新建删除 / 跳转创作台
 */
(function () {
  const D = APP.store.init(window.DATA);

  const root = document.getElementById('library-grid');
  let sortMode = 'touched';   // touched 最近更新 / words 字数最多 / progress 进度最高
  const SORT_LABEL = { touched: '最近更新 ↓', words: '字数最多 ↓', progress: '进度最高 ↓' };
  const state = { q: '', status: '', genre: '' };

  /* ---------- 时段问候：昵称读个人信息，头图/标语按时段切换（§11.4） ---------- */
  function renderHero() {
    const h = new Date().getHours();
    let greet, img, slogan, night;
    if (h >= 5 && h < 11) { greet = '早上好'; img = 'assets/img/cover-forest.jpg'; slogan = 'SUNNY WRITING STUDIO'; night = false; }
    else if (h >= 11 && h < 18) { greet = '下午好'; img = 'assets/img/cover-window.jpg'; slogan = 'SUNNY WRITING STUDIO'; night = false; }
    else if (h >= 18 && h < 22) { greet = '晚上好'; img = 'assets/img/cover-sunset.jpg'; slogan = 'SUNNY WRITING STUDIO'; night = false; }
    else { greet = '夜深了'; img = 'assets/img/cover-window.jpg'; slogan = 'MOONLIT WRITING STUDIO'; night = true; }
    const name = (D.user && D.user.name && D.user.name.trim()) || '作者';
    const greetEl = document.getElementById('hero-greet');
    const sloganEl = document.getElementById('hero-slogan');
    const imgEl = document.getElementById('hero-img');
    const banner = document.getElementById('hero-banner');
    if (greetEl) greetEl.innerHTML = `${greet}，${APP.esc(name)} <span style="color:var(--sun)">${night ? '🌙' : '☀'}</span>`;
    if (sloganEl) sloganEl.textContent = slogan;
    if (imgEl) imgEl.src = img;
    if (banner) {
      banner.style.background = night
        ? 'radial-gradient(600px 200px at 90% 0%, rgba(185,167,224,.38), transparent 60%), linear-gradient(160deg,#F1E9DA,#E8DCCB)'
        : '';
    }
  }

  /* ---------- 统计（动态：累计/连续写作/本周趋势） ---------- */
  function renderStats() {
    let words = 0, chapters = 0;
    D.projects.forEach(p => { words += p.words || 0; chapters += p.chapters || 0; });
    const week = APP.store.last7Days();
    const weekSum = week.reduce((s, d) => s + (d.words || 0), 0);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };
    set('stat-books', D.projects.length);
    set('stat-words', APP.fmt(words));
    set('stat-streak', APP.store.streakDays() + ' <span style="font-size:12px;font-weight:400">天</span>');
    set('stat-week', APP.fmt(weekSum) + ' <span style="font-size:12px;font-weight:400">字</span>');
    /* 本周趋势迷你图 */
    const chart = document.getElementById('week-chart');
    if (chart) {
      const max = Math.max(1, ...week.map(d => d.words));
      chart.innerHTML = week.map(d => {
        const h = Math.max(3, d.words / max * 46);
        return `<div class="bar-col" title="${d.date}：${d.words.toLocaleString()} 字">
          <div class="bar-val" style="height:${h}px;${d.words > 0 ? 'background:linear-gradient(180deg,var(--sun),var(--peach));' : ''}"></div>
          <div class="bar-label">${d.label}</div>
        </div>`;
      }).join('');
    }
    const ws = document.getElementById('week-summary');
    if (ws) {
      const wrote = week.filter(d => d.words > 0).length;
      ws.textContent = '本周写作 ' + wrote + ' / 7 天 · 连续 ' + APP.store.streakDays() + ' 天';
    }
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
    /* 记录上次写到位置 */
    p.lastChapter = D.current.chapterTitle;
    APP.store.save();
    location.href = 'workspace.html';
  }

  /* ---------- 项目卡片（搜索 / 状态 / 题材过滤 + 排序） ---------- */
  function sortedProjects() {
    const q = state.q.trim().toLowerCase();
    const arr = D.projects.slice().filter(p => {
      if (state.status && (p.status || '') !== state.status) return false;
      if (state.genre && (p.genre || '') !== state.genre) return false;
      if (q && !((p.title || '').toLowerCase().includes(q) || (p.genre || '').toLowerCase().includes(q))) return false;
      return true;
    });
    if (sortMode === 'words') arr.sort((a, b) => (b.words || 0) - (a.words || 0));
    else if (sortMode === 'progress') arr.sort((a, b) => (b.progress || 0) - (a.progress || 0));
    else arr.sort((a, b) => new Date(b.touchedAt || b.createdAt || 0) - new Date(a.touchedAt || a.createdAt || 0));
    return arr;
  }

  /* 导出全书（逐章从 bundle 拉正文，适配章节懒加载） */
  async function exportProject(p) {
    APP.store.useProject(p.id);
    for (const v of D.volumes) {
      for (const b of v.beats || []) {
        if (!Array.isArray(b.paras) || !b.paras.length) {
          await APP.store.loadChapterBundle(p.id, v.id, b.id);
        }
      }
    }
    let md = '# ' + p.title + '\n\n> 题材：' + (p.genre || '未分类') + ' · 由 晴笺 · AI 小说创作台 导出\n';
    D.volumes.forEach(v => {
      md += '\n## ' + v.title + '\n';
      (v.beats || []).forEach(b => {
        md += '\n### 第' + b.no + '章 · ' + b.title + '\n';
        (b.paras || []).forEach(x => { md += '\n' + x.text; });
        if (!b.paras || !b.paras.length) md += '\n（本章暂无正文）';
      });
    });
    for (const v of D.volumes) {
      for (const b of v.beats || []) { b.paras = []; }
    }
    APP.downloadText(p.title + '_全书.md', md, 'text/markdown');
    APP.toast('《' + p.title + '》已导出', 'success');
  }

  function renderGrid() {
    root.innerHTML = '';
    const list = sortedProjects();
    const countEl = document.getElementById('lib-count');
    if (countEl) countEl.textContent = list.length;

    /* 空状态引导（无作品 或 筛选无结果） */
    if (!D.projects.length) {
      root.insertAdjacentHTML('beforeend', `
        <div class="card card-pad empty" style="grid-column:1/-1;padding:46px 24px;text-align:center">
          <p class="t" style="font-size:17px">还没有任何作品</p>
          <p class="d">从世界观设定开始，或直接开写第一部小说。</p>
          <div class="flex gap-6" style="margin-top:16px;justify-content:center">
            <button class="btn btn-primary" id="btn-empty-new">＋ 新建作品</button>
            <button class="btn btn-ghost" id="btn-empty-restore">从备份恢复</button>
          </div>
        </div>`);
      const bn = document.getElementById('btn-empty-new');
      if (bn) bn.addEventListener('click', openNewModal);
      const br = document.getElementById('btn-empty-restore');
      if (br) br.addEventListener('click', () => location.href = 'profile.html');
      return;
    }
    if (!list.length) {
      root.insertAdjacentHTML('beforeend', '<div class="card card-pad empty" style="grid-column:1/-1;padding:36px 24px;text-align:center"><p class="t">没有匹配的作品</p><p class="d">换个关键词或清除筛选条件试试。</p><button class="btn btn-ghost" id="btn-clear-filter">清除筛选</button></div>');
      const cf = document.getElementById('btn-clear-filter');
      if (cf) cf.addEventListener('click', () => {
        state.q = ''; state.status = ''; state.genre = '';
        document.getElementById('lib-search').value = '';
        document.getElementById('lib-filter-status').value = '';
        document.getElementById('lib-filter-genre').value = '';
        renderGrid();
      });
      return;
    }

    list.forEach(p => {
      const tagColor = p.status === '连载中' ? 'tag-sun' : p.status === '完结' ? 'tag-mint' : 'tag-mute';
      const last = p.lastChapter || '尚未开始';
      const card = APP.el(`
        <article class="book-card" data-id="${p.id}">
          <div class="book-cover">
            <img src="${p.cover}" alt="${APP.esc(p.title)} 封面" loading="lazy" onerror="this.onerror=null;this.src='assets/img/cover-window.jpg'">
            <div class="overlay"></div>
            <button class="book-cover-btn" data-cover="${p.id}" title="生成 / 更换封面">${APP.icon('image')}</button>
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
            <div class="small muted mt-8" style="font-size:11px">上次写到：${APP.esc(last)} · 目标 ${APP.fmt(p.targetWords || 0)} 字</div>
            <div class="flex gap-6 mt-8" style="flex-wrap:wrap">
              <a class="chip chip-mini" href="outline.html" data-nav="大纲">大纲</a>
              <button class="chip chip-mini" data-nav="export">导出</button>
              <a class="chip chip-mini" href="workspace.html" data-nav="write" style="color:var(--sun);font-weight:600">继续写 →</a>
            </div>
          </div>
        </article>`);
      card.addEventListener('click', e => {
        const nav = e.target.closest('[data-nav]');
        if (nav) {
          e.preventDefault(); e.stopPropagation();
          if (nav.dataset.nav === 'export') { exportProject(p); return; }
          /* 大纲 / 继续写：先物化项目再跳转 */
          APP.store.useProject(p.id);
          APP.store.save();
          location.href = nav.getAttribute('href') || 'workspace.html';
          return;
        }
        if (e.target.closest('[data-cover]')) {
          e.stopPropagation();
          const id = e.target.closest('[data-cover]').dataset.cover;
          openCoverModal(id);
          return;
        }
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

  /* ---------- 封面生成：AI 生成 / 本地上传 / 恢复默认 ---------- */
  const DEFAULT_COVER = 'assets/img/cover-window.jpg';

  /* 图片压成 16/9 小 JPEG（限宽 800px），避免撑大存档 */
  function compressCover(src, cb) {
    const img = new Image();
    img.onload = () => {
      const W = 800, H = Math.max(1, Math.round(W / (16 / 9)));
      const cv = document.createElement('canvas');
      /* 居中裁切为 16/9 后缩放 */
      const scale = Math.max(W / img.width, H / img.height);
      const sw = img.width * scale, sh = img.height * scale;
      cv.width = W; cv.height = H;
      cv.getContext('2d').drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
      cb(cv.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => cb(null);
    img.src = src;
  }

  function openCoverModal(pid) {
    const p = D.projects.find(x => x.id === pid);
    if (!p) return;
    let preview, genBtn, upBtn, resetBtn, hint, fileInput;
    const m = APP.modal({
      title: '作品封面 · 《' + p.title + '》',
      submitText: '完成',
      bodyHtml: `
        <div style="text-align:center">
          <div class="book-cover" style="max-width:360px;margin:0 auto 12px;border-radius:var(--r-md);box-shadow:var(--shadow-card)">
            <img id="cv-preview" src="${p.cover || DEFAULT_COVER}" alt="封面预览" style="width:100%;aspect-ratio:16/9;object-fit:cover" onerror="this.onerror=null;this.src='${DEFAULT_COVER}'">
          </div>
          <div class="small muted" id="cv-hint"></div>
          <div class="flex gap-6" style="justify-content:center;flex-wrap:wrap;margin-top:14px">
            <button class="btn btn-primary" id="cv-gen">✨ AI 生成封面</button>
            <button class="btn btn-ghost" id="cv-up">⤒ 本地上传</button>
            <button class="btn btn-soft" id="cv-reset">恢复默认</button>
          </div>
          <input type="file" id="cv-file" accept="image/*" style="display:none">
        </div>`,
      onSubmit: () => true
    });
    preview = m.root.querySelector('#cv-preview');
    genBtn = m.root.querySelector('#cv-gen');
    upBtn = m.root.querySelector('#cv-up');
    resetBtn = m.root.querySelector('#cv-reset');
    hint = m.root.querySelector('#cv-hint');
    fileInput = m.root.querySelector('#cv-file');

    const applyCover = (dataUrl, note) => {
      APP.store.updateProject(p.id, { cover: dataUrl });
      p.cover = dataUrl;
      preview.src = dataUrl;
      if (hint) hint.textContent = note;
      renderGrid();
    };

    genBtn.addEventListener('click', async () => {
      genBtn.disabled = true; genBtn.textContent = '生成中…';
      try {
        const r = await APP.ai.generateImage({
          prompt: '小说封面插画（16:9 横版）：《' + p.title + '》' + (p.genre ? '，题材' + p.genre + '。' : '。') +
            '整体氛围契合' + (p.status || '创作') + '主题，暖色调治愈系、柔和光影、层次细腻、具有故事感，适合作为小说封面，不放大段文字。'
        });
        if (r && r.dataUrl) {
          compressCover(r.dataUrl, (small) => {
            if (small) {
              applyCover(small, r.demo ? '已生成演示封面（本机配置画图渠道后生成真实封面）' : '封面已更新');
            } else { APP.toast('封面处理失败', 'warn'); }
          });
        }
      } catch (e) { APP.toast('封面生成失败：' + e.message, 'warn'); }
      genBtn.disabled = false; genBtn.textContent = '✨ AI 生成封面';
    });

    upBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => compressCover(rd.result, (small) => {
        if (small) applyCover(small, '封面已更新');
        else APP.toast('图片读取失败', 'warn');
      });
      rd.readAsDataURL(f);
    });

    resetBtn.addEventListener('click', () => applyCover(DEFAULT_COVER, '已恢复默认封面'));
  }

  APP.__coverModal = openCoverModal;

  /* ---------- 搜索 / 筛选 ---------- */
  const searchInput = document.getElementById('lib-search');
  if (searchInput) searchInput.addEventListener('input', APP.debounce(() => { state.q = searchInput.value; renderGrid(); }, 160));
  const stSel = document.getElementById('lib-filter-status');
  if (stSel) stSel.addEventListener('change', () => { state.status = stSel.value; renderGrid(); });
  const genreSel = document.getElementById('lib-filter-genre');
  if (genreSel) {
    const genres = [...new Set(D.projects.map(p => p.genre).filter(Boolean))].sort();
    genreSel.innerHTML = '<option value="">全部题材</option>' + genres.map(g => `<option>${APP.esc(g)}</option>`).join('');
    genreSel.addEventListener('change', () => { state.genre = genreSel.value; renderGrid(); });
  }

  /* 排序切换 */
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

  /* 统计图标 */
  const statIcons = ['book', 'pen', 'calendar', 'chart'];
  document.querySelectorAll('#stat-books,#stat-words,#stat-streak,#stat-week').forEach((n, i) => {
    const box = n.parentElement.parentElement.querySelector('div:first-child');
    if (box) box.innerHTML = APP.icon(statIcons[i]);
  });

  /* 桌面端磁盘恢复就绪后刷新视图 */
  APP.store.onReady(() => { renderHero(); renderStats(); renderGrid(); });

  renderHero();
  renderStats();
  renderGrid();
})();

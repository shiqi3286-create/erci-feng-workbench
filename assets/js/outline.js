/* 晴笺 · 大纲管理页逻辑
 * 分卷列表 → 章节大纲卡片 → 卡片详情；支持 AI 生成大纲 / 新建分卷 / 生成正文
 */
(function () {
  const D = APP.store.init(window.DATA);
  let activeVol = D.current.volumeId || (D.volumes[0] && D.volumes[0].id);
  let activeBeat = (D.volumes.find(v => v.id === activeVol) || D.volumes[0])?.beats.find(b => b.status === 'writing')?.id || (D.volumes[0] && D.volumes[0].beats[0] && D.volumes[0].beats[0].id);

  const statusMap = { done: ['tag-mint', '已完结'], writing: ['tag-sun', '写作中'], todo: ['tag-mute', '待写'] };

  /* ---------- 左：分卷列表 ---------- */
  function renderVols() {
    const list = document.getElementById('vol-list');
    list.innerHTML = '';
    D.volumes.forEach(v => {
      const pct = v.chapters ? Math.round(v.done / v.chapters * 100) : 0;
      const item = APP.el(`
        <div class="vol-item ${v.id === activeVol ? 'active' : ''}" data-v="${v.id}">
          <div class="row">
            <span class="mono" style="width:26px;color:var(--sun);font-weight:700">V${v.title.replace(/^第.卷\s*·\s*/, '').replace(/[^0-9]/g, '') || '·'}</span>
            <span class="grow">${APP.esc(v.title)}</span>
            <span class="small muted mono">${v.done}/${v.chapters}</span>
          </div>
          <div class="vol-progress"><div class="progress"><i style="width:${pct}%"></i></div></div>
        </div>`);
      item.addEventListener('click', () => {
        activeVol = v.id;
        activeBeat = v.beats.find(b => b.status === 'writing')?.id || v.beats[0]?.id || null;
        renderVols(); renderBeats();
      });
      list.appendChild(item);
    });
  }

  /* ---------- 中：章节大纲卡片 ---------- */
  function renderBeats() {
    const vol = D.volumes.find(v => v.id === activeVol);
    if (!vol) return;
    document.getElementById('vol-title').textContent = vol.title;
    document.getElementById('vol-stat').textContent = `共 ${vol.chapters} 章 · 已完成 ${vol.done} 章`;
    const col = document.getElementById('beat-col');
    col.innerHTML = '';

    if (!vol.beats.length) {
      col.appendChild(APP.el(`
        <div class="empty">
          <p class="t">本卷还没有章节大纲</p>
          <p class="d">点击「AI 生成大纲」自动生成，或手动新建章节。</p>
        </div>`));
      return;
    }

    vol.beats.forEach((b, i) => {
      const [cls, label] = statusMap[b.status] || statusMap.todo;
      const hasBody = b.paras && b.paras.length;
      const card = APP.el(`
        <article class="beat-card ${b.id === activeBeat ? 'active' : ''}" data-b="${b.id}" style="${b.id === activeBeat ? 'box-shadow:0 0 0 3px rgba(232,155,84,.2),var(--shadow-card)' : ''}">
          <div class="row1">
            <span class="no">${b.no}</span>
            <span class="t">${APP.esc(b.title)}</span>
            <span class="spacer"></span>
            <span class="tag ${cls}">${label}</span>
          </div>
          <p class="sum">${APP.esc(b.sum)}</p>
          <div class="row3">
            <span class="chars">${b.chars.map(c => {
              const ch = D.characters.find(x => x.name === c);
              return `<span class="portrait" style="background:${ch ? ch.color : 'linear-gradient(135deg,#ccc,#aaa)'}" title="${APP.esc(c)}">${c.slice(0,1)}</span>`;
            }).join('')}</span>
            ${b.fs.map(f => `<span class="tag tag-peach">伏笔 · ${APP.esc(f)}</span>`).join('')}
            ${hasBody ? '<span class="tag tag-mint">有正文</span>' : ''}
            <span class="spacer"></span>
            <button class="chip btn-sm" data-go="${b.id}" style="${b.status === 'writing' ? 'border-color:var(--sun);color:#A86A2B' : ''}">${hasBody || b.status === 'writing' ? '继续写作 →' : '生成正文'}</button>
          </div>
        </article>`);
      card.addEventListener('click', e => {
        if (e.target.closest('[data-go]')) {
          openBeatInWorkspace(b);
          return;
        }
        activeBeat = b.id;
        renderBeats(); renderDetail(b, i + 1);
      });
      col.appendChild(card);
    });
  }

  function openBeatInWorkspace(b) {
    const vol = D.volumes.find(v => v.id === activeVol);
    D.current = {
      projectId: D.current.projectId,
      volumeId: activeVol,
      chapterId: b.id,
      chapterTitle: '第' + b.no + '章 · ' + b.title,
      chapterWords: (b.paras || []).reduce((s, x) => s + (x.text || '').length, 0),
      chapterOrder: +b.no,
      modifiedCount: b.modifiedCount || 0
    };
    APP.store.save();
    location.href = 'workspace.html';
  }

  /* ---------- 右：详情面板 ---------- */
  function renderDetail(b, idx) {
    const pane = document.getElementById('beat-detail');
    if (!b) {
      pane.innerHTML = '<div class="empty"><p class="t">选中一张大纲卡片</p><p class="d">查看本章目标、关键事件与伏笔，或直接生成正文</p></div>';
      return;
    }
    const [cls, label] = statusMap[b.status] || statusMap.todo;
    const branches = b.branches || [];
    pane.innerHTML = `
      <div class="h">
        <span class="mono" style="color:var(--sun);font-weight:700;font-size:13px">${b.no}</span>
        <span class="t">${APP.esc(b.title)}</span>
        <span class="spacer" style="flex:1"></span>
        <span class="tag ${cls}">${label}</span>
      </div>
      <p class="small muted">${APP.esc(b.sum)}</p>

      <div class="sec">
        <div class="st">出场人物</div>
        <div class="flex gap-6" style="flex-wrap:wrap">
          ${b.chars.length ? b.chars.map(c => `<span class="tag tag-sun">${APP.esc(c)}</span>`).join('') : '<span class="small muted">未指定</span>'}
        </div>
      </div>
      <div class="sec">
        <div class="st">本章伏笔</div>
        <div class="flex gap-6" style="flex-wrap:wrap">
          ${b.fs.length ? b.fs.map(f => `<span class="tag tag-peach">${APP.esc(f)}</span>`).join('') : '<span class="small muted">未埋设</span>'}
        </div>
      </div>
      <div class="sec">
        <div class="st">AI 操作</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-primary btn-block" id="btn-detail-body">${(b.paras && b.paras.length) ? '去写作区继续写' : '生成本章正文'}</button>
          <button class="btn btn-ghost btn-block" id="btn-detail-expand">扩写大纲卡片</button>
          <button class="btn btn-ghost btn-block" id="btn-detail-branch">生成剧情分支</button>
        </div>
      </div>
      ${branches.length ? `<div class="sec"><div class="st">剧情分支</div><div class="fs-list">${branches.map(x => `<div class="fs-item"><span class="dot" style="background:var(--lilac)"></span><span>${APP.esc(x)}</span></div>`).join('')}</div></div>` : ''}
      <div class="sec">
        <div class="st">校验</div>
        <div class="fs-list">
          <div class="fs-item"><span class="dot" style="background:var(--mint)"></span><span>本章与上一章大纲无冲突</span></div>
          <div class="fs-item"><span class="dot" style="background:var(--sun)"></span><span>检测到 ${Math.min(2, D.foreshadows.filter(f => f.status === 'open').length)} 条待回收伏笔可呼应</span></div>
        </div>
      </div>`;

    $('#btn-detail-body').addEventListener('click', () => {
      if (b.paras && b.paras.length) { openBeatInWorkspace(b); return; }
      genChapterBody(b);
    });
    $('#btn-detail-expand').addEventListener('click', () => expandBeat(b));
    $('#btn-detail-branch').addEventListener('click', () => genBranches(b));
  }

  /* ---------- 动作实现 ---------- */
  function genViaAI(prompt, { system, onDelta }) {
    return APP.ai.complete({ parts: [], user: prompt, system, onDelta, forceDemo: false });
  }

  async function genChapterBody(b) {
    const btn = $('#btn-detail-body');
    btn.textContent = '生成中…'; btn.disabled = true;
    APP.toast('正在生成本章正文…', '');
    try {
      const text = await genViaAI(
        `根据以下章节大纲生成本章正文（约 800~1200 字，细腻治愈、慢热叙事）：
标题：${b.title}
概要：${b.sum}
出场人物：${(b.chars || []).join('、')}
埋设伏笔：${(b.fs || []).join('、')}`, {
          system: '你是一位资深小说家，写作风格细腻治愈。只输出正文，段落之间用空行分隔，不要任何说明。'
        });
      const paras = text.trim().split(/\n+/).map(x => ({ cls: 'ai-mark', text: x.trim() })).filter(x => x.text);
      APP.store.updateBeat(activeVol, b.id, { paras, status: 'writing' });
      APP.toast('正文已生成，进入写作区精修', 'success');
      openBeatInWorkspace(b);
    } catch (e) {
      APP.toast('生成失败：' + e.message, 'warn');
      btn.textContent = '生成本章正文'; btn.disabled = false;
    }
  }

  async function expandBeat(b) {
    const btn = $('#btn-detail-expand');
    btn.textContent = '扩写中…'; btn.disabled = true;
    try {
      const text = await genViaAI(`请扩写以下章节大纲卡片，输出结构化的标题、目标、关键事件、关键人物、埋设伏笔、结尾悬念：
当前概要：${b.sum}
标题：${b.title}`, { system: '你是一位小说大纲编辑。用简洁的中文条目输出，便于直接阅读。' });
      APP.store.updateBeat(activeVol, b.id, { sum: text.trim() });
      renderBeats(); renderDetail(b);
      APP.toast('大纲已扩写', 'success');
    } catch (e) {
      APP.toast('扩写失败：' + e.message, 'warn');
      btn.textContent = '扩写大纲卡片'; btn.disabled = false;
    }
  }

  async function genBranches(b) {
    const btn = $('#btn-detail-branch');
    btn.textContent = '生成中…'; btn.disabled = true;
    try {
      const text = await genViaAI(`基于本章大纲生成 3 条可能的剧情分支（每条一句话，编号），供作者选择：
标题：${b.title}　概要：${b.sum}`, { system: '你是一位故事策划。输出简洁的三条分支，每条一行。' });
      const lines = text.trim().split(/\n+/).map(x => x.replace(/^[0-9\.\s、）)]+/, '')).filter(x => x).slice(0, 3);
      const branches = (b.branches || []).concat(lines).slice(0, 6);
      APP.store.updateBeat(activeVol, b.id, { branches });
      renderDetail(b);
      APP.toast('已生成剧情分支', 'success');
    } catch (e) {
      APP.toast('生成失败：' + e.message, 'warn');
      btn.textContent = '生成剧情分支'; btn.disabled = false;
    }
  }

  /* 新建分卷 */
  document.getElementById('btn-add-vol').addEventListener('click', () => {
    APP.modal({
      title: '新建分卷',
      submitText: '创建',
      bodyHtml: `<div class="field"><label>分卷标题</label><input class="input" name="title" placeholder="例如：第三卷 · 百年前的雪"></div>`,
      onSubmit: (root) => {
        const f = APP.formData(root);
        if (!f.title.trim()) { APP.toast('请填写分卷标题', 'warn'); return false; }
        activeVol = APP.store.addVolume(f.title.trim());
        activeBeat = null;
        renderVols(); renderBeats(); renderDetail(null);
        APP.toast('已新建分卷', 'success');
        return true;
      }
    });
  });

  /* AI 生成大纲（当前空卷） */
  document.getElementById('btn-gen-vol').addEventListener('click', async () => {
    const vol = D.volumes.find(v => v.id === activeVol);
    if (!vol) return;
    if (vol.beats.length) { APP.toast('本卷已有大纲，可先新建一个空分卷再生成', 'warn'); return; }
    const btn = document.getElementById('btn-gen-vol');
    btn.textContent = '生成中…'; btn.disabled = true;
    APP.toast('AI 正在生成大纲…', '');
    try {
      const p = APP.store.currentProject();
      const text = await genViaAI(`请为小说《${p ? p.title : '星落之森'}》的第「${vol.title}」卷生成 6 章章节大纲。
要求：每章一行，格式为「章节标题 —— 一句话概要」。世界观为奇幻治愈，细腻慢热叙事。`, {
        system: '你是一位小说大纲策划。输出简洁的中文章节列表，每行一章。'
      });
      const lines = text.trim().split(/\n+/).map(x => x.replace(/^第[0-9一二三四五六七八九十]+章[\s·:：]?/, '').replace(/^[0-9一二三四五六七八九十]+[\.、\s]/, '')).filter(x => x).slice(0, 8);
      lines.forEach(line => {
        const [t, ...rest] = line.split(/——|-{2,}|：/, 2);
        const title = (t || '未命名').trim();
        const sum = (rest[0] || '').trim();
        APP.store.addBeat(activeVol, { title, sum });
      });
      const nv = D.volumes.find(v => v.id === activeVol);
      activeBeat = nv && nv.beats[0] && nv.beats[0].id;
      renderVols(); renderBeats();
      APP.toast('大纲已生成 ' + lines.length + ' 章', 'success');
    } catch (e) {
      APP.toast('生成失败：' + e.message, 'warn');
    }
    btn.textContent = 'AI 生成大纲'; btn.disabled = false;
  });

  /* 排序 */
  document.getElementById('btn-sort').addEventListener('click', () => {
    const vol = D.volumes.find(v => v.id === activeVol);
    if (!vol) return;
    vol.beats.sort((a, b) => +a.no - +b.no);
    vol.beats.forEach((b, i) => { b.no = String(i + 1).padStart(2, '0'); });
    APP.store.save();
    renderBeats();
    APP.toast('已按章节顺序排序', 'success');
  });

  /* ---------- 启动 ---------- */
  const firstVol = D.volumes.find(v => v.id === activeVol) || D.volumes[0];
  renderVols();
  renderBeats();
  renderDetail(firstVol && firstVol.beats.find(b => b.id === activeBeat) || (firstVol && firstVol.beats[0]), 1);
})();
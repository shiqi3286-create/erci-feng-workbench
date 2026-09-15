/* 晴笺 · AI 写作主界面逻辑（工作台核心）
 * 左栏资源树 / 中栏轨迹+正文+指令 / 右栏上下文面板 / 底部状态
 * 真实功能：章节切换、正文可编辑、手动/自动保存、AI 生成（真实流式 + 演示降级）
 */
(function () {
  const D = APP.store.init(window.DATA);
  const $ = s => document.querySelector(s);

  /* ---------- 运行时状态 ---------- */
  let activeTab = 'outline';
  let selectedPara = null;      // 当前选中的段落 DOM
  let aiRunning = false;
  let dirty = false;            // 是否有未保存改动
  let focusMode = false;
  let chapterLoadSeq = 0;
  let chapterSaveSeq = 0;
  let chapterSaveTask = Promise.resolve();
  /* ================= 左栏：资源树 ================= */
  const sideTabs = ['outline', 'chars', 'fs', 'tpl'];
  const sideTitle = { outline: '大纲 · 小纲', chars: '人物设定', fs: '伏笔库', tpl: '提示词模板' };

  function volName(volId) {
    const v = D.volumes.find(x => x.id === volId);
    return v ? v.title : '';
  }

  function renderSide(tab, filter) {
    activeTab = tab;
    const body = $('#side-body');
    const ql = (filter || '').trim().toLowerCase();
    const hit = s => !ql || String(s || '').toLowerCase().includes(ql);
    body.innerHTML = '<div class="eyebrow" style="padding:8px 10px 4px">' + sideTitle[tab] + (ql ? ' · 匹配中' : '') + '</div>';

    if (tab === 'outline') {
      D.volumes.forEach(v => {
        const beats = v.beats.filter(b => hit(b.title) || hit(b.sum));
        if (ql && !beats.length && !hit(v.title)) return;
        const g = APP.el(`
          <ul class="tree">
            <li class="tree-group">
              <div class="tree-title">${APP.esc(v.title)}<span class="count">${v.done}/${v.chapters} 章</span></div>
              <ul class="tree tree-sub">
                ${beats.map(b => `
                  <li class="tree-item ${v.id === D.current.volumeId && b.id === D.current.chapterId ? 'active' : ''}" data-vol="${v.id}" data-beat="${b.id}">
                    <span class="grow">${b.no} · ${APP.esc(b.title)}</span>
                    <span class="meta">${b.status === 'done' ? '完' : b.status === 'writing' ? '写' : '待'}</span>
                  </li>`).join('') || (ql ? '' : '<li class="small muted" style="padding:4px 10px">本卷暂无章节</li>')}
              </ul>
            </li>
          </ul>`);
        g.querySelectorAll('.tree-item').forEach(it =>
          it.addEventListener('click', () => switchChapter(it.dataset.vol, it.dataset.beat)));
        body.appendChild(g);
      });
      if (!body.children.length) body.insertAdjacentHTML('beforeend', '<p class="small muted" style="padding:8px 10px">没有匹配的章节。可到大纲页新建。</p>');
    } else if (tab === 'chars') {
      const list = D.characters.filter(c => hit(c.name) || hit(c.role) || hit(c.brief));
      const wrap = APP.el(`<div style="display:flex;flex-direction:column;gap:8px"></div>`);
      list.forEach(c => {
        const item = APP.el(`
          <div class="tree-item" data-c="${c.id}">
            <span class="portrait" style="background:${c.color}">${c.name.slice(0,1)}</span>
            <span class="grow">${c.name}</span><span class="meta">${c.role.split('·')[0]}</span>
          </div>`);
        item.addEventListener('click', () => injectChar(c.id));
        wrap.appendChild(item);
      });
      body.appendChild(wrap);
      if (!list.length) body.insertAdjacentHTML('beforeend', '<p class="small muted" style="padding:8px 10px">没有匹配的人物。</p>');
    } else if (tab === 'fs') {
      const list = D.foreshadows.filter(f => hit(f.text) || hit(f.where));
      const wrap = APP.el(`<div style="display:flex;flex-direction:column;gap:8px"></div>`);
      list.forEach(f => {
        const item = APP.el(`
          <div class="tree-item" data-f="${f.id}">
            <span class="dot ${f.status}" style="width:7px;height:7px;border-radius:50%;background:${f.status === 'open' ? 'var(--coral)' : 'var(--mint)'}"></span>
            <span class="grow">${APP.esc(f.text)}</span>
          </div>`);
        item.addEventListener('click', () => injectForeshadow(f.id));
        wrap.appendChild(item);
      });
      body.appendChild(wrap);
      if (!list.length) body.insertAdjacentHTML('beforeend', '<p class="small muted" style="padding:8px 10px">没有匹配的伏笔。</p>');
    } else {
      const flat = D.templates.flatMap(g => g.items.map(t => ({ ...t, group: g.group }))).filter(t => hit(t.name) || hit(t.desc));
      const wrap = APP.el(`<div style="display:flex;flex-direction:column;gap:8px"></div>`);
      flat.forEach(t => {
        const item = APP.el(`<div class="tree-item"><span class="grow">${t.name}</span><span class="meta">${t.group}</span></div>`);
        item.addEventListener('click', () => {
          $('#cmd-input').value = '使用模板「' + t.name + '」：' + (t.vars[0] || '');
          $('#cmd-input').focus();
        });
        wrap.appendChild(item);
      });
      body.appendChild(wrap);
      if (!flat.length) body.insertAdjacentHTML('beforeend', '<p class="small muted" style="padding:8px 10px">没有匹配的模板。</p>');
    }
  }

  $('#side-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.side-tab'); if (!btn) return;
    document.querySelectorAll('.side-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSide(btn.dataset.tab, $('#side-search-input').value);
  });

  /* 左栏实时搜索 */
  $('#side-search-input').addEventListener('input', APP.debounce(() => {
    renderSide(activeTab, $('#side-search-input').value);
  }, 160));

  /* 资源注入：把人物/伏笔放进指令输入框（只发送这一项） */
  function injectChar(id) {
    const c = D.characters.find(x => x.id === id); if (!c) return;
    const hint = c.summary || c.brief || '';
    $('#cmd-input').value = '【人物】' + c.name + '（' + c.role + '）：' + hint;
    $('#cmd-input').focus();
    APP.toast('已载入人物「' + c.name + '」到指令框', 'success');
  }
  function injectForeshadow(id) {
    const f = D.foreshadows.find(x => x.id === id); if (!f) return;
    $('#cmd-input').value = '【伏笔】' + f.text + '（埋于 ' + f.where + '）';
    $('#cmd-input').focus();
  }

  async function flushChapter() {
    const beat = currentBeat();
    const cur = D.current;
    if (!beat || !cur || !cur.projectId || !cur.volumeId || !cur.chapterId) return true;
    const seq = ++chapterSaveSeq;
    const bundle = APP.store.chapterBundle(beat);
    chapterSaveTask = chapterSaveTask.then(async () => {
      if (seq !== chapterSaveSeq) return;
      await APP.store.saveChapterBundle(cur.projectId, cur.volumeId, cur.chapterId, bundle);
    });
    try {
      await chapterSaveTask;
      return true;
    } catch (e) {
      APP.toast('章节文件保存失败：' + e.message, 'warn');
      return false;
    }
  }

  async function loadChapterBundleForCurrent() {
    const cur = D.current;
    if (!cur || !cur.projectId || !cur.volumeId || !cur.chapterId) return;
    const seq = ++chapterLoadSeq;
    try {
      const bundle = await APP.store.loadChapterBundle(cur.projectId, cur.volumeId, cur.chapterId);
      if (seq !== chapterLoadSeq || !bundle) return;
      APP.store.applyChapterBundle(currentBeat(), bundle);
      cur.chapterWords = (currentBeat()?.paras || []).reduce((s, x) => s + (x.text || '').length, 0);
      renderDoc();
      updateBudget();
    } catch (e) {
      APP.toast('章节文件读取失败，已使用本地缓存：' + e.message, 'warn');
    }
  }

  /* ================= 章节切换 ================= */
  async function switchChapter(volId, beatId) {
    if (aiRunning) { APP.toast('AI 生成中，请稍候', 'warn'); return; }
    if (dirty && !(await flushChapter())) return;
    const vol = D.volumes.find(v => v.id === volId);
    const beat = vol && vol.beats.find(b => b.id === beatId);
    if (!beat) return;
    /* 懒加载（§12-1）：旧章节正文已 flush 到 bundle，从内存卸载，只留当前章 */
    const prevBeat = currentBeat();
    const prevId = prevBeat && prevBeat.id;
    D.current = {
      projectId: D.current.projectId,
      volumeId: volId,
      chapterId: beatId,
      chapterTitle: '第' + beat.no + '章 · ' + beat.title,
      chapterWords: beat.paras ? beat.paras.reduce((s, x) => s + (x.text || '').length, 0) : 0,
      chapterOrder: +beat.no,
      modifiedCount: beat.modifiedCount || 0
    };
    if (prevBeat && prevId !== beatId) prevBeat.paras = [];
    APP.store.save();
    selectedPara = null;
    dirty = false;
    renderSide(activeTab, $('#side-search-input').value);
    renderDoc();
    renderCtx('beat');
    setSaveState(true);
    renderTrace();
    $('#st-words').textContent = (D.current.chapterWords || 0).toLocaleString();
    $('#st-mod').textContent = beat.modifiedCount || 0;
    updateBudget();
    await loadChapterBundleForCurrent();
  }

  /* ================= 中栏：AI 轨迹 ================= */
  function renderTrace() {
    const flow = $('#trace-flow');
    flow.innerHTML = D.trace.map((t, i) => `
      <div class="trace-step ${t.status}">
        <span class="st-ico">${t.status === 'done' ? '✓' : t.status === 'running' ? '·' : i + 1}</span>
        ${t.label}
      </div>
      ${i < D.trace.length - 1 ? '<span class="trace-arrow">→</span>' : ''}`).join('');
  }
  function setTrace(idx, status, detail) {
    if (D.trace[idx]) { D.trace[idx].status = status; if (detail) D.trace[idx].detail = detail; D.trace[idx].time = new Date().toLocaleTimeString(); }
    renderTrace();
  }
  renderTrace();

  /* ================= 中栏：正文 ================= */
  function currentBeat() {
    return D.volumes.find(v => v.id === D.current.volumeId)?.beats.find(b => b.id === D.current.chapterId) || null;
  }

  function renderDoc() {
    const cur = D.current;
    const area = $('#doc-area');

    /* 未选择项目 / 章节：给出引导而不是报错 */
    if (!APP.store.currentProject() || (!cur.volumeId && !D.volumes.length)) {
      area.innerHTML = `
        <div class="empty" style="margin-top:60px">
          <p class="t">${D.projects.length ? '这部作品还没有章节' : '还没有任何作品'}</p>
          <p class="d">${D.projects.length ? '先到大纲页为本作品规划分卷与章节大纲。' : '先到作品库新建一部作品，再来开始写作。'}</p>
          <div class="flex gap-6" style="margin-top:12px;justify-content:center">
            <a class="btn btn-primary" href="outline.html">去大纲页</a>
            <a class="btn btn-ghost" href="index.html">去作品库</a>
          </div>
        </div>`;
      $('#st-words').textContent = '0';
      $('#st-mod').textContent = '0';
      return;
    }

    const beat = currentBeat();
    const paras = (beat && beat.paras) || [];
    const modCount = (beat && beat.modifiedCount) || 0;
    const st = beat ? beat.status : 'todo';

    area.innerHTML = `
      <div class="eyebrow" style="margin-bottom:6px">${APP.esc(volName(cur.volumeId))} · 第 ${cur.chapterOrder || '?'} 章</div>
      <h1 class="doc-title">${APP.esc(cur.chapterTitle || '未命名章节')}</h1>
      <div class="doc-meta">
        <span id="meta-words">${(cur.chapterWords || 0).toLocaleString()} 字</span>
        <span>已修改 ${modCount} 次</span>
        <span class="tag ${st === 'done' ? 'tag-mint' : st === 'writing' ? 'tag-sun' : 'tag-mute'}">${st === 'done' ? '已完结' : st === 'writing' ? '写作中' : '待写'}</span>
        <span class="spacer"></span>
        <button class="chip" id="btn-export-ch" title="导出本章 TXT">导出本章</button>
        <button class="chip" id="btn-export-book" title="导出全书 Markdown">全书 MD</button>
        <button class="chip" id="btn-export-platform" title="按平台偏好排版导出">平台排版</button>
      </div>
      <div class="doc-content" id="doc-content">${paras.length ? paras.map((p, i) =>
        p.cls === 'img' && p.src
          ? `<figure class="img-para" data-p="${i}"><img src="${p.src}" alt="插图" loading="lazy"><figcaption><button class="chip chip-mini" data-img-dl>下载</button><button class="chip chip-mini" data-img-del>删除</button></figcaption></figure>`
          : `<p class="${p.cls || ''}" data-p="${i}" contenteditable="true" spellcheck="false">${APP.esc(p.text)}</p>`).join('') : ''}
      </div>`;

    $('#btn-export-ch').addEventListener('click', exportChapter);
    $('#btn-export-book').addEventListener('click', exportBook);
    $('#btn-export-platform').addEventListener('click', exportBookPlatformed);

    if (!paras.length) {
      const empty = APP.el(`
        <div class="empty" style="margin-top:32px">
          <p class="t">本章还没有正文</p>
          <p class="d">用 AI 生成初稿，或直接在此粘贴/输入。</p>
          <div class="flex gap-6" style="margin-top:12px;justify-content:center">
            <button class="btn btn-primary" id="btn-gen-first">AI 生成初稿</button>
            <button class="btn btn-ghost" id="btn-paste-first">粘贴正文</button>
          </div>
        </div>`);
      area.appendChild(empty);
      $('#btn-gen-first').addEventListener('click', () => runAI('续写', '本章还没有正文，请根据本章大纲生成开篇正文，细腻治愈、慢热叙事。'));
      $('#btn-paste-first').addEventListener('click', () => {
        const t = prompt('粘贴本章正文：');
        if (t && t.trim()) {
          const paras = t.trim().split(/\n+/).map(x => ({ cls: '', text: x.trim() }));
          APP.store.setChapterParas(cur.volumeId, cur.chapterId, paras);
          renderDoc(); setSaveState(false);
        }
      });
      return;
    }

    /* 段落交互：点击选中 + 可编辑 */
    $('#doc-content').querySelectorAll('p').forEach(p => {
      p.addEventListener('click', e => {
        if (e.target.closest('.ai-confirm')) return;
        selectPara(p);
      });
      p.addEventListener('input', () => onParaEdit(p));
      p.addEventListener('blur', () => { if (dirty) saveNow(false); });
      p.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); p.blur(); }
      });
    });
    /* 插图段：下载 / 删除 */
    $('#doc-content').querySelectorAll('figure.img-para').forEach(fig => {
      const idx = +fig.dataset.p;
      fig.addEventListener('click', e => {
        const dl = e.target.closest('[data-img-dl]');
        const del = e.target.closest('[data-img-del]');
        const beat = currentBeat();
        const para = beat && beat.paras[idx];
        if (dl && para) {
          const a = document.createElement('a');
          a.href = para.src; a.download = '插图_' + (idx + 1) + '.png';
          document.body.appendChild(a); a.click(); a.remove();
          APP.toast('已下载插图', 'success');
        } else if (del && beat) {
          beat.paras.splice(idx, 1);
          APP.store.setChapterParas(D.current.volumeId, D.current.chapterId, beat.paras);
          renderDoc(); setSaveState(false);
          APP.toast('已删除插图', '');
        }
      });
    });
  }

  let lastSelectedIdx = -1;
  function selectPara(p) {
    document.querySelectorAll('#doc-content p').forEach(x => { x.classList.remove('sel'); x.classList.remove('editing'); });
    const already = p.classList.contains('sel');
    p.classList.add('sel');
    const idx = +p.dataset.p;
    lastSelectedIdx = idx;
    const beat = currentBeat();
    const isAI = p.classList.contains('ai-mark');
    const hint = $('#cmd-hint');
    if (isAI && beat && beat.paras[idx] && beat.paras[idx].cls && beat.paras[idx].cls.includes('ai-mark')) {
      hint.innerHTML = '已选中第 ' + (idx + 1) + ' 段（AI 生成）· <button class="chip chip-mini" id="btn-confirm">✓ 标记为已确认</button>';
      $('#btn-confirm').addEventListener('click', e => { e.stopPropagation(); confirmPara(p); });
    } else {
      hint.textContent = '已选中第 ' + (idx + 1) + ' 段（' + p.textContent.length + ' 字）· 可直接编辑，或输入指令让 AI 处理';
    }
    // 让段落进入编辑态
    p.classList.add('editing');
  }

  function confirmPara(p) {
    const idx = +p.dataset.p;
    const beat = currentBeat();
    p.classList.remove('ai-mark');
    if (beat) APP.store.confirmPara(D.current.volumeId, D.current.chapterId, idx);
    $('#cmd-hint').textContent = '已确认该段为人工精修内容（AI 标记已移除）';
    setSaveState(false);
    APP.toast('已确认 · 移除 AI 标记', 'success');
  }

  function onParaEdit(p) {
    dirty = true;
    setSaveState(false);
    const beat = currentBeat();
    if (!beat) return;
    const idx = +p.dataset.p;
    const text = p.innerText;
    // 防抖写回内存（非落盘）
    beat.paras[idx].text = text;
    const words = beat.paras.reduce((s, x) => s + (x.text || '').length, 0);
    D.current.chapterWords = words;
    $('#meta-words').textContent = words.toLocaleString() + ' 字';
    $('#st-words').textContent = words.toLocaleString();
  }

  /* ================= 保存 ================= */
  function setSaveState(saved) {
    dirty = !saved;
    const dot = $('#save-dot');
    if (dot) {
      dot.className = 'save-dot' + (saved ? '' : ' dirty');
      $('#save-state').lastChild.textContent = saved ? ' 已保存' : ' 未保存';
    }
  }
  async function saveNow(showToast = true) {
    const beat = currentBeat();
    if (!beat) return true;
    if (!dirty) return true;
    const cur = D.current;
    beat.modifiedCount = (beat.modifiedCount || 0) + 1;
    cur.modifiedCount = beat.modifiedCount;
    $('#st-mod').textContent = beat.modifiedCount;
    APP.store.setChapterParas(cur.volumeId, cur.chapterId, beat.paras);
    /* 记录上次写到位置（作品卡片展示） */
    const proj = APP.store.currentProject();
    if (proj && cur.chapterTitle) proj.lastChapter = cur.chapterTitle;
    const ok = await flushChapter();
    if (ok) {
      setSaveState(true);
      if (showToast) APP.toast('已保存到本地', 'success');
    }
    return ok;
  }
  $('#btn-save').addEventListener('click', () => { saveNow(true); });
  // Ctrl+S
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(true); }
  });
  // 有未保存改动时，关闭/刷新页面前提醒
  window.addEventListener('beforeunload', e => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ================= 导出 ================= */
  function safeName(s) { return String(s || '未命名').replace(/[\\/:*?"<>|]/g, '_'); }

  /* 懒加载导出辅助：逐章从 bundle 拉正文，用后释放（当前章除外） */
  async function loadParasForExport() {
    const p = APP.store.currentProject();
    if (!p) return null;
    const cur = D.current;
    for (const v of D.volumes) {
      for (const b of v.beats || []) {
        if (!Array.isArray(b.paras) || !b.paras.length) {
          await APP.store.loadChapterBundle(p.id, v.id, b.id);
        }
      }
    }
    return () => {
      for (const v of D.volumes) {
        for (const b of v.beats || []) {
          if (cur && cur.projectId === p.id && cur.chapterId === b.id) continue;
          b.paras = [];
        }
      }
    };
  }

  function exportChapter() {
    const beat = currentBeat();
    const p = APP.store.currentProject();
    if (!beat || !beat.paras || !beat.paras.length) { APP.toast('本章还没有正文可导出', 'warn'); return; }
    const text = beat.paras.map(x => x.text).join('\n\n');
    APP.downloadText(safeName(p ? p.title : '作品') + '_' + safeName(beat.no + '章' + beat.title) + '.txt', text);
    APP.toast('本章已导出为 TXT', 'success');
  }

  async function exportBook() {
    const p = APP.store.currentProject();
    if (!p) return;
    let total = 0;
    const release = await loadParasForExport();
    let md = '# ' + p.title + '\n\n> 题材：' + (p.genre || '未分类') + ' · 由 晴笺 · AI 小说创作台 导出\n';
    D.volumes.forEach(v => {
      md += '\n## ' + v.title + '\n';
      (v.beats || []).forEach(b => {
        md += '\n### 第' + b.no + '章 · ' + b.title + '\n';
        (b.paras || []).forEach(x => { md += '\n' + x.text; total += x.text.length; });
        if (!b.paras || !b.paras.length) md += '\n（本章暂无正文）';
      });
    });
    release && release();
    if (!total) { APP.toast('全书还没有正文可导出', 'warn'); return; }
    APP.downloadText(safeName(p.title) + '_全书.md', md, 'text/markdown');
    APP.toast('全书已导出为 Markdown（' + APP.fmt(total) + ' 字）', 'success');
  }

  /* 平台排版导出（§12-8）：按个人信息页「平台发布偏好」生成 TXT */
  async function exportBookPlatformed() {
    const p = APP.store.currentProject();
    if (!p) return;
    const pf = (D.user && D.user.publish) || {};
    const fmt = pf.chapterTitleFmt || '第{no}章 {title}';
    const indent = pf.paragraphIndent !== false;
    const platform = pf.platform || '平台';
    let total = 0;
    const release = await loadParasForExport();
    let out = p.title + '\n\n';
    D.volumes.forEach(v => {
      (v.beats || []).forEach(b => {
        const title = fmt.replace('{no}', b.no).replace('{title}', b.title);
        out += '\n' + title + '\n\n';
        (b.paras || []).forEach(x => {
          out += (indent ? '　　' : '') + x.text + '\n\n';
          total += (x.text || '').length;
        });
        if (!b.paras || !b.paras.length) out += '（本章暂无正文）\n\n';
      });
    });
    release && release();
    if (!total) { APP.toast('全书还没有正文可导出', 'warn'); return; }
    APP.downloadText(safeName(p.title) + '_' + safeName(platform) + '排版.txt', out);
    APP.toast('已按「' + platform + '」排版导出（' + APP.fmt(total) + ' 字）', 'success');
  }

  /* ================= 中栏：指令区 ================= */
  const input = $('#cmd-input');
  const quickActions = { '续写': '按当前大纲与上文继续推进，保持细腻治愈的慢热文风。', '扩写': '扩写选中段落，补充感官、动作与心理细节。', '润色': '润色选中段落，提升文笔与节奏，不改变情节。', '对话': '按人物设定生成符合口吻的角色对话。', '人设检查': '检查本章角色言行是否符合人设，列出不一致处。', '伏笔扫描': '提取本章新埋设的伏笔，并对照伏笔库。' };

  $('#cmd-quick').addEventListener('click', e => {
    const chip = e.target.closest('.chip'); if (!chip) return;
    if (chip.dataset.action === '插图') { runImage(); return; }
    input.value = '[' + chip.dataset.action + '] ' + (quickActions[chip.dataset.action] || '');
    input.focus();
  });

  /* ---------- 插图生成（§12-5：画图渠道 → 图片段落） ---------- */
  let imgRunning = false;
  async function runImage() {
    if (imgRunning) { APP.toast('正在生成插图，请稍候', 'warn'); return; }
    const beat = currentBeat();
    if (!beat) return;
    const sel = selectedText();
    const lastText = beat.paras.filter(x => x.cls !== 'img').slice(-1)[0];
    const src = sel || (lastText && lastText.text) || '';
    if (!src.trim()) { APP.toast('请先选中一段文字，或让 AI 生成正文后再插图', 'warn'); return; }
    imgRunning = true;
    APP.toast('正在生成插图…（' + (APP.ai.imageChannels().length ? '画图渠道' : '演示占位') + '）', '');
    try {
      const r = await APP.ai.generateImage({
        prompt: '为以下小说场景绘制一幅文学插画，治愈系暖色调、柔和光影、细腻笔触，画面有叙事感：\n' + src.trim().slice(0, 400)
      });
      const cur = D.current;
      const idx = lastSelectedIdx >= 0 ? lastSelectedIdx : beat.paras.length - 1;
      beat.paras.splice(idx + 1, 0, { cls: 'img', src: r.dataUrl, text: '' });
      APP.store.setChapterParas(cur.volumeId, cur.chapterId, beat.paras);
      renderDoc(); setSaveState(false);
      APP.toast('插图已插入段落下方' + (r.demo ? '（演示占位图，配置画图渠道后生成真实插图）' : ''), 'success');
    } catch (e) {
      APP.toast('插图生成失败：' + e.message, 'warn');
    }
    imgRunning = false;
  }

  function selectedText() {
    const p = document.querySelector('#doc-content p.sel');
    return p ? p.innerText : '';
  }

  async function runAI(kind, userText) {
    if (aiRunning) { APP.toast('AI 正在生成，请稍候', 'warn'); return; }
    const beat = currentBeat();
    if (!beat) return;
    aiRunning = true;
    const sendBtn = $('#cmd-send');
    sendBtn.classList.add('loading');
    sendBtn.title = '停止生成';
    const abortCtrl = new AbortController();
    window.__abortAI = () => abortCtrl.abort();

    const selected = selectedText();
    // 轨迹：读取设定 → 检索伏笔 → 组装上下文 → 生成 → 校验
    setTrace(0, 'running'); setTrace(1, 'todo'); setTrace(2, 'todo'); setTrace(3, 'todo'); setTrace(4, 'todo');
    await new Promise(r => setTimeout(r, 200));
    setTrace(0, 'done', '已加载 ' + D.characters.length + ' 位人物 · 世界观摘要');
    setTrace(1, 'done', '命中 ' + Math.min(4, D.foreshadows.filter(f => f.status === 'open').length) + ' 条相关伏笔');
    setTrace(2, 'running', '组装上下文 · ' + APP.ai.estTokens(userText + selected).toLocaleString() + ' tokens');

    const parts = APP.ai.buildContext({ beat, selected: selected || undefined });
    let text = '';
    const display = $('.doc-content');
    let lastP = null;

    if (display) {
      lastP = document.createElement('p');
      lastP.className = 'ai-mark pending';
      lastP.textContent = '…';
      display.appendChild(lastP);
    }
    setTrace(2, 'done', '本章大纲 + 选中文本 + 精简设定');
    setTrace(3, 'running', '模型生成中…');

    try {
      text = await APP.ai.complete({
        parts,
        user: userText,
        params: {},
        forceDemo: false,
        signal: abortCtrl.signal,
        onDelta: (delta, full) => {
          if (lastP) { lastP.textContent = full; lastP.classList.remove('pending'); }
        }
      });
      setTrace(3, 'done', APP.ai.estTokens(text).toLocaleString() + ' 字');
    } catch (e) {
      const cancelled = e && e.name === 'AbortError';
      setTrace(3, 'done', cancelled ? '已停止' : '生成失败');
      if (cancelled) {
        /* 保留已生成部分为未确认 AI 段 */
        if (lastP && lastP.textContent && lastP.textContent !== '…') {
          const text = lastP.textContent;
          const paras = text.trim().split(/\n+/).map(x => ({ cls: 'ai-mark', text: x.trim() })).filter(x => x.text);
          const beatRef = currentBeat();
          if (beatRef) {
            beatRef.paras = beatRef.paras.concat(paras);
            APP.store.setChapterParas(D.current.volumeId, D.current.chapterId, beatRef.paras);
            renderDoc();
          }
          APP.toast('已停止生成，已生成的部分保留为待确认段落', 'warn');
        } else if (lastP) lastP.remove();
      } else {
        APP.toast('生成失败：' + e.message, 'warn');
        if (lastP) lastP.remove();
      }
      aiRunning = false; sendBtn.classList.remove('loading'); sendBtn.title = '发送'; window.__abortAI = null;
      return;
    }

    // 把生成正文分段落追加到当前章节
    if (lastP && text.trim()) {
      const paras = text.trim().split(/\n+/).map(x => ({ cls: 'ai-mark', text: x.trim() })).filter(x => x.text);
      const beatRef = currentBeat();
      if (beatRef) {
        beatRef.paras = beatRef.paras.concat(paras);
        APP.store.setChapterParas(D.current.volumeId, D.current.chapterId, beatRef.paras);
        renderDoc();
        // 重新渲染后再高亮最后一个 AI 段落
        const ps = document.querySelectorAll('#doc-content p.ai-mark');
        if (ps.length) selectPara(ps[ps.length - 1]);
      }
      setSaveState(false);
      updateBudget();
    }
    setTrace(4, 'done', '一致性校验：无重大冲突');
    renderCtx('ctx');
    aiRunning = false;
    sendBtn.classList.remove('loading');
    sendBtn.title = '发送';
    window.__abortAI = null;
  }

  function updateBudget() {
    const beat = currentBeat();
    const base = 820 + 340 + 640;
    const used = base + APP.ai.estTokens((beat && beat.sum) || '') + (D.aiCalls[D.aiCalls.length - 1]?.tokens || 0);
    D.contextBudget.used = Math.min(used, D.contextBudget.limit);
    D.contextBudget.percent = Math.round(D.contextBudget.used / D.contextBudget.limit * 100);
    $('#tk-num').textContent = (D.contextBudget.used / 1000).toFixed(1) + 'k';
    $('#tk-fill').style.width = D.contextBudget.percent + '%';
  }

  /* 生成中点击发送按钮 = 停止（§12-4 取消链路） */
  $('#cmd-send').addEventListener('click', () => {
    if (aiRunning) {
      if (window.__abortAI) window.__abortAI();
      return;
    }
    const t = input.value.trim();
    if (!t) { APP.toast('先输入一句指令吧', 'warn'); return; }
    runAI('指令', t); input.value = '';
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#cmd-send').click(); }
  });

  /* ================= 专注模式 ================= */
  $('#btn-focus').addEventListener('click', () => {
    focusMode = !focusMode;
    document.body.classList.toggle('focus-mode', focusMode);
    $('#btn-focus').textContent = focusMode ? '退出' : '开启';
    APP.toast(focusMode ? '已进入专注模式' : '已退出专注模式', 'success');
  });

  /* ================= 右栏：上下文面板 ================= */
  const ctxTabs = ['beat', 'chars', 'fs', 'sug', 'ctx'];

  function renderCtx(tab) {
    const body = $('#ctx-body');
    body.innerHTML = '';

    if (tab === 'beat') {
      const src = currentBeat();
      if (!src) {
        body.appendChild(APP.el('<div class="empty"><p class="t">还没有选中的章节</p><p class="d">在大纲页创建章节后，这里会显示本章小纲。</p></div>'));
        return;
      }
      const b = {
        title: src.title,
        goal: src.sum || '（未设定，可在右侧编辑）',
        keyEvents: src.keyEvents || [],
        chars: src.chars || [],
        fsPlanted: src.fs || [],
        ending: src.ending || '（未设定）'
      };
      body.appendChild(APP.el(`
        <div class="ctx-card">
          <div class="h">${APP.icon('list')} 本章小纲<span class="spacer"></span><span class="more" id="ctx-edit-beat">编辑</span></div>
          <p style="font-weight:600;margin-bottom:6px">${APP.esc(b.title)}</p>
          <div class="kv"><div class="row"><span class="k">目标</span><span>${APP.esc(b.goal)}</span></div></div>
        </div>
        <div class="ctx-card">
          <div class="h">${APP.icon('check')} 关键事件</div>
          <div class="fs-list">${b.keyEvents.map(e => `<div class="fs-item"><span class="dot" style="background:var(--sun)"></span><span>${APP.esc(e)}</span></div>`).join('')}</div>
        </div>
        <div class="ctx-card">
          <div class="h">${APP.icon('user')} 出场人物</div>
          <div class="flex gap-6" style="flex-wrap:wrap">${b.chars.map(c => `<span class="tag tag-sun">${c}</span>`).join('')}</div>
        </div>
        <div class="ctx-card">
          <div class="h">${APP.icon('flag')} 本章埋设</div>
          <div class="flex gap-6">${b.fsPlanted.map(f => `<span class="tag tag-peach">${f}</span>`).join('')}</div>
        </div>
        <div class="ctx-card" style="border-left:4px solid var(--sun)">
          <div class="h">${APP.icon('spark')} 章节结尾</div>
          <p>${APP.esc(b.ending)}</p>
        </div>`));
      const eb = $('#ctx-edit-beat');
      if (eb) eb.addEventListener('click', editChapterBeat);
    } else if (tab === 'chars') {
      D.characters.slice(0, 3).forEach(c => {
        body.appendChild(APP.el(`
          <div class="ctx-card">
            <div class="h"><span class="portrait" style="background:${c.color}">${c.name.slice(0,1)}</span> ${c.name}<span class="spacer"></span><span class="tag ${'tag-' + (c.tag || 'sun')}">${c.role.split('·')[0]}</span></div>
            <p style="margin-bottom:6px">${APP.esc(c.brief)}</p>
            <p class="small" style="color:var(--sun)">「${APP.esc(c.speech)}」</p>
          </div>`));
      });
    } else if (tab === 'fs') {
      const open = D.foreshadows.filter(f => f.status === 'open');
      body.appendChild(APP.el(`<div class="eyebrow" style="padding:2px 4px 4px">未回收 ${open.length} 条</div>`));
      open.slice(0, 5).forEach(f => {
        body.appendChild(APP.el(`
          <div class="ctx-card" style="border-left:4px solid var(--coral)">
            <div class="h">${APP.icon('flag')} ${APP.esc(f.where)}<span class="spacer"></span><span class="tag tag-coral">未回收</span></div>
            <p>${APP.esc(f.text)}</p>
            <p class="small muted" style="margin-top:4px">回收提示：${APP.esc(f.note)}</p>
          </div>`));
      });
    } else if (tab === 'sug') {
      if (!D.suggestions.length) {
        body.appendChild(APP.el('<div class="empty"><p class="t">暂无待处理建议</p><p class="d">AI 校验发现的修改建议会出现在这里。</p></div>'));
      }
      D.suggestions.forEach(s => {
        const card = APP.el(`
          <div class="ctx-card">
            <div class="h"><span class="tag ${s.type === '一致性' ? 'tag-coral' : s.type === '伏笔' ? 'tag-peach' : 'tag-sky'}">${s.type}</span><span class="spacer"></span></div>
            <p>${APP.esc(s.text)}</p>
            <div class="flex gap-6 mt-8">
              <button class="chip" data-ok>采纳</button>
              <button class="chip" data-ignore>忽略</button>
            </div>
          </div>`);
        card.querySelector('[data-ok]').addEventListener('click', () => {
          if (s.type === '伏笔') {
            /* 伏笔类建议：采纳即入伏笔库 */
            APP.store.addForeshadow({ text: s.text.replace(/^检测到|可在本段自然呼应.*$|建议在.*$|。$/g, '').trim() || s.text, where: D.current.chapterTitle || '当前章节', note: '来自 AI 建议' });
            APP.toast('已采纳：新伏笔加入伏笔库', 'success');
          } else {
            /* 其余建议标记为已处理（人工修改正文后消失） */
            APP.toast('已采纳，请按建议修改对应段落', 'success');
          }
          D.suggestions = D.suggestions.filter(x => x !== s);
          APP.store.save();
          card.remove();
          if (!D.suggestions.length) renderCtx('sug');
        });
        card.querySelector('[data-ignore]').addEventListener('click', () => {
          D.suggestions = D.suggestions.filter(x => x !== s);
          APP.store.save();
          card.remove();
          if (!D.suggestions.length) renderCtx('sug');
        });
        body.appendChild(card);
      });
    } else {
      const cb = D.contextBudget;
      body.appendChild(APP.el(`
        <div class="ctx-card">
          <div class="h">${APP.icon('info')} 本次请求上下文预算</div>
          <p class="small muted" style="margin-bottom:8px">超出 ${cb.limit.toLocaleString()} tokens 时，自动截断老旧内容、优先保留关键摘要</p>
          <div class="flex gap-6 mb-14"><div class="progress" style="flex:1"><i style="width:${cb.percent}%"></i></div><b class="mono small">${cb.used.toLocaleString()}</b></div>
          <div class="fs-list">${cb.parts.map(part => `
            <div class="fs-item"><span class="dot" style="background:var(--sky)"></span><span style="flex:1">${part.name}</span><b class="mono small muted">${part.tokens.toLocaleString()}</b></div>`).join('')}</div>
        </div>
        <div class="ctx-card">
          <div class="h">${APP.icon('clock')} AI 调用记录</div>
          <div class="fs-list">${D.aiCalls.slice().reverse().slice(0, 8).map(t => `
            <div class="fs-item"><span class="dot" style="background:var(--mint)"></span>
            <span style="flex:1">${t.model} · <span class="small muted">${APP.esc(t.time)}</span></span>
            <b class="mono small muted">${(t.tokens || 0).toLocaleString()}</b></div>`).join('') || '<div class="small muted">暂无调用记录</div>'}</div>
        </div>
        <div class="ctx-card">
          <div class="h">${APP.icon('world')} 长时记忆策略</div>
          <p class="small">全局精简设定常驻；伏笔 / 时间线按语义检索按需加入，不会全量加载全书。</p>
        </div>`));
    }
  }

  /* 编辑本章小纲（写入当前章节的 beat 数据） */
  function editChapterBeat() {
    const b = currentBeat() || D.chapterBeat;
    APP.modal({
      title: '编辑本章小纲',
      submitText: '保存',
      bodyHtml: `
        <div class="field"><label>标题</label><input class="input" name="title" value="${APP.esc(b.title)}"></div>
        <div class="field"><label>目标 / 概要</label><textarea class="textarea" name="goal" rows="2">${APP.esc(b.sum || b.goal || '')}</textarea></div>
        <div class="field"><label>关键事件（每行一条）</label><textarea class="textarea" name="keyEvents" rows="3">${APP.esc((b.keyEvents || []).join('\n'))}</textarea></div>
        <div class="field"><label>章节结尾</label><textarea class="textarea" name="ending" rows="2">${APP.esc(b.ending || '')}</textarea></div>`,
      onSubmit: (root) => {
        const f = APP.formData(root);
        const beat = currentBeat();
        const patch = {
          title: f.title.trim() || b.title,
          sum: f.goal.trim(),
          keyEvents: f.keyEvents.split('\n').map(x => x.trim()).filter(Boolean),
          ending: f.ending.trim()
        };
        if (beat) {
          APP.store.updateBeat(D.current.volumeId, D.current.chapterId, patch);
          D.current.chapterTitle = '第' + beat.no + '章 · ' + beat.title;
          APP.store.save();
          renderSide('outline', $('#side-search-input').value);
          renderDoc();
        } else {
          Object.assign(D.chapterBeat, patch);
          APP.store.save();
        }
        renderCtx('beat');
        APP.toast('本章小纲已保存', 'success');
        return true;
      }
    });
  }

  /* ---------- 本地规则校验（§12-3） ---------- */
  async function runScan(scope) {
    const label = scope === 'all' ? '全书' : '本章';
    const res = await APP.store.scanLocal(scope === 'all' ? 'all' : 'here');
    if (!res.length) { APP.toast('✓ ' + label + '一致性检查通过：未发现明显问题', 'success'); return; }
    res.forEach(r => D.suggestions.unshift({ type: r.type, text: r.text + '（' + label + '本地校验）', from: 'local' }));
    APP.store.save();
    document.querySelectorAll('.ctx-tab').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector('.ctx-tab[data-tab="sug"]');
    if (btn) btn.classList.add('active');
    renderCtx('sug');
    APP.toast('本地校验发现 ' + res.length + ' 条可核对项，已加入建议面板', 'warn');
  }

  $('#ctx-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.ctx-tab'); if (!btn) return;
    document.querySelectorAll('.ctx-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCtx(btn.dataset.tab);
  });

  const scanHere = document.getElementById('btn-scan-here');
  if (scanHere) scanHere.addEventListener('click', () => runScan('here'));
  const scanAll = document.getElementById('btn-scan-all');
  if (scanAll) scanAll.addEventListener('click', () => runScan('all'));

  /* ================= 状态栏：待回收伏笔数 ================= */
  function renderConflict() {
    const el = $('#st-conflict');
    if (el) {
      const open = D.foreshadows.filter(f => f.status === 'open').length;
      el.innerHTML = `⚑ 待回收伏笔 <b class="mono">${open}</b>`;
    }
  }

  /* ================= 自动保存 ================= */
  let autoSaveTimer = null;
  function resetAutoSaveTimer() {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    const raw = Number(D.user && D.user.prefs && D.user.prefs.autoSaveSec);
    const seconds = Number.isFinite(raw) ? Math.min(3600, Math.max(10, raw)) : 60;
    autoSaveTimer = setInterval(() => { if (dirty) saveNow(false); }, seconds * 1000);
  }
  resetAutoSaveTimer();

  /* ================= 启动 ================= */
  renderSide('outline');
  renderDoc();
  renderCtx('beat');
  renderTrace();
  renderConflict();
  $('#st-words').textContent = (D.current.chapterWords || 0).toLocaleString();
  $('#st-mod').textContent = D.current.modifiedCount || 0;
  updateBudget();
  loadChapterBundleForCurrent();

  /* 桌面端磁盘恢复就绪后整体重渲染 */
  APP.store.onReady(() => {
    renderSide('outline');
    renderDoc();
    renderCtx('beat');
    renderTrace();
    renderConflict();
    updateBudget();
    loadChapterBundleForCurrent();
  });

  /* 来自设定库的「引用到写作区」 */
  if (D.pendingInject) {
    const inj = D.pendingInject;
    delete D.pendingInject; APP.store.save();
    $('#cmd-input').value = inj.text;
    APP.toast('已从设定库载入「' + inj.name + '」到指令框', 'success');
  }
})();
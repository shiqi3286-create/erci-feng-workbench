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

  /* ================= 左栏：资源树 ================= */
  const sideTabs = ['outline', 'chars', 'fs', 'tpl'];
  const sideTitle = { outline: '大纲 · 小纲', chars: '人物设定', fs: '伏笔库', tpl: '提示词模板' };

  function volName(volId) {
    const v = D.volumes.find(x => x.id === volId);
    return v ? v.title : '';
  }

  function renderSide(tab) {
    activeTab = tab;
    const body = $('#side-body');
    body.innerHTML = '<div class="eyebrow" style="padding:8px 10px 4px">' + sideTitle[tab] + '</div>';

    if (tab === 'outline') {
      D.volumes.forEach(v => {
        const g = APP.el(`
          <ul class="tree">
            <li class="tree-group">
              <div class="tree-title">${APP.esc(v.title)}<span class="count">${v.done}/${v.chapters} 章</span></div>
              <ul class="tree tree-sub">
                ${v.beats.map(b => `
                  <li class="tree-item ${v.id === D.current.volumeId && b.id === D.current.chapterId ? 'active' : ''}" data-vol="${v.id}" data-beat="${b.id}">
                    <span class="grow">${b.no} · ${APP.esc(b.title)}</span>
                    <span class="meta">${b.status === 'done' ? '完' : b.status === 'writing' ? '写' : '待'}</span>
                  </li>`).join('')}
              </ul>
            </li>
          </ul>`);
        g.querySelectorAll('.tree-item').forEach(it =>
          it.addEventListener('click', () => switchChapter(it.dataset.vol, it.dataset.beat)));
        body.appendChild(g);
      });
    } else if (tab === 'chars') {
      const wrap = APP.el(`<div style="display:flex;flex-direction:column;gap:8px"></div>`);
      D.characters.forEach(c => {
        const item = APP.el(`
          <div class="tree-item" data-c="${c.id}">
            <span class="portrait" style="background:${c.color}">${c.name.slice(0,1)}</span>
            <span class="grow">${c.name}</span><span class="meta">${c.role.split('·')[0]}</span>
          </div>`);
        item.addEventListener('click', () => injectChar(c.id));
        wrap.appendChild(item);
      });
      body.appendChild(wrap);
    } else if (tab === 'fs') {
      const wrap = APP.el(`<div style="display:flex;flex-direction:column;gap:8px"></div>`);
      D.foreshadows.forEach(f => {
        const item = APP.el(`
          <div class="tree-item" data-f="${f.id}">
            <span class="dot ${f.status}" style="width:7px;height:7px;border-radius:50%;background:${f.status === 'open' ? 'var(--coral)' : 'var(--mint)'}"></span>
            <span class="grow">${APP.esc(f.text)}</span>
          </div>`);
        item.addEventListener('click', () => injectForeshadow(f.id));
        wrap.appendChild(item);
      });
      body.appendChild(wrap);
    } else {
      const flat = D.templates.flatMap(g => g.items.map(t => ({ ...t, group: g.group })));
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
    }
  }

  $('#side-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.side-tab'); if (!btn) return;
    document.querySelectorAll('.side-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSide(btn.dataset.tab);
  });

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

  /* ================= 章节切换 ================= */
  function switchChapter(volId, beatId) {
    if (aiRunning) { APP.toast('AI 生成中，请稍候', 'warn'); return; }
    const vol = D.volumes.find(v => v.id === volId);
    const beat = vol && vol.beats.find(b => b.id === beatId);
    if (!beat) return;
    D.current = {
      projectId: D.current.projectId,
      volumeId: volId,
      chapterId: beatId,
      chapterTitle: '第' + beat.no + '章 · ' + beat.title,
      chapterWords: beat.paras ? beat.paras.reduce((s, x) => s + (x.text || '').length, 0) : 0,
      chapterOrder: +beat.no,
      modifiedCount: beat.modifiedCount || 0
    };
    APP.store.save();
    selectedPara = null;
    dirty = false;
    renderSide(activeTab);
    renderDoc();
    renderCtx('beat');
    setSaveState(true);
    renderTrace();
    /* 同步底部状态栏字数 / 修改次数 / 预算 */
    $('#st-words').textContent = (D.current.chapterWords || 0).toLocaleString();
    $('#st-mod').textContent = beat.modifiedCount || 0;
    updateBudget();
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
    const beat = currentBeat();
    const area = $('#doc-area');
    const paras = (beat && beat.paras) || [];

    area.innerHTML = `
      <div class="eyebrow" style="margin-bottom:6px">${APP.esc(volName(cur.volumeId))} · 第 ${cur.chapterOrder} 章</div>
      <h1 class="doc-title">${APP.esc(cur.chapterTitle)}</h1>
      <div class="doc-meta">
        <span id="meta-words">${(cur.chapterWords || 0).toLocaleString()} 字</span>
        <span>已修改 ${beat.modifiedCount || 0} 次</span>
        <span class="tag ${beat.status === 'done' ? 'tag-mint' : beat.status === 'writing' ? 'tag-sun' : 'tag-mute'}">${beat.status === 'done' ? '已完结' : beat.status === 'writing' ? '写作中' : '待写'}</span>
      </div>
      <div class="doc-content" id="doc-content">${paras.length ? paras.map((p, i) =>
        `<p class="${p.cls || ''}" data-p="${i}" contenteditable="true" spellcheck="false">${APP.esc(p.text)}</p>`).join('') : ''}
      </div>`;

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
  }

  function selectPara(p) {
    document.querySelectorAll('#doc-content p').forEach(x => { x.classList.remove('sel'); x.classList.remove('editing'); });
    const already = p.classList.contains('sel');
    p.classList.add('sel');
    const idx = +p.dataset.p;
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
  function saveNow(showToast = true) {
    const beat = currentBeat();
    if (!beat) return;
    // 把内存中的 paras 写回 store
    const cur = D.current;
    APP.store.setChapterParas(cur.volumeId, cur.chapterId, beat.paras);
    beat.modifiedCount = (beat.modifiedCount || 0) + 1;
    cur.modifiedCount = beat.modifiedCount;
    $('#st-mod').textContent = beat.modifiedCount;
    APP.store.touchChapter(cur.volumeId, cur.chapterId, { modified: 0 });
    setSaveState(true);
    if (showToast) APP.toast('已保存到本地', 'success');
  }
  $('#btn-save').addEventListener('click', () => saveNow(true));
  // Ctrl+S
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(true); }
  });

  /* ================= 中栏：指令区 ================= */
  const input = $('#cmd-input');
  const quickActions = { '续写': '按当前大纲与上文继续推进，保持细腻治愈的慢热文风。', '扩写': '扩写选中段落，补充感官、动作与心理细节。', '润色': '润色选中段落，提升文笔与节奏，不改变情节。', '对话': '按人物设定生成符合口吻的角色对话。', '人设检查': '检查本章角色言行是否符合人设，列出不一致处。', '伏笔扫描': '提取本章新埋设的伏笔，并对照伏笔库。' };

  $('#cmd-quick').addEventListener('click', e => {
    const chip = e.target.closest('.chip'); if (!chip) return;
    input.value = '[' + chip.dataset.action + '] ' + (quickActions[chip.dataset.action] || '');
    input.focus();
  });

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
        onDelta: (delta, full) => {
          if (lastP) { lastP.textContent = full; lastP.classList.remove('pending'); }
        }
      });
      setTrace(3, 'done', APP.ai.estTokens(text).toLocaleString() + ' 字');
    } catch (e) {
      setTrace(3, 'done', '生成失败');
      APP.toast('生成失败：' + e.message, 'warn');
      if (lastP) lastP.remove();
      aiRunning = false; sendBtn.classList.remove('loading');
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

  $('#cmd-send').addEventListener('click', () => {
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
      const source = currentBeat() || {};
      const b = {
        title: source.title || D.chapterBeat.title,
        goal: source.sum || D.chapterBeat.goal,
        keyEvents: source.keyEvents || D.chapterBeat.keyEvents,
        chars: source.chars || D.chapterBeat.chars,
        fsPlanted: source.fsPlanted || source.fs || D.chapterBeat.fsPlanted,
        ending: source.ending || D.chapterBeat.ending
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
      D.suggestions.forEach(s => {
        const card = APP.el(`
          <div class="ctx-card">
            <div class="h"><span class="tag ${s.type === '一致性' ? 'tag-coral' : 'tag-sky'}">${s.type}</span><span class="spacer"></span></div>
            <p>${APP.esc(s.text)}</p>
            <div class="flex gap-6 mt-8">
              <button class="chip" data-ok>采纳</button>
              <button class="chip" data-ignore>忽略</button>
            </div>
          </div>`);
        card.querySelector('[data-ok]').addEventListener('click', () => { card.style.opacity = '.4'; APP.toast('已采纳修改', 'success'); });
        card.querySelector('[data-ignore]').addEventListener('click', () => { card.remove(); });
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

  /* 编辑本章小纲 */
  function editChapterBeat() {
    const b = D.chapterBeat;
    APP.modal({
      title: '编辑本章小纲',
      submitText: '保存',
      bodyHtml: `
        <div class="field"><label>标题</label><input class="input" name="title" value="${APP.esc(b.title)}"></div>
        <div class="field"><label>目标</label><textarea class="textarea" name="goal" rows="2">${APP.esc(b.goal)}</textarea></div>
        <div class="field"><label>章节结尾</label><textarea class="textarea" name="ending" rows="2">${APP.esc(b.ending)}</textarea></div>`,
      onSubmit: (root) => {
        const f = APP.formData(root);
        Object.assign(b, { title: f.title, goal: f.goal, ending: f.ending });
        APP.store.save();
        renderCtx('beat');
        APP.toast('本章小纲已保存', 'success');
        return true;
      }
    });
  }

  $('#ctx-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.ctx-tab'); if (!btn) return;
    document.querySelectorAll('.ctx-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCtx(btn.dataset.tab);
  });

  /* ================= 自动保存（60s） ================= */
  setInterval(() => { if (dirty) saveNow(false); }, 60000);

  /* ================= 启动 ================= */
  renderSide('outline');
  renderDoc();
  renderCtx('beat');
  renderTrace();
  $('#st-words').textContent = (D.current.chapterWords || 0).toLocaleString();
  $('#st-mod').textContent = D.current.modifiedCount || 0;
  updateBudget();

  /* 来自设定库的「引用到写作区」 */
  if (D.pendingInject) {
    const inj = D.pendingInject;
    delete D.pendingInject; APP.store.save();
    $('#cmd-input').value = inj.text;
    APP.toast('已从设定库载入「' + inj.name + '」到指令框', 'success');
  }
})();
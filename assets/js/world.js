/* 晴笺 · 设定库页逻辑
 * 人物 / 地点 / 物品 / 伏笔 / 时间线；新建 / 编辑 / 删除 / AI 生成 / 引用到写作区
 * 所有类型均支持：点击卡片查看详情、编辑、删除；AI 生成人物需确认入库。
 */
(function () {
  const D = APP.store.init(window.DATA);
  const $ = s => document.querySelector(s);
  let tab = 'chars';
  let selected = D.characters[0] ? D.characters[0].id : '';

  const TITLE = { chars: '人物设定', loc: '地点档案', item: '物品 · 功法', fs: '伏笔库', timeline: '时间线' };

  /* 顶栏项目名 */
  const projTag = document.getElementById('proj-tag');
  if (projTag) projTag.textContent = (APP.store.currentProject() || {}).title || '未命名';

  /* 头像：优先用生成的图片，加载失败回退到渐变 + 首字 */
  function avatarHTML(c, cls) {
    const letter = APP.esc((c.name || '?').slice(0, 1));
    const img = c.avatar ? `<img src="${c.avatar}" onerror="this.remove()" alt="">` : '';
    return `<span class="${cls || 'char-avatar'}" style="background:${c.color};color:#fff;position:relative;overflow:hidden">${img}<span class="av-letter" style="position:relative">${letter}</span></span>`;
  }

  function countFor(t) {
    return { chars: D.characters.length, loc: D.locations.length, item: D.items.length, fs: D.foreshadows.length, timeline: (D.timeline || []).length }[t] || 0;
  }

  function updateTabCounts() {
    document.querySelectorAll('.world-tab').forEach(x => {
      const c = x.querySelector('.mono');
      if (c) c.textContent = countFor(x.dataset.t);
    });
  }

  /* ---------- 网格 ---------- */
  function renderGrid() {
    const grid = document.getElementById('wt-grid');
    document.getElementById('wt-title').textContent = TITLE[tab];
    grid.innerHTML = '';
    document.getElementById('wt-count').textContent = countFor(tab) + ' 条记录';

    if (tab === 'chars') {
      D.characters.forEach(c => {
        const tag = c.confirmed === false ? '<span class="tag tag-coral" style="float:right">待确认</span>' : '';
        const card = APP.el(`
          <div class="char-card ${c.id === selected ? 'sel' : ''}" data-id="${c.id}" style="${c.id === selected ? 'box-shadow:0 0 0 3px rgba(232,155,84,.2),var(--shadow-card)' : ''}">
            ${avatarHTML(c)}
            <div style="min-width:0;flex:1">
              <div class="n">${APP.esc(c.name)}${tag}</div>
              <div class="r">${APP.esc(c.role)}</div>
              <div class="b">${APP.esc(c.brief)}</div>
            </div>
          </div>`);
        card.addEventListener('click', () => { selected = c.id; renderGrid(); renderDetail(); });
        grid.appendChild(card);
      });
    } else if (tab === 'loc') {
      D.locations.forEach(l => {
        const card = APP.el(`
          <div class="plain-card" data-id="${l.id}" style="${l.id === selected ? 'box-shadow:0 0 0 3px rgba(232,155,84,.2),var(--shadow-card)' : ''}">
            <div class="flex gap-10 mb-14"><span class="tag tag-sky">${APP.esc(l.type)}</span><span class="small muted">${APP.esc((l.tags || []).join(' · '))}</span></div>
            <div style="font-weight:700;font-size:15px;font-family:var(--font-display)">${APP.esc(l.name)}</div>
            <p class="small muted" style="margin-top:5px">${APP.esc(l.desc)}</p>
          </div>`);
        card.addEventListener('click', () => { selected = l.id; renderGrid(); renderDetail(); });
        grid.appendChild(card);
      });
    } else if (tab === 'item') {
      D.items.forEach(it => {
        const card = APP.el(`
          <div class="plain-card" data-id="${it.id}" style="${it.id === selected ? 'box-shadow:0 0 0 3px rgba(232,155,84,.2),var(--shadow-card)' : ''}">
            <div class="flex gap-10 mb-14"><span class="tag tag-lilac">${APP.esc(it.type)}</span><span class="small muted">持有者 · ${APP.esc(it.owner || '—')}</span></div>
            <div style="font-weight:700;font-size:15px;font-family:var(--font-display)">${APP.esc(it.name)}</div>
            <p class="small muted" style="margin-top:5px">${APP.esc(it.desc)}</p>
          </div>`);
        card.addEventListener('click', () => { selected = it.id; renderGrid(); renderDetail(); });
        grid.appendChild(card);
      });
    } else if (tab === 'fs') {
      const board = APP.el(`<div class="fs-board"></div>`);
      D.foreshadows.forEach(f => {
        const card = APP.el(`
          <div class="fs-board-card ${f.status === 'closed' ? 'closed' : ''} ${f.id === selected ? 'sel' : ''}" data-fs="${f.id}" style="${f.id === selected ? 'box-shadow:0 0 0 3px rgba(232,155,84,.2),var(--shadow-card)' : ''}">
            <div class="h"><span class="dot ${f.status}" style="width:8px;height:8px;border-radius:50%;background:${f.status === 'open' ? 'var(--coral)' : 'var(--mint)'}"></span>
            <span>${APP.esc(f.text)}</span><span class="spacer"></span>
            <span class="tag ${f.status === 'open' ? 'tag-coral' : 'tag-mint'}">${f.status === 'open' ? '未回收' : '已回收'}</span></div>
            <div class="loc">${APP.esc(f.where)}</div>
            <div class="note">回收提示：${APP.esc(f.note)}</div>
          </div>`);
        card.addEventListener('click', () => { selected = f.id; renderGrid(); renderDetail(); });
        board.appendChild(card);
      });
      grid.appendChild(board);
    } else {
      /* 时间线（数据化存储，支持新增/编辑/删除） */
      const board = APP.el(`<div class="fs-board"></div>`);
      (D.timeline || []).forEach(n => {
        board.appendChild(APP.el(`
          <div class="fs-board-card" style="border-left-color:var(--sky)" data-id="${n.id}">
            <div class="h"><span class="tag tag-sky">${APP.esc(n.t)}</span><span>${APP.esc(n.e)}</span></div>
          </div>`));
      });
      if (!(D.timeline || []).length) {
        board.appendChild(APP.el('<div class="empty"><p class="t">还没有时间线</p><p class="d">点击右上角「＋ 新建」添加关键事件。</p></div>'));
      }
      grid.appendChild(board);
    }
  }

  /* ---------- 详情 ---------- */
  function renderDetail() {
    const pane = document.getElementById('wt-detail');

    if (tab === 'chars') {
      const c = D.characters.find(x => x.id === selected) || D.characters[0];
      if (!c) { pane.innerHTML = '<div class="empty"><p class="t">新建一位人物</p><p class="d">点击右上角「＋ 新建」添加人物设定。</p></div>'; return; }
      const unconfirmed = c.confirmed === false;
      pane.innerHTML = `
        <div class="h">
          ${avatarHTML(c, 'char-avatar')}
          <div><div class="t">${APP.esc(c.name)}</div><div class="small" style="color:var(--sun);font-weight:600">${APP.esc(c.role)}</div></div>
          ${unconfirmed ? '<span class="spacer" style="flex:1"></span><span class="tag tag-coral">待确认</span>' : ''}
        </div>
        <p class="small muted">${APP.esc(c.brief)}</p>
        <div class="sec"><div class="st">性格标签</div><div class="flex gap-6">${(c.traits || []).map(t => `<span class="tag tag-sun">${APP.esc(t)}</span>`).join('')}</div></div>
        <div class="sec"><div class="st">习惯台词</div><p style="color:var(--sun)">${(() => { const s = APP.esc(c.speech || '—'); return s.startsWith('「') || s.startsWith('"') || s.startsWith('“') ? s : '「' + s + '」'; })()}</p></div>
        <div class="sec"><div class="st">人物关系</div><p>${APP.esc(c.relation)}</p></div>
        <div class="sec"><div class="st">基础信息</div>
          <div class="kv-grid">${c.meta ? Object.entries(c.meta).map(([k, v]) => `<div><div class="k">${APP.esc(k)}</div><div class="v">${APP.esc(v)}</div></div>`).join('') : '<span class="small muted">—</span>'}</div>
        </div>
        <div class="sec"><div class="st">AI 联动</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${unconfirmed ? '<button class="btn btn-primary btn-block" id="btn-confirm-char">✓ 确认入库</button>' : '<button class="btn btn-primary btn-block" id="btn-ai-gen-ref">引用到写作区</button>'}
            <button class="btn btn-ghost btn-block" id="btn-ai-gen-check">检查人设一致性</button>
          </div>
        </div>
        <div class="sec"><div class="st">更多</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-block" id="btn-edit">编辑</button>
            <button class="btn btn-ghost btn-block" id="btn-del" style="color:var(--coral)">删除</button>
          </div>
        </div>`;
      if (unconfirmed) {
        $('#btn-confirm-char').addEventListener('click', () => {
          APP.store.confirmChar(c.id);
          renderGrid(); renderDetail(); updateTabCounts();
          APP.toast('人物已确认入库', 'success');
        });
      } else {
        $('#btn-ai-gen-ref').addEventListener('click', () => {
          D.pendingInject = { name: c.name, text: '【人物】' + c.name + '（' + c.role + '）：' + (c.summary || c.brief || '') };
          APP.store.save();
          APP.toast('已添加到写作区指令框', 'success');
          location.href = 'workspace.html';
        });
      }
      $('#btn-edit').addEventListener('click', () => editChar(c));
      $('#btn-del').addEventListener('click', () => delChar(c));
      $('#btn-ai-gen-check').addEventListener('click', () => checkChar(c));
      return;
    }

    if (tab === 'loc') {
      const l = D.locations.find(x => x.id === selected) || D.locations[0];
      if (!l) { pane.innerHTML = '<div class="empty"><p class="t">新建一个地点</p><p class="d">点击右上角「＋ 新建」添加地点档案。</p></div>'; return; }
      pane.innerHTML = `
        <div class="h"><div class="t">${APP.esc(l.name)}</div></div>
        <div class="flex gap-6 mb-14"><span class="tag tag-sky">${APP.esc(l.type)}</span>${(l.tags || []).map(t => `<span class="tag tag-mute">${APP.esc(t)}</span>`).join('')}</div>
        <div class="sec"><div class="st">描述</div><p>${APP.esc(l.desc || '—')}</p></div>
        <div class="sec"><div class="st">操作</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-block" id="btn-edit">编辑</button>
            <button class="btn btn-ghost btn-block" id="btn-del" style="color:var(--coral)">删除</button>
          </div></div>`;
      $('#btn-edit').addEventListener('click', () => editLocation(l));
      $('#btn-del').addEventListener('click', () => {
        if (!confirm('确定删除地点「' + l.name + '」？')) return;
        APP.store.removeLocation(l.id);
        selected = D.locations[0] ? D.locations[0].id : '';
        renderGrid(); renderDetail(); updateTabCounts();
        APP.toast('已删除地点', 'success');
      });
      return;
    }

    if (tab === 'item') {
      const it = D.items.find(x => x.id === selected) || D.items[0];
      if (!it) { pane.innerHTML = '<div class="empty"><p class="t">新建一件物品</p><p class="d">点击右上角「＋ 新建」添加物品 / 功法。</p></div>'; return; }
      pane.innerHTML = `
        <div class="h"><div class="t">${APP.esc(it.name)}</div></div>
        <div class="flex gap-6 mb-14"><span class="tag tag-lilac">${APP.esc(it.type)}</span><span class="small muted">持有者 · ${APP.esc(it.owner || '—')}</span></div>
        <div class="sec"><div class="st">描述</div><p>${APP.esc(it.desc || '—')}</p></div>
        <div class="sec"><div class="st">操作</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-block" id="btn-edit">编辑</button>
            <button class="btn btn-ghost btn-block" id="btn-del" style="color:var(--coral)">删除</button>
          </div></div>`;
      $('#btn-edit').addEventListener('click', () => editItem(it));
      $('#btn-del').addEventListener('click', () => {
        if (!confirm('确定删除物品「' + it.name + '」？')) return;
        APP.store.removeItem(it.id);
        selected = D.items[0] ? D.items[0].id : '';
        renderGrid(); renderDetail(); updateTabCounts();
        APP.toast('已删除物品', 'success');
      });
      return;
    }

    if (tab === 'fs') {
      const f = D.foreshadows.find(x => x.id === selected) || D.foreshadows[0];
      if (!f) { pane.innerHTML = '<div class="empty"><p class="t">新建一条伏笔</p><p class="d">点击右上角「＋ 新建」添加伏笔。</p></div>'; return; }
      const open = f.status === 'open';
      pane.innerHTML = `
        <div class="h"><div class="t" style="font-size:15px">${APP.esc(f.text)}</div></div>
        <div class="flex gap-6 mb-14"><span class="tag ${open ? 'tag-coral' : 'tag-mint'}">${open ? '未回收' : '已回收'}</span><span class="small muted">${APP.esc(f.where)}</span></div>
        <div class="sec"><div class="st">回收提示</div><p>${APP.esc(f.note || '—')}</p></div>
        <div class="sec"><div class="st">操作</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="btn btn-primary btn-block" id="btn-fs-toggle">${open ? '✓ 标记为已回收' : '↩ 重新打开'}</button>
            <button class="btn btn-ghost btn-block" id="btn-edit">编辑</button>
            <button class="btn btn-ghost btn-block" id="btn-del" style="color:var(--coral)">删除</button>
          </div></div>`;
      $('#btn-fs-toggle').addEventListener('click', () => {
        APP.store.updateForeshadow(f.id, { status: open ? 'closed' : 'open' });
        renderGrid(); renderDetail(); updateTabCounts();
        APP.toast(open ? '伏笔已标记回收' : '伏笔已重新打开', 'success');
      });
      $('#btn-edit').addEventListener('click', () => editForeshadow(f));
      $('#btn-del').addEventListener('click', () => {
        if (!confirm('确定删除该伏笔？')) return;
        APP.store.removeForeshadow(f.id);
        selected = D.foreshadows[0] ? D.foreshadows[0].id : '';
        renderGrid(); renderDetail(); updateTabCounts();
        APP.toast('已删除伏笔', 'success');
      });
      return;
    }

    /* 时间线详情 */
    const n = (D.timeline || []).find(x => x.id === selected) || (D.timeline || [])[0];
    if (!n) { pane.innerHTML = '<div class="empty"><p class="t">时间线还是空的</p><p class="d">点击右上角「＋ 新建」添加关键事件。</p></div>'; return; }
    selected = n.id;
    pane.innerHTML = `
      <div class="h"><span class="tag tag-sky">${APP.esc(n.t)}</span><div class="t" style="margin-left:8px">${APP.esc(n.e)}</div></div>
      <div class="sec"><div class="st">操作</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-block" id="btn-edit">编辑</button>
          <button class="btn btn-ghost btn-block" id="btn-del" style="color:var(--coral)">删除</button>
        </div></div>`;
    $('#btn-edit').addEventListener('click', () => editTimeline(n));
    $('#btn-del').addEventListener('click', () => {
      if (!confirm('确定删除该时间线事件？')) return;
      APP.store.removeTimeline(n.id);
      selected = (D.timeline || [])[0] ? D.timeline[0].id : '';
      renderGrid(); renderDetail(); updateTabCounts();
      APP.toast('已删除时间线事件', 'success');
    });
  }

  /* ---------- 编辑弹窗 ---------- */
  function editChar(c) {
    const m = APP.modal({
      title: '编辑人物 · ' + c.name,
      submitText: '保存',
      bodyHtml: `
        <div class="field"><label>姓名</label><input class="input" name="name" value="${APP.esc(c.name)}"></div>
        <div class="field"><label>定位</label><input class="input" name="role" value="${APP.esc(c.role)}"></div>
        <div class="field"><label>简介</label><textarea class="textarea" name="brief" rows="3">${APP.esc(c.brief)}</textarea></div>
        <div class="field"><label>习惯台词</label><input class="input" name="speech" value="${APP.esc(c.speech)}"></div>
        <div class="field"><label>人物关系</label><input class="input" name="relation" value="${APP.esc(c.relation)}"></div>
        <div class="field">
          <label>头像（§12-5：AI 生成或上传）</label>
          <div class="flex gap-6">
            <button type="button" class="btn btn-soft btn-sm" id="btn-av-gen">✨ AI 生成头像</button>
            <button type="button" class="btn btn-soft btn-sm" id="btn-av-up">上传图片</button>
            <input type="file" id="av-file" accept="image/*" hidden>
          </div>
          <div class="small muted" id="av-hint" style="margin-top:6px">${c.avatar ? '已设置头像（生成后将自动替换）' : '暂无头像'}</div>
        </div>`,
      onSubmit: (root) => {
        const f = APP.formData(root);
        if (!f.name.trim()) { APP.toast('姓名不能为空', 'warn'); return false; }
        APP.store.updateChar(c.id, { name: f.name, role: f.role, brief: f.brief, speech: f.speech, relation: f.relation });
        selected = c.id;
        renderGrid(); renderDetail(); updateTabCounts();
        APP.toast('人物已保存', 'success');
        return true;
      }
    });

    /* 头像：AI 生成（画图渠道/演示占位） */
    const genBtn = m.root.querySelector('#btn-av-gen');
    if (genBtn) genBtn.addEventListener('click', async () => {
      genBtn.disabled = true; genBtn.textContent = '生成中…';
      try {
        const r = await APP.ai.generateImage({
          prompt: '人物立绘头像插画：' + c.name + '，' + (c.role || '角色') + '。' + (c.brief || '').slice(0, 140) + '。暖色调治愈系、柔和光影、半身肖像、细腻笔触。'
        });
        APP.store.updateChar(c.id, { avatar: r.dataUrl });
        c.avatar = r.dataUrl;
        const hint = m.root.querySelector('#av-hint');
        if (hint) hint.textContent = r.demo ? '已生成演示头像（配置画图渠道后生成真实头像）' : '头像已更新';
        renderGrid(); renderDetail();
      } catch (e) { APP.toast('头像生成失败：' + e.message, 'warn'); }
      genBtn.disabled = false; genBtn.textContent = '✨ AI 生成头像';
    });
    /* 头像：本地上传并压缩到 256px */
    const upBtn = m.root.querySelector('#btn-av-up');
    const fileInput = m.root.querySelector('#av-file');
    if (upBtn) upBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', () => {
      const f = fileInput.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        const img = new Image();
        img.onload = () => {
          const cv = document.createElement('canvas');
          const s = 256;
          cv.width = s; cv.height = Math.max(1, Math.round(img.height / img.width * s));
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          APP.store.updateChar(c.id, { avatar: cv.toDataURL('image/jpeg', 0.85) });
          c.avatar = cv.toDataURL('image/jpeg', 0.85);
          const hint = m.root.querySelector('#av-hint');
          if (hint) hint.textContent = '头像已更新';
          renderGrid(); renderDetail();
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(f);
    });
  }
  function delChar(c) {
    if (!confirm('确定删除人物「' + c.name + '」？')) return;
    APP.store.removeChar(c.id);
    selected = D.characters[0] ? D.characters[0].id : '';
    renderGrid(); renderDetail(); updateTabCounts();
    APP.toast('已删除人物', 'success');
  }

  function editLocation(l) {
    APP.modal({
      title: '编辑地点 · ' + l.name,
      submitText: '保存',
      bodyHtml: `
        <div class="field"><label>地点名称</label><input class="input" name="name" value="${APP.esc(l.name)}"></div>
        <div class="field"><label>类型</label><input class="input" name="type" value="${APP.esc(l.type)}"></div>
        <div class="field"><label>描述</label><textarea class="textarea" name="desc" rows="3">${APP.esc(l.desc)}</textarea></div>
        <div class="field"><label>标签（逗号分隔）</label><input class="input" name="tags" value="${APP.esc((l.tags || []).join(', '))}"></div>`,
      onSubmit: (root) => {
        const f = APP.formData(root);
        if (!f.name.trim()) { APP.toast('名称不能为空', 'warn'); return false; }
        APP.store.updateLocation(l.id, {
          name: f.name.trim(), type: f.type.trim() || '地点', desc: f.desc,
          tags: f.tags.split(/[,，]/).map(x => x.trim()).filter(Boolean)
        });
        selected = l.id;
        renderGrid(); renderDetail(); updateTabCounts();
        APP.toast('地点已保存', 'success');
        return true;
      }
    });
  }

  function editItem(it) {
    APP.modal({
      title: '编辑物品 · ' + it.name,
      submitText: '保存',
      bodyHtml: `
        <div class="field"><label>物品名称</label><input class="input" name="name" value="${APP.esc(it.name)}"></div>
        <div class="field"><label>类型</label><input class="input" name="type" value="${APP.esc(it.type)}"></div>
        <div class="field"><label>持有者</label><input class="input" name="owner" value="${APP.esc(it.owner || '')}"></div>
        <div class="field"><label>描述</label><textarea class="textarea" name="desc" rows="3">${APP.esc(it.desc)}</textarea></div>`,
      onSubmit: (root) => {
        const f = APP.formData(root);
        if (!f.name.trim()) { APP.toast('名称不能为空', 'warn'); return false; }
        APP.store.updateItem(it.id, { name: f.name.trim(), type: f.type.trim() || '道具', owner: f.owner.trim(), desc: f.desc });
        selected = it.id;
        renderGrid(); renderDetail(); updateTabCounts();
        APP.toast('物品已保存', 'success');
        return true;
      }
    });
  }

  function editForeshadow(f) {
    APP.modal({
      title: '编辑伏笔',
      submitText: '保存',
      bodyHtml: `
        <div class="field"><label>伏笔内容</label><textarea class="textarea" name="text" rows="2">${APP.esc(f.text)}</textarea></div>
        <div class="field"><label>埋设位置</label><input class="input" name="where" value="${APP.esc(f.where)}"></div>
        <div class="field"><label>回收提示</label><input class="input" name="note" value="${APP.esc(f.note)}"></div>`,
      onSubmit: (root) => {
        const fd = APP.formData(root);
        if (!fd.text.trim()) { APP.toast('伏笔内容不能为空', 'warn'); return false; }
        APP.store.updateForeshadow(f.id, { text: fd.text.trim(), where: fd.where, note: fd.note });
        selected = f.id;
        renderGrid(); renderDetail(); updateTabCounts();
        APP.toast('伏笔已保存', 'success');
        return true;
      }
    });
  }

  function editTimeline(n) {
    APP.modal({
      title: '编辑时间线事件',
      submitText: '保存',
      bodyHtml: `
        <div class="field"><label>时间 / 阶段</label><input class="input" name="t" value="${APP.esc(n.t)}" placeholder="例如：第一卷 / 百年前"></div>
        <div class="field"><label>事件</label><textarea class="textarea" name="e" rows="2">${APP.esc(n.e)}</textarea></div>`,
      onSubmit: (root) => {
        const f = APP.formData(root);
        if (!f.e.trim()) { APP.toast('事件内容不能为空', 'warn'); return false; }
        APP.store.updateTimeline(n.id, { t: f.t.trim() || '未知', e: f.e.trim() });
        selected = n.id;
        renderGrid(); renderDetail(); updateTabCounts();
        APP.toast('时间线已保存', 'success');
        return true;
      }
    });
  }

  async function checkChar(c) {
    APP.toast('正在检查人设一致性…', '');
    try {
      const res = await APP.ai.complete({
        parts: [], user: `请检查以下人物设定是否与常见写作规范冲突（自相矛盾、逻辑漏洞等），若无问题请回复「一切正常」：
${c.name}（${c.role}）：${c.brief}　性格：${(c.traits || []).join('、')}　台词：${c.speech}`,
        system: '你是小说编辑，专注人设一致性。回答简洁。'
      });
      APP.toast('检查完成：' + res.slice(0, 40), 'success');
    } catch (e) { APP.toast('检查失败：' + e.message, 'warn'); }
  }

  /* ---------- 新建条目 ---------- */
  document.getElementById('btn-add').addEventListener('click', () => {
    const maps = {
      chars: {
        title: '新建人物', fields: `
          <div class="field"><label>姓名</label><input class="input" name="name" placeholder="例如：洛薇薇"></div>
          <div class="field"><label>定位</label><input class="input" name="role" placeholder="例如：女配 · 守林人的女儿"></div>
          <div class="field"><label>简介</label><textarea class="textarea" name="brief" rows="3" placeholder="一句话人设描述"></textarea></div>
          <div class="field"><label>性格标签（逗号分隔）</label><input class="input" name="traits" placeholder="温柔, 外冷内热"></div>
          <div class="field"><label>习惯台词</label><input class="input" name="speech"></div>`,
        submit: (f) => {
          if (!f.name.trim()) { APP.toast('请填写姓名', 'warn'); return false; }
          const c = APP.store.addChar({
            name: f.name.trim(), role: f.role || '新角色', brief: f.brief || '',
            traits: f.traits.split(/[,，]/).map(x => x.trim()).filter(Boolean),
            speech: f.speech || '', relation: '', meta: {}, confirmed: true,
            color: 'linear-gradient(135deg,#B9A7E0,#F2B8A8)'
          });
          selected = c.id;
          return true;
        }
      },
      loc: {
        title: '新建地点', fields: `
          <div class="field"><label>地点名称</label><input class="input" name="name" placeholder="例如：银月之井"></div>
          <div class="field"><label>类型</label><input class="input" name="type" placeholder="城市 / 秘境 / 地标"></div>
          <div class="field"><label>描述</label><textarea class="textarea" name="desc" rows="3"></textarea></div>
          <div class="field"><label>标签（逗号分隔）</label><input class="input" name="tags" placeholder="第二卷, 主线"></div>`,
        submit: (f) => {
          if (!f.name.trim()) { APP.toast('请填写地点名称', 'warn'); return false; }
          const l = APP.store.addLocation({ name: f.name.trim(), type: f.type || '地点', desc: f.desc || '', tags: f.tags.split(/[,，]/).map(x => x.trim()).filter(Boolean) });
          selected = l.id;
          return true;
        }
      },
      item: {
        title: '新建物品', fields: `
          <div class="field"><label>物品名称</label><input class="input" name="name" placeholder="例如：碎星盏"></div>
          <div class="field"><label>类型</label><input class="input" name="type" placeholder="神器 / 法器 / 道具"></div>
          <div class="field"><label>持有者</label><input class="input" name="owner"></div>
          <div class="field"><label>描述</label><textarea class="textarea" name="desc" rows="3"></textarea></div>`,
        submit: (f) => {
          if (!f.name.trim()) { APP.toast('请填写物品名称', 'warn'); return false; }
          const it = APP.store.addItem({ name: f.name.trim(), type: f.type || '道具', owner: f.owner, desc: f.desc || '' });
          selected = it.id;
          return true;
        }
      },
      fs: {
        title: '新建伏笔', fields: `
          <div class="field"><label>伏笔内容</label><textarea class="textarea" name="text" rows="2" placeholder="例如：凛的月牙形旧疤…"></textarea></div>
          <div class="field"><label>埋设位置</label><input class="input" name="where" placeholder="第N章 · 标题"></div>
          <div class="field"><label>回收提示</label><input class="input" name="note"></div>`,
        submit: (f) => {
          if (!f.text.trim()) { APP.toast('请填写伏笔内容', 'warn'); return false; }
          const fs = APP.store.addForeshadow({ text: f.text.trim(), where: f.where || '待定', note: f.note || '' });
          selected = fs.id;
          return true;
        }
      },
      timeline: {
        title: '新建时间线事件', fields: `
          <div class="field"><label>时间 / 阶段</label><input class="input" name="t" placeholder="例如：第一卷 / 百年前"></div>
          <div class="field"><label>事件</label><textarea class="textarea" name="e" rows="2" placeholder="发生了什么"></textarea></div>`,
        submit: (f) => {
          if (!f.e.trim()) { APP.toast('请填写事件内容', 'warn'); return false; }
          const n = APP.store.addTimeline({ t: f.t.trim() || '未知', e: f.e.trim() });
          selected = n.id;
          return true;
        }
      }
    };
    const m = maps[tab] || maps.chars;
    APP.modal({
      title: m.title,
      submitText: '创建',
      bodyHtml: m.fields,
      onSubmit: (root) => {
        const f = APP.formData(root);
        const ok = m.submit(f);
        if (ok === false) return false;
        renderGrid(); renderDetail(); updateTabCounts();
        APP.toast('已创建' + (TITLE[tab] || ''), 'success');
        return true;
      }
    });
  });

  /* ---------- AI 批量生成设定 ---------- */
  document.getElementById('btn-ai-gen').addEventListener('click', async () => {
    const btn = document.getElementById('btn-ai-gen');
    btn.textContent = '生成中…'; btn.disabled = true;
    APP.toast('AI 正在生成设定，即将进入待确认队列…', '');
    try {
      const p = APP.store.currentProject() || { title: '新书', genre: '未分类' };
      const what = { chars: '人物', loc: '地点', item: '物品', fs: '伏笔', timeline: '时间线事件' }[tab] || '设定';
      const res = await APP.ai.complete({
        parts: [], user: `为${p.genre || ''}小说《${p.title}》生成 4 个新的${what}设定条目，逐条输出，每一条写成一行「名称/标题 —— 描述」。风格要贴合现有的细腻治愈、马卡龙清新世界观。`,
        system: '你是世界观与设定策划。输出简洁条目。'
      });
      const lines = res.trim().split(/\n+/).map(x => x.trim()).filter(x => x).slice(0, 4);
      let added = 0;
      lines.forEach(line => {
        const [t, ...rest] = line.split(/——|-{2,}|：/, 2);
        const name = (t || '未命名').replace(/^[0-9一二三四五六七八九十]+[\.、\s]/, '').trim();
        const desc = (rest[0] || '').trim();
        if (!name || name === '未命名') return;
        if (tab === 'chars') {
          const c = APP.store.addChar({ name, role: '新角色（AI 生成）', brief: desc, traits: [], speech: '', relation: '', meta: {}, confirmed: false, color: 'linear-gradient(135deg,#9FC4DE,#B9A7E0)' });
          selected = c.id;
        }
        else if (tab === 'loc') { const l = APP.store.addLocation({ name, type: '新地点', desc, tags: [] }); selected = l.id; }
        else if (tab === 'item') { const i = APP.store.addItem({ name, type: '新道具', owner: '', desc }); selected = i.id; }
        else if (tab === 'timeline') { const t = APP.store.addTimeline({ t: name, e: desc }); selected = t.id; }
        else { const f = APP.store.addForeshadow({ text: desc || name, where: '待定', note: '' }); selected = f.id; }
        added++;
      });
      renderGrid(); renderDetail(); updateTabCounts();
      APP.toast(added ? ('已生成 ' + added + ' 条' + what + (tab === 'chars' ? '，请在详情中确认入库' : '')) : 'AI 未返回有效条目，可重试', added ? 'success' : 'warn');
    } catch (e) {
      APP.toast('生成失败：' + e.message, 'warn');
    }
    btn.textContent = 'AI 生成设定'; btn.disabled = false;
  });

  /* ---------- 类型切换 ---------- */
  document.getElementById('world-tabs').addEventListener('click', e => {
    const t = e.target.closest('.world-tab'); if (!t) return;
    document.querySelectorAll('.world-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    tab = t.dataset.t;
    const pool = { chars: D.characters, loc: D.locations, item: D.items, fs: D.foreshadows, timeline: D.timeline || [] }[tab] || [];
    selected = pool[0] ? pool[0].id : '';
    renderGrid(); renderDetail();
  });

  /* ---------- 启动 ---------- */
  renderGrid();
  renderDetail();
  updateTabCounts();

  /* 桌面端磁盘恢复就绪后刷新 */
  APP.store.onReady(() => { renderGrid(); renderDetail(); updateTabCounts(); });
})();

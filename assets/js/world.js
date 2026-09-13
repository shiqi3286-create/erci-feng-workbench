/* 晴笺 · 设定库页逻辑
 * 人物 / 地点 / 物品 / 伏笔 / 时间线；新建 / 编辑 / 删除 / AI 生成 / 引用到写作区
 */
(function () {
  const D = APP.store.init(window.DATA);
  let tab = 'chars';
  let selected = 'c-lin';

  const TITLE = { chars: '人物设定', loc: '地点档案', item: '物品 · 功法', fs: '伏笔库', timeline: '时间线' };

  /* 头像：优先用生成的图片，加载失败回退到渐变 + 首字 */
  function avatarHTML(c, cls) {
    const letter = APP.esc((c.name || '?').slice(0, 1));
    const img = c.avatar ? `<img src="${c.avatar}" onerror="this.remove()" alt="">` : '';
    return `<span class="${cls || 'char-avatar'}" style="background:${c.color};color:#fff;position:relative;overflow:hidden">${img}<span class="av-letter" style="position:relative">${letter}</span></span>`;
  }

  function countFor(t) {
    return { chars: D.characters.length, loc: D.locations.length, item: D.items.length, fs: D.foreshadows.length, timeline: 1 }[t] || 0;
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
          <div class="char-card" data-id="${c.id}" style="${c.id === selected ? 'box-shadow:0 0 0 3px rgba(232,155,84,.2),var(--shadow-card)' : ''}">
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
        grid.appendChild(APP.el(`
          <div class="plain-card">
            <div class="flex gap-10 mb-14"><span class="tag tag-sky">${l.type}</span><span class="small muted">${(l.tags || []).join(' · ')}</span></div>
            <div style="font-weight:700;font-size:15px;font-family:var(--font-display)">${APP.esc(l.name)}</div>
            <p class="small muted" style="margin-top:5px">${APP.esc(l.desc)}</p>
          </div>`));
      });
    } else if (tab === 'item') {
      D.items.forEach(it => {
        grid.appendChild(APP.el(`
          <div class="plain-card">
            <div class="flex gap-10 mb-14"><span class="tag tag-lilac">${it.type}</span><span class="small muted">持有者 · ${APP.esc(it.owner)}</span></div>
            <div style="font-weight:700;font-size:15px;font-family:var(--font-display)">${APP.esc(it.name)}</div>
            <p class="small muted" style="margin-top:5px">${APP.esc(it.desc)}</p>
          </div>`));
      });
    } else if (tab === 'fs') {
      const board = APP.el(`<div class="fs-board"></div>`);
      D.foreshadows.forEach(f => {
        board.appendChild(APP.el(`
          <div class="fs-board-card ${f.status === 'closed' ? 'closed' : ''}" data-fs="${f.id}">
            <div class="h"><span class="dot ${f.status}" style="width:8px;height:8px;border-radius:50%;background:${f.status === 'open' ? 'var(--coral)' : 'var(--mint)'}"></span>
            <span>${APP.esc(f.text)}</span><span class="spacer"></span>
            <span class="tag ${f.status === 'open' ? 'tag-coral' : 'tag-mint'}">${f.status === 'open' ? '未回收' : '已回收'}</span></div>
            <div class="loc">${APP.esc(f.where)}</div>
            <div class="note">回收提示：${APP.esc(f.note)}</div>
          </div>`));
      });
      grid.appendChild(board);
    } else {
      const tl = [
        { t: '百年前', e: '星之子陨落，森林封印『坠落的星』' },
        { t: '第一卷', e: '凛在灰烬之城苏醒（失忆）· 遇见陆沉 / 阿澈离开' },
        { t: '第二卷', e: '入星落之森 · 灯火熄灭 · 星辉首次自主回应（当前）' },
        { t: '第三卷', e: '身世揭露 · 百年前的雪（待规划）' }
      ];
      const board = APP.el(`<div class="fs-board"></div>`);
      tl.forEach(n => {
        board.appendChild(APP.el(`
          <div class="fs-board-card" style="border-left-color:var(--sky)">
            <div class="h"><span class="tag tag-sky">${n.t}</span><span>${APP.esc(n.e)}</span></div>
          </div>`));
      });
      grid.appendChild(board);
    }
  }

  /* ---------- 详情 ---------- */
  function renderDetail() {
    const pane = document.getElementById('wt-detail');
    if (tab === 'chars') {
      const c = D.characters.find(x => x.id === selected) || D.characters[0];
      if (!c) { pane.innerHTML = '<div class="empty"><p class="t">新建一位人物</p><p class="d">点击右上角「＋ 新建」添加人物设定。</p></div>'; return; }
      pane.innerHTML = `
        <div class="h">
          ${avatarHTML(c, 'char-avatar')}
          <div><div class="t">${APP.esc(c.name)}</div><div class="small" style="color:var(--sun);font-weight:600">${APP.esc(c.role)}</div></div>
        </div>
        <p class="small muted">${APP.esc(c.brief)}</p>
        <div class="sec"><div class="st">性格标签</div><div class="flex gap-6">${(c.traits || []).map(t => `<span class="tag tag-sun">${APP.esc(t)}</span>`).join('')}</div></div>
        <div class="sec"><div class="st">习惯台词</div><p style="color:var(--sun)">「${APP.esc(c.speech)}」</p></div>
        <div class="sec"><div class="st">人物关系</div><p>${APP.esc(c.relation)}</p></div>
        <div class="sec"><div class="st">基础信息</div>
          <div class="kv-grid">${c.meta ? Object.entries(c.meta).map(([k, v]) => `<div><div class="k">${APP.esc(k)}</div><div class="v">${APP.esc(v)}</div></div>`).join('') : '<span class="small muted">—</span>'}</div>
        </div>
        <div class="sec"><div class="st">AI 联动</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="btn btn-primary btn-block" id="btn-ai-gen-ref">引用到写作区</button>
            <button class="btn btn-ghost btn-block" id="btn-ai-gen-check">检查人设一致性</button>
          </div>
        </div>
        <div class="sec"><div class="st">更多</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-block" id="btn-edit">编辑</button>
            <button class="btn btn-ghost btn-block" id="btn-del" style="color:var(--coral)">删除</button>
          </div>
        </div>`;
      $('#btn-edit').addEventListener('click', () => editChar(c));
      $('#btn-del').addEventListener('click', () => delChar(c));
      $('#btn-ai-gen-ref').addEventListener('click', () => {
        D.pendingInject = { name: c.name, text: '【人物】' + c.name + '（' + c.role + '）：' + (c.summary || c.brief || '') };
        APP.store.save();
        APP.toast('已添加到写作区指令框', 'success');
        location.href = 'workspace.html';
      });
      $('#btn-ai-gen-check').addEventListener('click', () => checkChar(c));
    } else {
      pane.innerHTML = '<div class="empty"><p class="t">查看条目详情</p><p class="d">在左侧选择类型与条目，这里展示完整设定与 AI 联动操作。</p></div>';
    }
  }

  /* ---------- 人物：编辑 / 删除 / 检查 ---------- */
  function editChar(c) {
    APP.modal({
      title: '编辑人物 · ' + c.name,
      submitText: '保存',
      bodyHtml: `
        <div class="field"><label>姓名</label><input class="input" name="name" value="${APP.esc(c.name)}"></div>
        <div class="field"><label>定位</label><input class="input" name="role" value="${APP.esc(c.role)}"></div>
        <div class="field"><label>简介</label><textarea class="textarea" name="brief" rows="3">${APP.esc(c.brief)}</textarea></div>
        <div class="field"><label>习惯台词</label><input class="input" name="speech" value="${APP.esc(c.speech)}"></div>
        <div class="field"><label>人物关系</label><input class="input" name="relation" value="${APP.esc(c.relation)}"></div>`,
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
  }
  function delChar(c) {
    if (!confirm('确定删除人物「' + c.name + '」？')) return;
    APP.store.removeChar(c.id);
    selected = D.characters[0] ? D.characters[0].id : '';
    renderGrid(); renderDetail(); updateTabCounts();
    APP.toast('已删除人物', 'success');
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
          APP.store.addChar({
            name: f.name.trim(), role: f.role || '新角色', brief: f.brief || '',
            traits: f.traits.split(/[,，]/).map(x => x.trim()).filter(Boolean),
            speech: f.speech || '', relation: '', meta: {}, confirmed: false,
            color: 'linear-gradient(135deg,#B9A7E0,#F2B8A8)'
          });
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
          APP.store.addLocation({ name: f.name.trim(), type: f.type || '地点', desc: f.desc || '', tags: f.tags.split(/[,，]/).map(x => x.trim()).filter(Boolean) });
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
          APP.store.addItem({ name: f.name.trim(), type: f.type || '道具', owner: f.owner, desc: f.desc || '' });
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
          APP.store.addForeshadow({ text: f.text.trim(), where: f.where || '待定', note: f.note || '' });
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
      const what = { chars: '人物', loc: '地点', item: '物品', fs: '伏笔' }[tab] || '设定';
      const res = await APP.ai.complete({
        parts: [], user: `为治愈奇幻小说《星落之森》生成 4 个新的${what}设定条目，逐条输出，每一条写成一行「名称/标题 —— 描述」。风格要贴合现有的细腻治愈、马卡龙清新世界观。`,
        system: '你是世界观与设定策划。输出简洁条目。'
      });
      const lines = res.trim().split(/\n+/).map(x => x.trim()).filter(x => x).slice(0, 4);
      let added = 0;
      lines.forEach(line => {
        const [t, ...rest] = line.split(/——|-{2,}|：/, 2);
        const name = (t || '未命名').replace(/^[0-9一二三四五六七八九十]+[\.、\s]/, '').trim();
        const desc = (rest[0] || '').trim();
        if (!name || name === '未命名') return;
        if (tab === 'chars') APP.store.addChar({ name, role: '新角色（AI 识别）', brief: desc, traits: [], speech: '', relation: '', meta: {}, confirmed: false, color: 'linear-gradient(135deg,#9FC4DE,#B9A7E0)' });
        else if (tab === 'loc') APP.store.addLocation({ name, type: '新地点', desc, tags: [] });
        else if (tab === 'item') APP.store.addItem({ name, type: '新道具', owner: '', desc });
        else APP.store.addForeshadow({ text: desc || name, where: '待定', note: '' });
        added++;
      });
      if (tab === 'chars') selected = D.characters[D.characters.length - 1].id;
      renderGrid(); renderDetail(); updateTabCounts();
      APP.toast('已生成 ' + added + ' 条' + what + '（待确认）', 'success');
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
    selected = D.characters[0] && D.characters[0].id;
    renderGrid(); renderDetail();
  });

  /* ---------- 启动 ---------- */
  renderGrid();
  renderDetail();
  updateTabCounts();
})();
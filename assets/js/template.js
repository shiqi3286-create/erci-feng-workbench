/* 晴笺 · 模板与 API 设置页逻辑
 * 提示词模板（保存/新建/删除/发送测试）+ API 渠道（增删改/设默认/启停）
 */
(function () {
  const D = APP.store.init(window.DATA);
  const $ = s => document.querySelector(s);
  let activeTpl = (D.templates[0] && D.templates[0].items[0] && D.templates[0].items[0].id) || 'tp1';

  /* ---------- 工具 ---------- */
  function flatTemplates() { return D.templates.flatMap(g => g.items.map(t => ({ ...t, group: g.group }))); }
  function updateCounts() {
    const all = flatTemplates();
    const groups = D.templates.length;
    const el = document.getElementById('tpl-count');
    if (el) el.textContent = all.length + ' 个模板 · ' + groups + ' 组';
    const apis = D.apis.filter(a => a.enabled && a.base && a.key && !a.key.includes('••')).length;
    const ac = document.getElementById('api-count');
    if (ac) ac.textContent = apis + ' / ' + D.apis.length + ' 可用';
  }

  /* ---------- 模板分组与列表 ---------- */
  function renderGroups() {
    const wrap = document.getElementById('tpl-groups');
    wrap.innerHTML = '';
    D.templates.forEach(group => {
      const title = APP.el(`<div class="tpl-group-title">${APP.esc(group.group)} <span class="small muted">${group.items.length}</span></div>`);
      const grid = APP.el(`<div class="tpl-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px"></div>`);
      wrap.appendChild(title);
      wrap.appendChild(grid);
      group.items.forEach(t => {
        const card = APP.el(`
          <div class="tpl-card ${t.id === activeTpl ? 'active' : ''}" data-id="${t.id}">
            <div class="t">${APP.icon(t.icon || 'pen')} ${APP.esc(t.name)}</div>
            <div class="d">${APP.esc(t.desc)}</div>
            <div class="mt-8">${(t.vars || []).map(v => `<span class="tpl-var">${APP.esc(v)}</span>`).join('')}</div>
          </div>`);
        card.addEventListener('click', () => { activeTpl = t.id; renderGroups(); renderDetail(); });
        grid.appendChild(card);
      });
    });
  }

  /* ---------- 模板详情 / 编辑 / 测试 ---------- */
  function defaultPrompt(t) {
    return `你是一位资深小说家。请根据以下内容${t.name === '润色段落' ? '润色' : '生成'}，要求：\n1. 保持原作世界观与人物口吻\n2. 不偏离剧情主线\n3. 输出为可直接粘贴的正文\n\n${t.name === '续写正文' ? '—— 以下为本章大纲与上文 ——\n{{本章大纲}}\n{{上文}}' : '—— 以下为输入素材 ——\n' + ((t.vars && t.vars[0]) || '{{选中文本}}')}`;
  }

  function renderDetail() {
    const all = flatTemplates();
    const t = all.find(x => x.id === activeTpl) || all[0];
    if (!t) { document.getElementById('tpl-detail').innerHTML = '<div class="empty"><p class="t">还没有模板</p><p class="d">点击「＋ 新建模板」创建。</p></div>'; return; }
    const prompt = t.prompt || defaultPrompt(t);
    const pane = document.getElementById('tpl-detail');
    pane.innerHTML = `
      <div class="h">
        <span class="t">${APP.esc(t.name)}</span>
        <span class="spacer" style="flex:1"></span>
        <span class="tag tag-mute">${APP.esc(t.group)}</span>
      </div>
      <div class="field"><label>模板名称</label><input class="input" name="tpl-name" value="${APP.esc(t.name)}"></div>
      <div class="field"><label>用途说明</label><textarea class="textarea" name="tpl-desc" rows="2">${APP.esc(t.desc)}</textarea></div>
      <div class="field">
        <label>可用变量（写作时自动替换）</label>
        <div class="flex gap-6" style="flex-wrap:wrap">${(t.vars || []).map(v => `<span class="tpl-var">${APP.esc(v)}</span>`).join('')}</div>
      </div>
      <div class="field">
        <label>提示词内容</label>
        <textarea class="textarea" rows="9" name="tpl-prompt">${APP.esc(prompt)}</textarea>
        <span class="hint">变量以双花括号包裹，发送时自动替换为实际内容</span>
      </div>
      <div class="field">
        <label>生成参数</label>
        <div class="kv-grid">
          <div><div class="k">temperature</div><input class="input" type="number" step="0.05" min="0" max="1.5" name="tpl-temp" value="${t.params.temp}"></div>
          <div><div class="k">最大输出</div><input class="input" type="number" name="tpl-max" value="${t.params.max}"> 字</div>
        </div>
      </div>
      <div class="flex gap-6">
        <button class="btn btn-primary" id="btn-tpl-save">保存模板</button>
        <button class="btn btn-ghost" id="btn-tpl-test">发送测试</button>
        <button class="btn btn-ghost" id="btn-tpl-del" style="color:var(--coral)">删除</button>
      </div>`;

    $('#btn-tpl-save').addEventListener('click', () => {
      APP.store.saveTemplate(t.id, {
        name: $('[name=tpl-name]').value.trim() || t.name,
        desc: $('[name=tpl-desc]').value,
        prompt: $('[name=tpl-prompt]').value,
        params: { temp: +$('[name=tpl-temp]').value || 0.8, max: +$('[name=tpl-max]').value || 2000 }
      });
      renderGroups(); renderDetail(); updateCounts();
      APP.toast('模板已保存', 'success');
    });
    $('#btn-tpl-test').addEventListener('click', async () => {
      const btn = $('#btn-tpl-test');
      btn.textContent = '测试中…'; btn.disabled = true;
      try {
        const text = await APP.ai.complete({ parts: [], user: $('[name=tpl-prompt]').value, params: { temperature: +$('[name=tpl-temp]').value || 0.8, maxTokens: +$('[name=tpl-max]').value || 800 }, forceDemo: false });
        APP.toast('测试成功：' + text.slice(0, 30) + '…', 'success');
      } catch (e) { APP.toast('测试失败：' + e.message, 'warn'); }
      btn.textContent = '发送测试'; btn.disabled = false;
    });
    $('#btn-tpl-del').addEventListener('click', () => {
      if (!confirm('删除模板「' + t.name + '」？')) return;
      APP.store.deleteTemplate(t.id);
      const rest = flatTemplates();
      activeTpl = rest.length ? rest[0].id : '';
      renderGroups(); renderDetail(); updateCounts();
      APP.toast('模板已删除', 'success');
    });
  }

  /* ---------- 新建模板 ---------- */
  document.getElementById('btn-add-tpl').addEventListener('click', () => {
    APP.modal({
      title: '新建模板',
      submitText: '创建',
      bodyHtml: `
        <div class="field"><label>分组</label><input class="input" name="group" value="创作生成"></div>
        <div class="field"><label>模板名称</label><input class="input" name="name" placeholder="例如：场景氛围描写"></div>
        <div class="field"><label>用途说明</label><input class="input" name="desc" placeholder="一句话说明用途"></div>`,
      onSubmit: (root) => {
        const f = APP.formData(root);
        if (!f.name.trim()) { APP.toast('请填写模板名称', 'warn'); return false; }
        const t = APP.store.addTemplate(f.group.trim() || '自定义', {
          name: f.name.trim(), desc: f.desc || '', icon: 'pen', vars: ['{{选中文本}}'],
          params: { temp: 0.8, max: 1200 },
          prompt: defaultPrompt({ name: f.name.trim(), vars: ['{{选中文本}}'] })
        });
        activeTpl = t.id;
        renderGroups(); renderDetail(); updateCounts();
        APP.toast('模板已创建', 'success');
        return true;
      }
    });
  });

  /* ---------- API 渠道 ---------- */
  function renderApis() {
    const grid = document.getElementById('api-grid');
    grid.innerHTML = '';
    const usable = D.apis.filter(a => a.enabled && a.base && a.key && !a.key.includes('••')).map(a => a.id);
    D.apis.forEach(a => {
      const isOn = usable.includes(a.id);
      const isDefault = D.defaultApi === a.id;
      const card = APP.el(`
        <div class="api-card">
          <div class="h">
            <span class="api-badge ${isOn ? 'on' : 'off'}">${isOn ? '可用' : '未启用'}</span>
            <b style="font-family:var(--font-display)">${APP.esc(a.name)}</b>
            ${isDefault ? '<span class="tag tag-sun" style="font-size:10px">默认</span>' : ''}
            <span class="spacer" style="flex:1"></span>
            <span class="small muted mono">${APP.esc(a.model)}</span>
          </div>
          <div class="kv-grid">
            <div><div class="k">接口地址</div><div class="v">${APP.esc(a.base || '—')}</div></div>
            <div><div class="k">API Key</div><div class="v">${a.key ? '已配置' : '—'}</div></div>
            <div><div class="k">temperature</div><div class="v">${a.temp}</div></div>
            <div><div class="k">本次累计</div><div class="v">${(a.used || 0).toLocaleString()} tokens</div></div>
          </div>
          <div class="flex-between mt-14">
            <span class="small muted">${APP.esc(a.quota || '—')}</span>
            <div class="flex gap-6">
              <button class="chip" data-act="default">默认</button>
              <button class="chip" data-act="enable">${a.enabled ? '停用' : '启用'}</button>
              <button class="chip" data-act="edit">编辑</button>
              <button class="chip" data-act="del" style="color:var(--coral)">删除</button>
            </div>
          </div>
        </div>`);
      grid.appendChild(card);
      card.querySelector('[data-act=default]').addEventListener('click', () => { APP.store.setDefaultApi(a.id); renderApis(); APP.toast('已设为默认渠道', 'success'); });
      card.querySelector('[data-act=enable]').addEventListener('click', () => { APP.store.saveApi(a.id, { enabled: !a.enabled }); renderApis(); });
      card.querySelector('[data-act=edit]').addEventListener('click', () => editApi(a));
      card.querySelector('[data-act=del]').addEventListener('click', () => {
        if (!confirm('删除渠道「' + a.name + '」？')) return;
        APP.store.removeApi(a.id); renderApis(); updateCounts();
        APP.toast('渠道已删除', 'success');
      });
    });
  }

  function editApi(a) {
    APP.modal({
      title: '编辑渠道 · ' + a.name,
      submitText: '保存',
      bodyHtml: `
        <div class="field"><label>渠道名称</label><input class="input" name="name" value="${APP.esc(a.name)}"></div>
        <div class="field"><label>接口地址</label><input class="input" name="base" value="${APP.esc(a.base)}" placeholder="https://api.xxx.com/v1"></div>
        <div class="field"><label>模型</label><input class="input" name="model" value="${APP.esc(a.model)}" placeholder="deepseek-v3"></div>
        <div class="field"><label>API Key</label><input class="input" name="key" value="${a.key && !a.key.includes('••') ? a.key : ''}" placeholder="${a.key && a.key.includes('••') ? '已配置（留空保持不变）' : 'sk-…'}"></div>
        <div class="field"><label>temperature</label><input class="input" type="number" step="0.05" min="0" max="1.5" name="temp" value="${a.temp}"></div>`,
      onSubmit: (root) => {
        const f = APP.formData(root);
        if (!f.name.trim() || !f.base.trim()) { APP.toast('名称与接口地址不能为空', 'warn'); return false; }
        const key = f.key.trim() || (a.key && !a.key.includes('••') ? a.key : '');
        APP.store.saveApi(a.id, { name: f.name.trim(), base: f.base.trim(), model: f.model.trim() || '—', key, temp: +f.temp || 0.8, enabled: !!(key && f.base.trim()) });
        renderApis(); updateCounts();
        APP.toast('渠道已保存', 'success');
        return true;
      }
    });
  }

  document.getElementById('btn-add-api').addEventListener('click', () => {
    APP.modal({
      title: '添加 API 渠道',
      submitText: '保存',
      bodyHtml: `
        <div class="field"><label>渠道名称</label><input class="input" name="name" placeholder="例如：主力中转"></div>
        <div class="field"><label>接口地址</label><input class="input" name="base" placeholder="https://api.xxx.com/v1"></div>
        <div class="field"><label>模型</label><input class="input" name="model" placeholder="deepseek-v3"></div>
        <div class="field"><label>API Key</label><input class="input" name="key" placeholder="sk-…"></div>
        <div class="field"><label>temperature</label><input class="input" type="number" step="0.05" min="0" max="1.5" name="temp" value="0.8"></div>
        <p class="hint" style="color:var(--muted)">密钥仅保存在本地浏览器（localStorage），不会上传。</p>`,
      onSubmit: (root) => {
        const f = APP.formData(root);
        if (!f.name.trim() || !f.base.trim()) { APP.toast('名称与接口地址不能为空', 'warn'); return false; }
        APP.store.addApi({ name: f.name.trim(), base: f.base.trim(), model: f.model.trim() || '—', key: f.key.trim(), enabled: !!(f.key.trim() && f.base.trim()), temp: +f.temp || 0.8 });
        renderApis(); updateCounts();
        APP.toast('渠道已添加', 'success');
        return true;
      }
    });
  });

  /* ---------- 模板导入导出 ---------- */
  document.getElementById('btn-export-tpl').addEventListener('click', () => {
    APP.downloadText('qingjian-templates.json', JSON.stringify(D.templates, null, 2), 'application/json');
    APP.toast('模板已导出为 JSON 文件', 'success');
  });
  document.getElementById('btn-import-tpl').addEventListener('click', () => {
    document.getElementById('tpl-file').click();
  });
  document.getElementById('tpl-file').addEventListener('change', () => {
    const input = document.getElementById('tpl-file');
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const list = JSON.parse(reader.result);
        const n = APP.store.importTemplates(list);
        if (!n) throw new Error('文件中没有可导入的模板');
        renderGroups(); renderDetail(); updateCounts();
        APP.toast('已导入 ' + n + ' 个模板（同名分组自动合并）', 'success');
      } catch (e) {
        APP.toast('导入失败：' + e.message, 'warn');
      }
    };
    reader.readAsText(file, 'utf-8');
  });

  /* ---------- 版本与更新 ---------- */
  const verEl = document.getElementById('app-version');
  if (verEl) {
    APP.updater.currentVersion().then(v => { verEl.textContent = v ? 'v' + v : '浏览器预览'; });
  }
  const checkBtn = document.getElementById('btn-check-update');
  if (checkBtn) {
    checkBtn.addEventListener('click', () => {
      checkBtn.textContent = '检查中…'; checkBtn.disabled = true;
      APP.updater.check(true).finally(() => { checkBtn.textContent = '检查更新'; checkBtn.disabled = false; });
    });
  }
  const relBtn = document.getElementById('btn-open-releases');
  if (relBtn) relBtn.addEventListener('click', () => APP.updater.openReleases());

  /* ---------- 安全策略开关 ---------- */
  const sw = document.getElementById('ai-switch');
  sw.classList.toggle('on', !!D.user.aiAutoSend);
  sw.addEventListener('click', () => {
    D.user.aiAutoSend = !D.user.aiAutoSend;
    APP.store.save();
    sw.classList.toggle('on', D.user.aiAutoSend);
    APP.toast(D.user.aiAutoSend ? 'AI 自动发送已开启' : 'AI 自动发送已关闭', 'success');
  });

  /* ---------- 启动 ---------- */
  renderGroups();
  renderDetail();
  renderApis();
  updateCounts();
})();
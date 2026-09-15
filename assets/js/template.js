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

  /* ---------- API 渠道：左列表（写作/画图分组） + 右内联编辑 ---------- */
  const EDITOR_EMPTY = '<div class="empty" style="padding:30px 16px"><p class="t">API 渠道编辑</p><p class="d">点击左侧渠道卡片的「编辑」，或上方「＋ 写作/画图渠道」开始配置。</p></div>';

  function renderApis() {
    const list = document.getElementById('api-list');
    if (!list) return;
    const texts = D.apis.filter(a => a.type !== 'image');
    const images = D.apis.filter(a => a.type === 'image');
    const card = a => {
      const isOn = a.enabled && a.base && a.key && !a.key.includes('••');
      const isDefault = (a.type === 'image' ? D.defaultImageApi : D.defaultApi) === a.id;
      return `
        <div class="api-card" data-id="${a.id}">
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
        </div>`;
    };
    const group = (title, arr) =>
      `<div class="tpl-group-title">${title} <span class="small muted">${arr.length}</span></div>` +
      (arr.length ? arr.map(card).join('') : '<div class="empty" style="padding:16px"><p class="d">暂无渠道，点右上角添加。</p></div>');
    list.innerHTML = group('写作渠道', texts) + group('画图渠道', images);

    list.querySelectorAll('[data-act]').forEach(btn => {
      const a = D.apis.find(x => x.id === btn.closest('.api-card').dataset.id);
      if (!a) return;
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (act === 'default') {
          APP.store.setDefaultApi(a.id, a.type || 'text');
          renderApis(); updateCounts();
          APP.toast('已设为默认' + (a.type === 'image' ? '画图' : '写作') + '渠道', 'success');
        } else if (act === 'enable') {
          APP.store.saveApi(a.id, { enabled: !a.enabled });
          renderApis(); updateCounts();
        } else if (act === 'edit') {
          renderApiEditor(a);
        } else if (act === 'del') {
          if (!confirm('删除渠道「' + a.name + '」？')) return;
          APP.store.removeApi(a.id); renderApis(); updateCounts();
          renderApiEditor(null);
          APP.toast('渠道已删除', 'success');
        }
      });
    });
  }

  /* 表单当前生效的 Key：新填优先，否则用存量（含脱敏占位） */
  function editorKey(a) {
    const inp = document.querySelector('#api-editor [name=key]');
    if (inp && inp.value.trim()) return inp.value.trim();
    return (a && a.key) || '';
  }

  function renderApiEditor(a, type) {
    const pane = document.getElementById('api-editor');
    if (!pane) return;
    const isNew = !a;
    const chType = a ? a.type : (type || 'text');
    const typeLabel = chType === 'image' ? '画图' : '写作';
    const hasKey = !!(a && a.key);
    pane.innerHTML = `
      <div class="h">
        <span class="t">${isNew ? '添加' : '编辑'}${typeLabel}渠道</span>
        ${chType === 'image' ? '<span class="tag tag-lilac" style="font-size:10px">image</span>' : '<span class="tag tag-sun" style="font-size:10px">text</span>'}
      </div>
      <div class="field"><label>渠道名称</label><input class="input" name="name" value="${a ? APP.esc(a.name) : ''}" placeholder="例如：主力中转"></div>
      <div class="field"><label>接口地址</label><input class="input" name="base" value="${a ? APP.esc(a.base) : ''}" placeholder="https://api.xxx.com/v1"></div>
      <div class="field">
        <label>API Key</label>
        <input class="input" name="key" type="password" autocomplete="off" value="" placeholder="${hasKey ? '已配置（留空保持不变）' : 'sk-…'}">
        <span class="hint">密钥仅保存在本地浏览器，不会上传。</span>
      </div>
      <div class="field">
        <label>模型 <span class="hint">可「拉取模型」自动填充，也可手填</span></label>
        <input class="input" name="model" list="api-model-list" value="${a && a.model && a.model !== '—' ? APP.esc(a.model) : ''}" placeholder="deepseek-v3">
        <datalist id="api-model-list"></datalist>
      </div>
      <div class="field"><label>temperature</label><input class="input" name="temp" type="number" step="0.05" min="0" max="1.5" value="${a ? a.temp : 0.8}"></div>
      <div class="api-test-zone">
        <div class="hint" style="margin-bottom:8px">填写接口地址与 API Key 后，即可拉取模型并测试连通。</div>
        <div class="flex gap-6">
          <button class="btn btn-ghost btn-sm" id="btn-fetch-models" disabled>① 拉取模型</button>
          <button class="btn btn-ghost btn-sm" id="btn-test-conn" disabled>② 测试连通</button>
        </div>
        <div id="api-test-result" class="small" style="margin-top:8px;min-height:18px"></div>
      </div>
      <div class="flex gap-6" style="margin-top:12px">
        <button class="btn btn-primary" id="btn-save-api">保存</button>
        <button class="btn btn-ghost" id="btn-cancel-api">取消</button>
      </div>`;
    bindApiEditor(a, chType);
  }

  function bindApiEditor(a, type) {
    const pane = document.getElementById('api-editor');
    const $n = s => pane.querySelector(s);
    const baseInp = $n('[name=base]');
    const keyInp = $n('[name=key]');
    const modelInp = $n('[name=model]');
    const fetchBtn = $n('#btn-fetch-models');
    const testBtn = $n('#btn-test-conn');
    const resultEl = $n('#api-test-result');

    const refreshButtons = () => {
      const ok = baseInp.value.trim() && (keyInp.value.trim() || (a && a.key));
      if (fetchBtn) fetchBtn.disabled = !ok;
      if (testBtn) testBtn.disabled = !ok;
    };
    baseInp.addEventListener('input', refreshButtons);
    keyInp.addEventListener('input', refreshButtons);
    refreshButtons();

    const showResult = html => { resultEl.innerHTML = html; };

    fetchBtn.addEventListener('click', async () => {
      const base = baseInp.value.trim();
      const key = editorKey(a);
      if (!base || !key) { showResult('<span style="color:var(--coral)">请先填写接口地址与 API Key</span>'); return; }
      fetchBtn.disabled = true; fetchBtn.textContent = '拉取中…';
      showResult('正在请求模型列表…');
      try {
        const models = await APP.ai.listModels(base, key);
        const dl = pane.querySelector('#api-model-list');
        dl.innerHTML = models.map(m => `<option value="${APP.esc(m)}"></option>`).join('');
        if (!modelInp.value.trim()) modelInp.value = models[0] || '';
        showResult(`<span style="color:var(--mint)">✓ 拉取成功：${models.length} 个模型，已填入下拉候选${models[0] ? '（默认 ' + APP.esc(models[0]) + '）' : ''}</span>`);
      } catch (e) {
        showResult(`<span style="color:var(--coral)">✗ 拉取失败：${APP.esc(e.message)}（可继续手填模型）</span>`);
      }
      fetchBtn.textContent = '① 拉取模型'; refreshButtons();
    });

    testBtn.addEventListener('click', async () => {
      const base = baseInp.value.trim();
      const key = editorKey(a);
      const model = modelInp.value.trim() || (a && a.model && a.model !== '—' ? a.model : '');
      if (!base || !key) { showResult('<span style="color:var(--coral)">请先填写接口地址与 API Key</span>'); return; }
      testBtn.disabled = true; testBtn.textContent = '测试中…';
      showResult('正在发送最小请求…');
      try {
        const r = await APP.ai.testChannel({ base, key, model, type });
        showResult(`<span style="color:var(--mint)">✓ 连通成功 · HTTP 200 · ${r.ms}ms${model ? ' · ' + APP.esc(model) : ''}</span>`);
        APP.toast('渠道连通测试通过', 'success');
      } catch (e) {
        showResult(`<span style="color:var(--coral)">✗ 连接失败：${APP.esc(e.message)}</span>`);
        APP.toast('渠道测试失败', 'warn');
      }
      testBtn.textContent = '② 测试连通'; refreshButtons();
    });

    $n('#btn-cancel-api').addEventListener('click', () => { pane.innerHTML = EDITOR_EMPTY; });

    $n('#btn-save-api').addEventListener('click', () => {
      const name = $n('[name=name]').value.trim();
      const base = baseInp.value.trim();
      if (!name || !base) { APP.toast('名称与接口地址不能为空', 'warn'); return; }
      const patch = {
        name, base,
        model: modelInp.value.trim() || '—',
        temp: +$n('[name=temp]').value || 0.8
      };
      const typedKey = keyInp.value.trim();
      if (typedKey) patch.key = typedKey;
      if (a) {
        APP.store.saveApi(a.id, Object.assign({}, patch, { enabled: !!(typedKey || a.key) && !!base }));
      } else {
        patch.type = type;
        patch.enabled = !!(typedKey && base);
        APP.store.addApi(patch);
      }
      renderApis(); updateCounts();
      pane.innerHTML = EDITOR_EMPTY;
      APP.toast(type === 'image' ? '画图渠道已保存' : '渠道已保存', 'success');
    });
  }

  document.getElementById('btn-add-api-text').addEventListener('click', () => renderApiEditor(null, 'text'));
  document.getElementById('btn-add-api-image').addEventListener('click', () => renderApiEditor(null, 'image'));

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

  /* ---------- 安全策略开关（与个人信息页偏好设置同源：user.prefs.aiAutoSend） ---------- */
  const sw = document.getElementById('ai-switch');
  const aiSendVal = () => !!(D.user.prefs && D.user.prefs.aiAutoSend);
  if (sw) {
    sw.classList.toggle('on', aiSendVal());
    sw.addEventListener('click', () => {
      D.user.prefs = D.user.prefs || {};
      D.user.prefs.aiAutoSend = !aiSendVal();
      APP.store.save();
      sw.classList.toggle('on', aiSendVal());
      APP.toast(D.user.prefs.aiAutoSend ? 'AI 自动发送已开启' : 'AI 自动发送已关闭', 'success');
    });
  }

  /* ---------- 启动 ---------- */
  renderGroups();
  renderDetail();
  renderApis();
  renderApiEditor(null);
  updateCounts();
})();
/* 晴笺 · 个人信息页逻辑
 * 基础资料 / 写作统计（日更落库展示）/ 创作目标 / 偏好设置 / 平台发布偏好 / 数据安全
 * 修改即时保存：字段 change / blur 时写入 DATA.user 并保存
 */
(function () {
  const D = APP.store.init(window.DATA);
  const $ = s => document.querySelector(s);

  function user() { return D.user = D.user || {}; }
  function prefs() { const u = user(); u.prefs = u.prefs || {}; return u.prefs; }
  function saveTip(msg) {
    const el = document.getElementById('profile-save-tip');
    if (el) el.textContent = msg || '修改即时保存';
  }

  /* ---------- 头像 ---------- */
  function renderAvatar() {
    const u = user();
    const img = document.getElementById('avatar-img');
    const letter = document.getElementById('avatar-letter');
    const name = u.name || '作者';
    if (u.avatar) {
      img.src = u.avatar; img.style.display = 'block'; letter.style.display = 'none';
    } else {
      img.style.display = 'none';
      letter.style.display = 'grid';
      letter.textContent = name.slice(0, 1);
    }
    document.getElementById('profile-name').textContent = name;
    document.getElementById('profile-signature').textContent = u.signature || '—';
  }
  function handleAvatar(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // canvas 压缩到 256px 方形 JPEG，控制 localStorage 体积
        const size = 256;
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');
        const min = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
        const dataUrl = c.toDataURL('image/jpeg', 0.85);
        APP.store.updateUser({ avatar: dataUrl });
        renderAvatar();
        APP.toast('头像已更新', 'success');
      };
      img.onerror = () => APP.toast('图片读取失败，请换一张', 'warn');
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  const avFile = document.getElementById('avatar-file');
  if (avFile) avFile.addEventListener('change', () => { handleAvatar(avFile.files && avFile.files[0]); avFile.value = ''; });

  /* ---------- 基础资料 / 目标 / 偏好输入：即时保存 ---------- */
  function bindInput(id, key, opts) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = opts && opts.getValue ? opts.getValue() : (user()[key] !== undefined ? user()[key] : (opts && opts.def !== undefined ? opts.def : ''));
    const onSave = opts && opts.onSave;
    el.addEventListener('change', () => {
      let v = el.value;
      if (opts && opts.num) v = parseFloat(v);
      const patch = {}; patch[key] = v;
      if (onSave) onSave(patch);
      else APP.store.updateUser(patch);
      renderAvatar();
      saveTip('已保存');
    });
  }
  bindInput('pf-name', 'name', { def: '作者', onSave: p => { APP.store.updateUser(p); APP.toast('昵称已更新', 'success'); } });
  bindInput('pf-signature', 'signature');
  bindInput('pf-goal-daily', 'goals', { getValue: () => user().goals ? user().goals.dailyWords : 2000, num: true, onSave: p => { APP.store.updateUser({ goals: Object.assign({}, user().goals, { dailyWords: p.goals || 2000 }) }); } });
  bindInput('pf-goal-finish', 'goals', { getValue: () => user().goals ? (user().goals.finishTarget || '') : '', onSave: p => { APP.store.updateUser({ goals: Object.assign({}, user().goals, { finishTarget: p.goals || '' }) }); } });
  bindInput('pf-fontsize', 'prefs', { getValue: () => prefs().editorFontSize, num: true, onSave: p => { APP.store.updateUser({ prefs: Object.assign({}, prefs(), { editorFontSize: p.prefs }) }); } });
  bindInput('pf-lineheight', 'prefs', { getValue: () => prefs().lineHeight, num: true, onSave: p => { APP.store.updateUser({ prefs: Object.assign({}, prefs(), { lineHeight: p.prefs }) }); } });
  bindInput('pf-autosave', 'prefs', { getValue: () => prefs().autoSaveSec, num: true, onSave: p => { APP.store.updateUser({ prefs: Object.assign({}, prefs(), { autoSaveSec: p.prefs }) }); } });
  bindInput('pf-titlefmt', 'publish', { getValue: () => { const u = user(); return (u.publish && u.publish.chapterTitleFmt) || '第{no}章 {title}'; }, onSave: p => { APP.store.updateUser({ publish: Object.assign({}, user().publish || {}, { chapterTitleFmt: p.publish || '第{no}章 {title}' }) }); } });

  /* 平台下拉 */
  const pfPlatform = document.getElementById('pf-platform');
  if (pfPlatform) {
    const u = user();
    pfPlatform.value = (u.publish && u.publish.platform) || '番茄小说';
    pfPlatform.addEventListener('change', () => {
      APP.store.updateUser({ publish: Object.assign({}, user().publish || {}, { platform: pfPlatform.value }) });
      saveTip('已保存');
    });
  }

  /* ---------- 默认写作 / 画图渠道 ---------- */
  function renderChannelSelects() {
    const textSel = document.getElementById('pf-def-text');
    const imageSel = document.getElementById('pf-def-image');
    const texts = D.apis.filter(a => a.type !== 'image');
    const images = D.apis.filter(a => a.type === 'image');
    const fill = (sel, list, cur, type) => {
      if (!sel) return;
      sel.innerHTML = '<option value="">— 不指定 —</option>' + list.map(a =>
        `<option value="${a.id}" ${a.id === cur ? 'selected' : ''}>${APP.esc(a.name || a.id)}${a.enabled && a.key ? '' : '（未启用）'}</option>`).join('');
      sel.addEventListener('change', () => {
        const id = sel.value;
        if (id) APP.store.setDefaultApi(id, type);
        else APP.store.setDefaultApi('', type);
        APP.toast(type === 'image' ? '默认画图渠道已更新' : '默认写作渠道已更新', 'success');
      });
    };
    fill(textSel, texts, D.defaultApi, 'text');
    fill(imageSel, images, D.defaultImageApi, 'image');
  }

  /* ---------- 开关 ---------- */
  function bindSwitch(id, getVal, setVal) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('on', !!getVal());
    el.addEventListener('click', () => { setVal(!getVal()); el.classList.toggle('on', getVal()); APP.toast(getVal() ? '已开启' : '已关闭', 'success'); });
  }
  bindSwitch('pf-ai-switch', () => prefs().aiAutoSend, v => APP.store.updateUser({ prefs: Object.assign({}, prefs(), { aiAutoSend: v }) }));
  bindSwitch('pf-indent', () => { const u = user(); return u.publish ? !!u.publish.paragraphIndent : true; }, v => APP.store.updateUser({ publish: Object.assign({}, user().publish || {}, { paragraphIndent: v }) }));

  /* ---------- 写作统计 ---------- */
  function renderStats() {
    const words = D.projects.reduce((s, p) => s + (p.words || 0), 0);
    document.getElementById('st-words').textContent = APP.fmt(words) + ' 字';
    document.getElementById('st-days').textContent = APP.store.writingDays() + ' 天';
    document.getElementById('st-streak').textContent = APP.store.streakDays() + ' 天';
    document.getElementById('st-ai').textContent = APP.store.aiShare() + '%';

    /* 近 7 天柱状图（纯 CSS，零依赖） */
    const chart = document.getElementById('week-chart');
    const week = APP.store.last7Days();
    const max = Math.max(1, ...week.map(d => d.words));
    chart.innerHTML = week.map(d => {
      const h = Math.max(4, Math.round(d.words / max * 76));
      const today = d.words > 0;
      return `<div class="bar-col" title="${d.date}：${d.words.toLocaleString()} 字">
        <div class="bar-val" style="height:${h}px;${today ? 'background:linear-gradient(180deg,var(--sun),var(--peach));' : ''}"></div>
        <div class="bar-label">${d.label}</div>
      </div>`;
    }).join('');

    /* 各作品字数分布 */
    const dist = document.getElementById('dist-list');
    const rows = APP.store.projectWordsAll();
    const total = Math.max(1, rows.reduce((s, r) => s + (r.words || 0), 0));
    dist.innerHTML = rows.map(r => `
      <div class="dist-row">
        <span class="dist-name">${APP.esc(r.title)}</span>
        <div class="dist-bar"><i style="width:${Math.round((r.words || 0) / total * 100)}%"></i></div>
        <span class="dist-num">${APP.fmt(r.words || 0)}</span>
      </div>`).join('');
  }

  /* ---------- 数据安全（自作品库迁入） ---------- */
  const backupBtn = document.getElementById('btn-pf-backup');
  const restoreBtn = document.getElementById('btn-pf-restore');
  const restoreFile = document.getElementById('pf-restore-file');
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

  /* 从崩溃快照恢复（§12-2） */
  const snapBtn = document.getElementById('btn-pf-snap');
  const snapHint = document.getElementById('snap-hint');
  if (snapBtn) {
    const showSnap = async () => {
      if (snapHint) {
        snapHint.textContent = window.DATA.snapAvailable
          ? '检测到上次异常退出，快照已就绪，可一键恢复。'
          : '自动快照每 10 秒更新一次，用于程序崩溃/断电后的数据找回。';
      }
    };
    showSnap();
    snapBtn.addEventListener('click', async () => {
      snapBtn.disabled = true;
      try {
        if (!confirm('从崩溃快照恢复将覆盖当前数据（恢复最近一次自动保存的内容），确定继续？')) return;
        await APP.store.restoreSnapshot();
        APP.toast('已从崩溃快照恢复', 'success');
        location.reload();
      } catch (e) {
        APP.toast('快照恢复失败：' + e.message, 'warn');
      } finally {
        snapBtn.disabled = false;
      }
    });
  }

  /* ---------- 启动 ---------- */
  renderAvatar();
  renderChannelSelects();
  renderStats();
  APP.store.onReady(() => { renderAvatar(); renderChannelSelects(); renderStats(); });
})();

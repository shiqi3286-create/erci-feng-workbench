/* ============================================================
 * 晴笺 · AI 小说创作台 — 公共组件
 * 包含：图标库、Toast、顶栏导航、工具函数
 * ============================================================ */

window.APP = (function (_prev) {
  // 合并式挂载：保留 store / ai 等其他模块，仅覆盖本模块职责
  const api = (function () {

  /* ---------- 图标库（内联 SVG，线性描边） ---------- */
  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/><circle cx="12" cy="12" r="3.2"/></svg>',
    world: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.6-4-9s1.4-6.5 4-9z"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2.4"/><circle cx="9" cy="16" r="2.4"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4a1 1 0 0 1 .6-.9A4 4 0 0 1 7 2c2 0 3 1 5 1s3-1 5-1a4 4 0 0 1 2.4.6A1 1 0 0 1 20 3v11a1 1 0 0 1-.6.9A4 4 0 0 1 17 16c-2 0-3-1-5-1s-3 1-5 1a4 4 0 0 1-2.4-1.1A1 1 0 0 1 4 14z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    fork: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="12" r="2.4"/><path d="M6 8.4v7.2M18 9.6c0 2-1.4 3.6-3.4 4.2L6 17"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6"/></svg>',
    cut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><path d="M8.2 7.4 20 19M8.2 16.6 20 5"/></svg>',
    brush: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.6 4.4 5 5L9 20H4v-5z"/><path d="m12 8 4 4"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.4"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>'
  };

  function icon(name, cls) {
    return ICONS[name] || ICONS.info;
  }

  /* ---------- Toast ---------- */
  function toast(msg, type) {
    let root = document.getElementById('toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toast-root';
      document.body.appendChild(root);
    }
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(() => el.remove(), 320);
    }, 2200);
  }

  /* ---------- 顶栏渲染 ---------- */
  const NAV = [
    { href: 'index.html', key: 'home', label: '作品库', icon: 'home' },
    { href: 'workspace.html', key: 'workspace', label: '创作台', icon: 'pen' },
    { href: 'outline.html', key: 'outline', label: '大纲', icon: 'list' },
    { href: 'world.html', key: 'world', label: '设定库', icon: 'world' },
    { href: 'template.html', key: 'template', label: '模板·API', icon: 'sliders' }
  ];

  function renderTopbar(activeKey) {
    const bar = document.getElementById('app-topbar');
    if (!bar) return;
    const nav = NAV.map(n =>
      `<a class="nav-item ${n.key === activeKey ? 'active' : ''}" href="${n.href}">${icon(n.icon)}<span>${n.label}</span></a>`
    ).join('');
    const user = window.DATA ? window.DATA.user : { name: '写手' };
    bar.innerHTML = `
      <a class="brand" href="index.html">
        <span class="logo">${icon('sun')}</span>
        <span>晴笺 · 创作台</span>
      </a>
      <nav class="top-nav">${nav}</nav>
      <div class="topbar-right">
        <button class="icon-btn" title="搜索" onclick="APP.openSearch()">${icon('search')}</button>
        <button class="icon-btn" title="设置" onclick="location.href='template.html'">${icon('settings')}</button>
        <span class="avatar">${user.name.slice(0, 1)}</span>
      </div>`;
  }

  /* ---------- 全局搜索（跨项目：章节 / 人物 / 伏笔 / 地点 / 物品） ---------- */
  function searchAll(q) {
    const D = window.DATA;
    if (!q || !q.trim() || !D) return [];
    const ql = q.trim().toLowerCase();
    const out = [];
    (D.projects || []).forEach(p => {
      const pd = (D.projectData || {})[p.id] || {};
      (pd.volumes || []).forEach(v => (v.beats || []).forEach(b => {
        const hay = (b.title + ' ' + (b.sum || '') + ' ' + (b.chars || []).join(' ')).toLowerCase();
        if (hay.includes(ql)) out.push({ type: '章节', pid: p.id, vid: v.id, bid: b.id, title: (b.no || '') + ' ' + b.title, sub: p.title + ' · ' + v.title });
      }));
      (pd.characters || []).forEach(c => {
        const hay = (c.name + ' ' + (c.role || '') + ' ' + (c.brief || '')).toLowerCase();
        if (hay.includes(ql)) out.push({ type: '人物', pid: p.id, title: c.name, sub: p.title + ' · ' + (c.role || '') });
      });
      (pd.foreshadows || []).forEach(f => {
        if (((f.text || '') + ' ' + (f.where || '')).toLowerCase().includes(ql)) out.push({ type: '伏笔', pid: p.id, title: f.text, sub: p.title + ' · ' + (f.where || '') });
      });
      (pd.locations || []).forEach(l => {
        if (((l.name || '') + ' ' + (l.desc || '')).toLowerCase().includes(ql)) out.push({ type: '地点', pid: p.id, title: l.name, sub: p.title + ' · ' + (l.type || '') });
      });
      (pd.items || []).forEach(i => {
        if (((i.name || '') + ' ' + (i.desc || '')).toLowerCase().includes(ql)) out.push({ type: '物品', pid: p.id, title: i.name, sub: p.title + ' · ' + (i.type || '') });
      });
    });
    return out.slice(0, 24);
  }

  function jumpSearchResult(r) {
    const store = window.APP.store;
    const proj = (window.DATA.projects || []).find(p => p.id === r.pid);
    if (!proj) return;
    if (store.currentProject() && store.currentProject().id !== r.pid) store.useProject(r.pid);
    if (r.vid && r.bid) {
      const vol = window.DATA.volumes.find(v => v.id === r.vid);
      const beat = vol && (vol.beats || []).find(b => b.id === r.bid);
      if (beat) {
        window.DATA.current.volumeId = r.vid;
        window.DATA.current.chapterId = r.bid;
        window.DATA.current.chapterTitle = '第' + beat.no + '章 · ' + beat.title;
        window.DATA.current.chapterOrder = +beat.no || 1;
        window.DATA.current.chapterWords = (beat.paras || []).reduce((s, x) => s + (x.text || '').length, 0);
        store.save();
        location.href = 'workspace.html';
        return;
      }
    }
    store.save();
    location.href = r.type === '章节' ? 'workspace.html' : 'world.html';
  }

  function openSearch() {
    const m = modal({
      title: '全局搜索',
      submitText: '关闭',
      bodyHtml: `
        <div class="field"><input class="input" id="sr-q" placeholder="搜索章节、人物、伏笔、地点、物品…（跨项目）"></div>
        <div id="sr-list" class="sr-list"></div>`,
      onSubmit: () => true
    });
    const input = m.root.querySelector('#sr-q');
    const list = m.root.querySelector('#sr-list');
    const render = () => {
      const q = input.value.trim();
      if (!q) { list.innerHTML = '<p class="small muted" style="padding:6px 2px">输入关键词，同时搜索全部作品与设定。</p>'; return; }
      const hits = searchAll(q);
      if (!hits.length) { list.innerHTML = '<p class="small muted" style="padding:6px 2px">没有匹配的结果。</p>'; return; }
      list.innerHTML = hits.map((h, i) => `
        <div class="sr-hit" data-i="${i}">
          <span class="tag ${h.type === '章节' ? 'tag-sun' : h.type === '人物' ? 'tag-lilac' : h.type === '伏笔' ? 'tag-coral' : 'tag-sky'}">${h.type}</span>
          <span class="grow" style="min-width:0">
            <b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.title)}</b>
            <span class="small muted">${esc(h.sub)}</span>
          </span>
        </div>`).join('');
      list.querySelectorAll('.sr-hit').forEach(el =>
        el.addEventListener('click', () => { jumpSearchResult(hits[+el.dataset.i]); m.close(); }));
    };
    input.addEventListener('input', render);
    render();
    setTimeout(() => input.focus(), 40);
  }

  /* ---------- 文件下载（浏览器 / Tauri WebView 通用） ---------- */
  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 400);
  }

  /* ---------- 工具函数 ---------- */
  function fmt(n) {
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    return n.toLocaleString();
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function debounce(fn, ms) {
    let t; return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }
  function el(html) {
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  /* ---------- 通用弹窗 ---------- */
  function modal({ title, bodyHtml, onSubmit, submitText = '保存', onClose, cancelText = '取消' }) {
    const root = el(`
      <div class="modal-overlay">
        <div class="modal" role="dialog" aria-label="${esc(title)}">
          <div class="modal-head">
            <span class="modal-title">${esc(title)}</span>
            <button class="icon-btn modal-close" type="button" title="关闭">${ICONS.back}</button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          <div class="modal-foot">
            <button class="btn btn-ghost modal-cancel" type="button">${esc(cancelText)}</button>
            <button class="btn btn-primary modal-ok" type="button">${esc(submitText)}</button>
          </div>
        </div>
      </div>`);
    document.body.appendChild(root);

    const close = () => {
      root.classList.add('fade-out');
      setTimeout(() => root.remove(), 180);
      onClose && onClose();
    };
    const submit = () => {
      const ok = onSubmit ? onSubmit(root) : true;
      if (ok !== false) close();
    };
    root.querySelector('.modal-close').addEventListener('click', close);
    root.querySelector('.modal-cancel').addEventListener('click', close);
    root.querySelector('.modal-ok').addEventListener('click', submit);
    root.addEventListener('mousedown', e => { if (e.target === root) close(); });
    // Enter 提交、Esc 关闭
    root.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); submit(); }
    });
    const first = root.querySelector('input,textarea,select');
    if (first) setTimeout(() => first.focus(), 30);
    return { close, root };
  }

  /* 读取弹窗内带 name 的表单值 */
  function formData(root) {
    const out = {};
    root.querySelectorAll('[name]').forEach(n => { out[n.name] = n.value; });
    return out;
  }

  return { icon, toast, renderTopbar, fmt, esc, debounce, el, modal, formData, openSearch, searchAll, downloadText };
  })();
  return Object.assign({}, _prev || {}, api);
})(window.APP);

document.addEventListener('DOMContentLoaded', () => { APP.renderTopbar(document.body.dataset.page || ''); });

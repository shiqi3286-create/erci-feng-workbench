/* ============================================================
 * 晴笺 · AI 小说创作台 — 手动更新检查
 * 桌面模式：读取运行版本，对比 GitHub 最新 Release，有新版则
 * 打开发布页手动下载安装（不自动下载/安装，无需签名）。
 * 浏览器模式：直接打开发布页。
 * 同时监听系统托盘「检查更新」菜单事件（check-update）。
 * ============================================================ */

window.APP = window.APP || {};
window.APP.updater = (function () {

  const REPO = 'shiqi3286-create/erci-feng-workbench';
  const RELEASES_URL = 'https://github.com/' + REPO + '/releases';
  const LATEST_API = 'https://api.github.com/repos/' + REPO + '/releases/latest';

  function invoke() { return window.__TAURI__?.core?.invoke; }

  /* 语义化版本比较：返回 >0 表示 a 更新 */
  function cmpVer(a, b) {
    const pa = String(a).replace(/^v/, '').split('.').map(x => parseInt(x, 10) || 0);
    const pb = String(b).replace(/^v/, '').split('.').map(x => parseInt(x, 10) || 0);
    for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
    return 0;
  }

  async function currentVersion() {
    const fn = invoke();
    if (fn) {
      try { return await fn('app_version'); } catch (e) { /* 回退 */ }
    }
    return null; // 浏览器模式无桌面版本概念
  }

  function openReleases() {
    const fn = invoke();
    if (fn) {
      fn('open_release_page').catch(() => window.open(RELEASES_URL, '_blank'));
    } else {
      window.open(RELEASES_URL, '_blank');
    }
  }

  /**
   * 检查更新。
   * interactive=true：有新版弹确认跳发布页；已是最新或失败均 toast 反馈。
   * interactive=false：静默，仅在有新版时弹确认（供托盘菜单使用）。
   */
  async function check(interactive = true) {
    const fn = invoke();
    if (!fn) {
      // 浏览器预览模式：直接去发布页
      if (interactive) openReleases();
      return;
    }
    let cur = '';
    try { cur = await fn('app_version'); } catch (e) { cur = '0.0.0'; }
    try {
      const res = await fetch(LATEST_API, { headers: { 'Accept': 'application/vnd.github+json' } });
      if (res.status === 403) throw new Error('GitHub 接口限流，稍后再试');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const rel = await res.json();
      const latest = rel.tag_name || '';
      if (!latest) throw new Error('未获取到版本号');
      if (cmpVer(latest, cur) > 0) {
        const notes = (rel.body || '').split('\n').filter(Boolean).slice(0, 5).join('\n');
        if (confirm('发现新版本 ' + latest + '（当前 v' + cur + '）\n\n' + (rel.name || '') + '\n\n' + notes + '\n\n是否打开发布页下载安装新版？')) {
          openReleases();
        }
      } else if (interactive) {
        APP.toast('已是最新版本 v' + cur, 'success');
      }
    } catch (e) {
      if (interactive) {
        APP.toast('检查更新失败：' + e.message, 'warn');
      }
    }
  }

  /* 托盘菜单「检查更新」→ Rust emit('check-update') */
  const listen = window.__TAURI__?.event?.listen;
  if (typeof listen === 'function') {
    listen('check-update', () => { check(true); }).catch(() => {});
  }

  return { check, openReleases, currentVersion, RELEASES_URL };
})();

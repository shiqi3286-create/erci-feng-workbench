/* ============================================================
 * 晴笺 · AI 小说创作台 — AI 客户端
 * OpenAI 兼容 chat/completions，流式输出；多渠道失败自动切换；
 * 无可用渠道时进入演示模式（本地分块模拟，不真正联网）。
 * 安全边界：只发送手动选中的文本与设定，绝不全量上传全文。
 * ============================================================ */

window.APP = window.APP || {};
window.APP.ai = (function () {

  /* ---------- 工具 ---------- */
  function estTokens(text) {
    // 中英混排粗估：中文 ~1 token/1.5 字，英文 ~1 token/4 字符
    const cjk = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
    const rest = text.length - cjk;
    return Math.ceil(cjk / 1.5 + rest / 4);
  }

  /* 可用渠道：写作（text）已启用且配置了真实 Key（非脱敏占位） */
  function usableChannels() {
    return (window.DATA.apis || []).filter(a =>
      a.type !== 'image' && a.enabled && a.base && a.key && !a.key.includes('••') && a.model && a.model !== '—'
    );
  }

  function pickChannel() {
    const list = usableChannels();
    if (!list.length) return null;
    const def = list.find(a => a.id === window.DATA.defaultApi);
    if (def) return def;
    return list[0];
  }

  /* ---------- 真实流式调用（单渠道；§12-4：真实 usage + 可取消） ---------- */
  async function callChannel(channel, messages, params, onDelta, signal) {
    const res = await fetch(channel.base.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + channel.key
      },
      body: JSON.stringify({
        model: channel.model,
        messages,
        temperature: params.temperature ?? channel.temp ?? 0.8,
        max_tokens: params.maxTokens ?? 2000,
        stream: true,
        stream_options: { include_usage: true }
      }),
      signal
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error('HTTP ' + res.status + ' ' + txt.slice(0, 120));
    }
    if (!res.body) throw new Error('响应无流式内容');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', full = '', usage = null;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE 事件以空行分隔
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, idx); buf = buf.slice(idx + 2);
        const line = raw.split('\n').find(l => l.startsWith('data:'));
        if (!line) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') { buf = ''; break; }
        try {
          const j = JSON.parse(payload);
          /* 流式 usage：部分网关在带 usage 的独立块返回（choices 为空） */
          if (j.usage && j.usage.total_tokens) usage = j.usage;
          const delta = j.choices && j.choices[0] && j.choices[0].delta;
          if (delta && typeof delta.content === 'string') {
            full += delta.content;
            if (onDelta) onDelta(delta.content, full);
          }
        } catch (e) { /* 忽略解析失败的分片 */ }
      }
    }
    return { text: full, usage };
  }

  /* ---------- 演示模式（支持取消） ---------- */
  function demoComplete(system, user, onDelta, signal) {
    return new Promise((resolve) => {
      const p = (window.DATA.projects || []).find(x => x.id === window.DATA.current?.projectId);
      const title = p ? p.title : '本书';
      const text = `【演示输出 · 未连接真实 API】\n\n夜色落在《${title}》的世界里。这个片段来自本地演示模式：配置好「模板·API」页面的接口地址与密钥并启用后，这里将输出真正的 AI 生成内容。\n\n演示模式下你依然可以体验完整的编辑流：这段文字会以 AI 标记进入正文，你可以逐段确认、修改或删除，全部数据保存在本地。`;
      const chunks = text.match(/[\s\S]{1,24}/g) || [text];
      let i = 0;
      let full = '';
      const timer = setInterval(() => {
        if (signal && signal.aborted) { clearInterval(timer); resolve({ text: full, usage: null }); return; }
        if (i >= chunks.length) { clearInterval(timer); resolve({ text: full, usage: null }); return; }
        full += chunks[i];
        if (onDelta) onDelta(chunks[i], full);
        i++;
      }, 120);
    });
  }

  /* ---------- 上下文组装（DATA-SCHEMA §9） ---------- */
  function buildContext({ beat, selected, chars, foreshadows } = {}) {
    const D = window.DATA;
    const parts = [];
    // 全局精简设定：core 人物摘要（≤1k tokens 预算）
    let charText = (chars || D.characters).slice(0, 4).map(c =>
      `${c.name}（${c.role}）：${c.brief || ''}`
    ).join('\n');
    if (charText) parts.push({ name: '人物设定', text: charText });

    // 本章大纲卡片
    if (beat) {
      parts.push({
        name: '本章大纲',
        text: `标题：${beat.title}\n目标：${beat.sum || ''}\n关键人物：${(beat.chars || []).join('、')}\n埋设伏笔：${(beat.fs || []).join('、')}`
      });
    }
    // 检索相关伏笔（≤600 tokens）
    const open = (foreshadows || D.foreshadows).filter(f => f.status === 'open').slice(0, 4);
    if (open.length) parts.push({ name: '相关伏笔', text: open.map(f => `· ${f.text}（${f.where}）`).join('\n') });

    // 用户选中文本 / 上屏内容
    if (selected && selected.length) parts.push({ name: '选中文本', text: selected });

    return parts;
  }

  /**
   * complete(opts) → Promise<string>
   * opts: {
   *   system?, user,   // 直接给出 system / user 文本
   *   parts?,          // buildContext 的结果，自动拼入 user 上方
   *   params?,         // { temperature, maxTokens }
   *   onDelta?(text, full),
   *   onUsage?(usage), // 真实流式 usage（total_tokens 等），网关不支持时为 null
   *   signal?,         // AbortSignal，支持中途取消
   *   forceDemo?
   * }
   */
  async function complete(opts) {
    const { parts = [], user, system, params = {}, onDelta, onUsage, signal, forceDemo } = opts;
    const sys = system || '你是一位资深小说家，写作细腻治愈、慢热叙事。请保持原作世界观、人物口吻与节奏，只输出正文本身，不加任何解释。';
    const context = parts.map(p => `【${p.name}】\n${p.text}`).join('\n\n');
    const userText = [context, user].filter(Boolean).join('\n\n—— 以上为上下文，以下是写作要求 ——\n\n');

    let channel = null;
    if (!forceDemo) channel = pickChannel();

    let full = '', usage = null;
    const tryCall = (ch, s) => callChannel(ch, [
      { role: 'system', content: sys },
      { role: 'user', content: userText }
    ], params, onDelta, s);
    if (channel) {
      try {
        const r = await tryCall(channel, signal);
        full = r.text; usage = r.usage;
        if (!full.trim()) throw new Error('模型返回空内容');
      } catch (err) {
        if (signal && signal.aborted) throw err;   // 用户主动取消，直接上抛
        // 主渠道失败：尝试其他可用渠道
        const others = usableChannels().filter(a => a.id !== channel.id);
        let done = false;
        for (const a of others) {
          try {
            const r = await tryCall(a, signal);
            full = r.text; usage = r.usage;
            channel = a; done = true; break;
          } catch (e) { if (signal && signal.aborted) throw e; /* 继续下一个 */ }
        }
        if (!done) {
          channel = null;
          APP.toast('渠道调用失败，已切换为演示模式', 'warn');
        } else {
          APP.toast('主渠道失败，已切换备用渠道', 'warn');
        }
      }
    }
    if (!channel) {
      APP.toast('未配置可用 API，正在演示模式运行', '');
      const r = await demoComplete(sys, userText, onDelta, signal);
      full = r.text; usage = r.usage;
    }

    if (onUsage) onUsage(usage);
    /* §12-4：真实 usage 优先，缺失时才用本地估算 */
    const tokens = usage && usage.total_tokens
      ? usage.total_tokens
      : (estTokens(full) + estTokens(userText));
    APP.store.bumpCall(channel ? channel.id : 'demo', tokens, channel ? channel.model : 'demo');
    return full;
  }

  /* ---------- 渠道工具：拉取模型 / 测试连通（模板·API 页使用） ---------- */
  const REQ_TIMEOUT = 15000;
  /* HTTP 头只允许 ISO-8859-1；脱敏占位符（••）等非 ASCII Key 直接给出友好提示 */
  function checkKey(key) {
    if (!key) throw new Error('缺少 API Key，请先填写');
    if (!/^[\x20-\x7E]*$/.test(key)) throw new Error('API Key 含非常规字符（如演示占位符"••"），请填写真实密钥');
  }
  function withTimeout(promise) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT);
    return Promise.race([promise(ctrl.signal), new Promise((_, rej) => {
      const t = setTimeout(() => rej(new Error('请求超时（15s）')), REQ_TIMEOUT);
      ctrl.signal.addEventListener('abort', () => { clearTimeout(t); rej(new Error('请求超时（15s）')); });
    })]).finally(() => clearTimeout(timer));
  }
  async function parseHttpError(res) {
    const txt = await res.text().catch(() => '');
    let reason = '';
    try { const j = JSON.parse(txt); reason = (j.error && (j.error.message || j.error)) || ''; } catch (e) { /* 非 JSON 响应 */ }
    return 'HTTP ' + res.status + (reason ? ' · ' + reason : (txt ? ' · ' + txt.slice(0, 100) : ''));
  }
  /** 拉取模型列表：GET {base}/models → string[] */
  async function listModels(base, key) {
    checkKey(key);
    const url = String(base || '').replace(/\/+$/, '') + '/models';
    const res = await withTimeout(signal => fetch(url, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + key },
      signal
    }));
    if (!res.ok) throw new Error(await parseHttpError(res));
    const j = await res.json().catch(() => ({}));
    const data = j.data || j.models || [];
    if (!Array.isArray(data) || !data.length) throw new Error('响应中没有模型列表');
    return data.map(m => (typeof m === 'string' ? m : (m.id || m.name))).filter(Boolean);
  }
  /** 测试渠道连通：发最小真实请求，返回耗时 */
  async function testChannel({ base, key, model, type }) {
    checkKey(key);
    const isImage = type === 'image';
    const t0 = Date.now();
    const url = String(base || '').replace(/\/+$/, '') + (isImage ? '/images/generations' : '/chat/completions');
    const body = isImage
      ? { model: model || 'image-model', prompt: 'test', n: 1, size: '256x256' }
      : { model: model || 'test', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1, stream: false };
    const res = await withTimeout(signal => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(body),
      signal
    }));
    const ms = Date.now() - t0;
    if (!res.ok) throw new Error(await parseHttpError(res));
    await res.text();
    return { ok: true, ms };
  }

  /* ---------- 画图（§12-5：插图 / 头像 / 封面提示词生成后调用） ---------- */
  function imageChannels() {
    return (window.DATA.apis || []).filter(a =>
      a.type === 'image' && a.enabled && a.base && a.key && !a.key.includes('••') && a.model && a.model !== '—'
    );
  }
  /* 演示占位图：本地渐变 + 文字，不联网 */
  function demoImage(prompt) {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 480;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, c.width, c.height);
    grad.addColorStop(0, '#F6E3CE'); grad.addColorStop(1, '#D9C6E8');
    g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(120,90,60,.75)';
    g.font = '28px "Noto Sans SC", sans-serif';
    const lines = String(prompt || '演示插图').split('\n').slice(0, 2);
    lines.forEach((l, i) => g.fillText(l.slice(0, 18) + (l.length > 18 ? '…' : ''), 24, 44 + i * 36));
    g.fillStyle = 'rgba(90,60,100,.9)';
    g.font = '16px "Noto Sans SC", sans-serif';
    g.fillText('演示模式 · 未配置画图渠道', 24, c.height - 24);
    return c.toDataURL('image/jpeg', 0.82);
  }
  /** 生成图片：返回 { demo, dataUrl }；未配置渠道时演示占位（可走通全流程） */
  async function generateImage({ prompt, size = '1024x1024', n = 1 }) {
    const list = imageChannels();
    if (!list.length) {
      APP.toast('未配置画图渠道，已生成演示占位图', 'warn');
      return { demo: true, dataUrl: demoImage(prompt) };
    }
    const ch = list.find(a => a.id === window.DATA.defaultImageApi) || list[0];
    const body = { model: ch.model, prompt: String(prompt || ''), n, size };
    const res = await withTimeout(signal => fetch(ch.base.replace(/\/+$/, '') + '/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ch.key },
      body: JSON.stringify(body),
      signal
    }));
    if (!res.ok) throw new Error(await parseHttpError(res));
    const j = await res.json().catch(() => ({}));
    const item = (j.data || [])[0];
    if (!item) throw new Error('响应中没有图片数据');
    if (item.b64_json) return { demo: false, dataUrl: 'data:image/png;base64,' + item.b64_json };
    if (item.url) {
      /* 远程 URL：转成 dataURL 本地存储（跨域失败时给出明确提示） */
      const blobRes = await fetch(item.url).catch(() => null);
      if (!blobRes || !blobRes.ok) throw new Error('图片已生成但下载失败：' + item.url.slice(0, 60));
      const blob = await blobRes.blob();
      return { demo: false, dataUrl: await new Promise((res2, rej2) => {
        const fr = new FileReader();
        fr.onload = () => res2(fr.result);
        fr.onerror = () => rej2(new Error('图片转本地失败'));
        fr.readAsDataURL(blob);
      }) };
    }
    throw new Error('响应中没有可用的图片数据');
  }

  return { complete, buildContext, estTokens, usableChannels, pickChannel, listModels, testChannel, generateImage, imageChannels };
})();

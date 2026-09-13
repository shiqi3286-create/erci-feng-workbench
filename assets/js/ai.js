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

  /* 可用渠道：已启用且配置了真实 Key（非脱敏占位） */
  function usableChannels() {
    return (window.DATA.apis || []).filter(a =>
      a.enabled && a.base && a.key && !a.key.includes('••') && a.model && a.model !== '—'
    );
  }

  function pickChannel() {
    const list = usableChannels();
    if (!list.length) return null;
    const def = list.find(a => a.id === window.DATA.defaultApi);
    if (def) return def;
    return list[0];
  }

  /* ---------- 真实流式调用（单渠道） ---------- */
  async function callChannel(channel, messages, params, onDelta) {
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
        stream: true
      })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error('HTTP ' + res.status + ' ' + txt.slice(0, 120));
    }
    if (!res.body) throw new Error('响应无流式内容');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', full = '';
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
          const delta = j.choices && j.choices[0] && j.choices[0].delta;
          if (delta && typeof delta.content === 'string') {
            full += delta.content;
            if (onDelta) onDelta(delta.content, full);
          }
        } catch (e) { /* 忽略解析失败的分片 */ }
      }
    }
    return full;
  }

  /* ---------- 演示模式 ---------- */
  function demoComplete(system, user, onDelta) {
    return new Promise((resolve) => {
      const text = '凛握着那盏灯，第一次没有躲开陆沉的目光。星辉在她掌心安静地亮着，像一盏被谁重新点燃的小灯。她听见守林人在前面说：灯火熄了百年，等的就是今天。\n\n她垂下眼，掌心的光映着雨水一样的凉意。她知道，从踏进这座森林开始，有些东西就再也没法装作看不见了。';
      const chunks = text.match(/[\s\S]{1,24}/g) || [text];
      let i = 0;
      let full = '';
      const timer = setInterval(() => {
        if (i >= chunks.length) { clearInterval(timer); resolve(full); return; }
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
   *   forceDemo?
   * }
   */
  async function complete(opts) {
    const { parts = [], user, system, params = {}, onDelta, forceDemo } = opts;
    const sys = system || '你是一位资深小说家，写作细腻治愈、慢热叙事。请保持原作世界观、人物口吻与节奏，只输出正文本身，不加任何解释。';
    const context = parts.map(p => `【${p.name}】\n${p.text}`).join('\n\n');
    const userText = [context, user].filter(Boolean).join('\n\n—— 以上为上下文，以下是写作要求 ——\n\n');

    let channel = null;
    if (!forceDemo) channel = pickChannel();

    let full = '';
    if (channel) {
      try {
        full = await callChannel(channel, [
          { role: 'system', content: sys },
          { role: 'user', content: userText }
        ], params, onDelta);
        if (!full.trim()) throw new Error('模型返回空内容');
      } catch (err) {
        // 主渠道失败：尝试其他可用渠道
        const others = usableChannels().filter(a => a.id !== channel.id);
        let done = false;
        for (const a of others) {
          try {
            full = await callChannel(a, [
              { role: 'system', content: sys },
              { role: 'user', content: userText }
            ], params, onDelta);
            channel = a; done = true; break;
          } catch (e) { /* 继续下一个 */ }
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
      full = await demoComplete(sys, userText, onDelta);
    }

    const tokens = estTokens(full) + estTokens(userText);
    APP.store.bumpCall(channel ? channel.id : 'demo', tokens, channel ? channel.model : 'demo');
    return full;
  }

  return { complete, buildContext, estTokens, usableChannels, pickChannel };
})();

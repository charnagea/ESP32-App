/* Smart Post Academy — lesson engine. Plain JS, no libraries, works offline. */
(function () {
  'use strict';
  const C = window.COURSE;
  const FW = window.FIRMWARE || {};
  const KEY = 'spa-progress-v1';
  const $app = document.getElementById('app');

  // ---------- progress ----------
  // In the Android app, progress goes to the phone's app storage through the
  // AndroidStore bridge, so it never depends on the WebView's browser storage.
  // In a plain browser it uses localStorage, and warns when that is unavailable.
  const NATIVE = window.AndroidStore || null;
  let S = null, storageOk = !!NATIVE;
  if (NATIVE) { try { S = JSON.parse(NATIVE.load() || 'null'); } catch (e) { S = null; } }
  if (!S) { try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; } }
  if (!NATIVE) {
    try { localStorage.setItem(KEY + '-probe', '1'); storageOk = localStorage.getItem(KEY + '-probe') === '1'; } catch (e) { storageOk = false; }
  }
  S = S || {};
  S.items = S.items || {}; S.labs = S.labs || {}; S.seen = S.seen || {};
  function save() {
    const json = JSON.stringify(S);
    if (NATIVE) { try { NATIVE.save(json); } catch (e) {} }
    try { localStorage.setItem(KEY, json); } catch (e) {}
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);

  const lessons = [];               // flat list, in order
  C.modules.forEach(m => m.lessons.forEach((l, i) => {
    l.module = m; l.idx = i; lessons.push(l);
    l.graded = 0;
    l.blocks.forEach((b, j) => { b.key = l.id + ':' + j; if (isGraded(b)) l.graded++; });
  }));
  function isGraded(b) { return ['mcq', 'multi', 'fill', 'order', 'bug', 'num', 'lab'].includes(b.t) || (b.t === 'widget' && b.goal); }
  function itemDone(b) { return b.t === 'lab' ? !!(S.labs[b.id] && (S.labs[b.id].passed || S.labs[b.id].revealed)) : !!S.items[b.key]; }
  function lessonDone(l) {
    if (l.graded === 0) return !!S.seen[l.id];
    return l.blocks.every(b => !isGraded(b) || itemDone(b));
  }
  function moduleProgress(m) { const d = m.lessons.filter(lessonDone).length; return [d, m.lessons.length]; }
  function totalProgress() { const d = lessons.filter(lessonDone).length; return Math.round(100 * d / lessons.length); }

  // ---------- helpers ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KW = 'auto|bool|break|case|char|const|constexpr|continue|default|do|double|else|enum|extern|false|float|for|if|inline|int|long|namespace|nullptr|return|short|signed|sizeof|static|struct|switch|true|typedef|unsigned|void|volatile|while|class|public|private|new|delete|offsetof';
  const TY = 'uint8_t|uint16_t|uint32_t|uint64_t|int8_t|int16_t|int32_t|int64_t|size_t|time_t|String|File|esp_err_t|gpio_num_t|camera_fb_t|camera_config_t|framesize_t|esp_now_peer_info_t|esp_now_recv_info_t|wifi_tx_info_t|esp_now_send_status_t|esp_sleep_wakeup_cause_t|QueueHandle_t|HardwareSerial|Preferences|BudgetMsg|HelloMsg|ChunkMsg|PhotoStartMsg|PhotoEndMsg|AckMsg|DoneMsg|RxItem|Session';
  const HLRE = new RegExp('(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)|("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')|(^[ \\t]*#\\s*\\w+)|\\b(' + KW + ')\\b|\\b(' + TY + ')\\b|\\b(0x[0-9a-fA-F]+[uUlL]*|\\d+(?:\\.\\d+)?[uUlLf]*)\\b', 'gm');
  function hl(code) {
    let out = '', last = 0; HLRE.lastIndex = 0; let m;
    while ((m = HLRE.exec(code))) {
      out += esc(code.slice(last, m.index));
      const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'p' : m[4] ? 'k' : m[5] ? 't' : 'n';
      out += '<span class="hl-' + cls + '">' + esc(m[0]) + '</span>';
      last = m.index + m[0].length;
      if (m[0].length === 0) HLRE.lastIndex++;
    }
    return out + esc(code.slice(last));
  }
  function shuffle(a, seed) { a = a.slice(); let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) >>> 0; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d);
    requestAnimationFrame(() => d.classList.add('show')); setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 300); }, 1600); }
  function copy(text) {
    const done = () => toast('Copied');
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, fallback); } else fallback();
    function fallback() { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Select and copy by hand'); } t.remove(); }
  }
  const norm = s => String(s).trim().replace(/\s+/g, ' ').replace(/\s*([(),;{}\[\]=<>+*&|-])\s*/g, '$1');
  function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }

  // ---------- layout ----------
  function shell(title, backHref, body, tab) {
    $app.innerHTML = '';
    const head = el(`<header class="top">${backHref ? `<button class="back" aria-label="Back">‹</button>` : ''}<h1>${esc(title)}</h1><span class="pct">${totalProgress()}%</span></header>`);
    if (backHref) head.querySelector('.back').onclick = () => { if (history.length > 1) history.back(); else location.hash = backHref; };
    $app.appendChild(head);
    const main = document.createElement('main'); $app.appendChild(main);
    if (typeof body === 'string') main.innerHTML = body; else main.appendChild(body);
    let nav = document.querySelector('nav.bottom');
    if (!nav) { nav = el(`<nav class="bottom">
      <a href="#/" data-t="learn"><span>📘</span>Learn</a>
      <a href="#/ref" data-t="ref"><span>📌</span>Cheat sheet</a>
      <a href="#/code" data-t="code"><span>💾</span>Firmware</a>
      <a href="#/glossary" data-t="glo"><span>🔤</span>Glossary</a></nav>`); document.body.appendChild(nav); }
    nav.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.t === tab));
    window.scrollTo(0, 0);
    return main;
  }

  // ---------- screens ----------
  function home() {
    const next = lessons.find(l => !lessonDone(l));
    let h = `<div class="hero"><h2>${esc(C.title)}</h2><p class="muted small">${C.subtitle}</p>
      <div class="bar"><i style="width:${totalProgress()}%"></i></div>
      <div class="row">${next ? `<a class="btn" href="#/l/${next.id}">▶ ${lessons.indexOf(next) ? 'Continue' : 'Start'}: ${esc(next.title)}</a>` : `<a class="btn" href="#/code">🎓 Course complete — open the firmware</a>`}</div></div>`;
    let part = '';
    C.modules.forEach(m => {
      if (m.part && m.part !== part) { part = m.part; h += `<h3>${esc(part)}</h3>`; }
      const [d, n] = moduleProgress(m);
      h += `<a class="card mod" href="#/m/${m.id}"><div class="ic">${m.icon}</div><div class="tx"><b>${esc(m.title)}</b><small>${esc(m.summary)}</small>
        <div class="bar"><i style="width:${100 * d / n}%"></i></div></div><div class="ck">${d}/${n}</div></a>`;
    });
    h += `<div class="row" style="margin-top:24px"><a class="btn ghost small" href="#/sources">Sources</a><a class="btn ghost small" href="#/about">About & labels</a></div>
      <div class="row"><button class="btn ghost small" id="backup">Copy progress backup</button><button class="btn ghost small" id="restore">Restore from backup</button><button class="btn ghost small" id="reset">Reset progress</button></div>`;
    if (!storageOk) h = `<div class="note warn" style="margin-top:14px"><b class="lbl">Progress is not being saved here</b>This browser view blocks storage, so your answers and lab code are lost when you close it. Use the Android app, or press "Copy progress backup" before closing and "Restore from backup" next time.</div>` + h;
    const main = shell('Smart Post Academy', null, h, 'learn');
    main.querySelector('#reset').onclick = () => { if (confirm('Erase all progress and saved lab code?')) { S = { items: {}, labs: {}, seen: {} }; save(); home(); } };
    main.querySelector('#backup').onclick = () => copy('SPA1:' + btoa(unescape(encodeURIComponent(JSON.stringify(S)))));
    main.querySelector('#restore').onclick = () => {
      const t = prompt('Paste your progress backup (it starts with SPA1:)');
      if (!t) return;
      try {
        const d = JSON.parse(decodeURIComponent(escape(atob(t.trim().replace(/^SPA1:/, '')))));
        if (!d || typeof d !== 'object' || !d.items) throw new Error('bad');
        S = d; S.labs = S.labs || {}; S.seen = S.seen || {}; save(); toast('Progress restored'); home();
      } catch (e) { toast('That is not a valid backup'); }
    };
  }

  function moduleScreen(id) {
    const m = C.modules.find(x => x.id === id); if (!m) return home();
    let h = `<p class="muted">${m.intro || m.summary}</p><div class="card">`;
    m.lessons.forEach(l => { const ok = lessonDone(l);
      h += `<a class="lesson-link" href="#/l/${l.id}"><span>${esc(l.title)}</span><span class="st ${ok ? 'ok' : ''}">${ok ? '✓ done' : l.graded ? l.graded + (l.graded > 1 ? ' tasks' : ' task') : 'read'}</span></a>`; });
    h += '</div>';
    shell(m.icon + ' ' + m.title, '#/', h, 'learn');
  }

  function lessonScreen(id) {
    const l = lessons.find(x => x.id === id); if (!l) return home();
    const main = shell(l.title, '#/m/' + l.module.id, '', 'learn');
    main.appendChild(el(`<p class="muted small">${esc(l.module.title)} · lesson ${l.idx + 1} of ${l.module.lessons.length}</p>`));
    l.blocks.forEach(b => main.appendChild(renderBlock(b, l)));
    const foot = document.createElement('div'); main.appendChild(foot);
    function refreshFoot() {
      const i = lessons.indexOf(l), nxt = lessons[i + 1];
      if (l.graded === 0) { S.seen[l.id] = true; save(); }
      const ok = lessonDone(l);
      const remaining = l.blocks.filter(b => isGraded(b) && !itemDone(b)).length;
      foot.innerHTML = ok
        ? `<div class="done-banner"><b>✓ Lesson complete</b><div class="row" style="justify-content:center">${nxt ? `<a class="btn" href="#/l/${nxt.id}">Next: ${esc(nxt.title)} ›</a>` : `<a class="btn" href="#/code">Open the firmware ›</a>`}</div></div>`
        : `<p class="muted small" style="text-align:center;margin:24px 0">${remaining} task${remaining > 1 ? 's' : ''} left in this lesson</p>`;
    }
    l.refresh = refreshFoot; refreshFoot();
  }

  // ---------- blocks ----------
  function renderBlock(b, l) {
    const done = () => { if (b.t !== 'lab') S.items[b.key] = true; save(); l.refresh && l.refresh(); };
    switch (b.t) {
      case 'h': return el(`<h3>${b.html}</h3>`);
      case 'p': return el(`<p>${b.html}</p>`);
      case 'html': return el(`<div>${b.html}</div>`);
      case 'note': return el(`<div class="note ${b.kind || ''}">${b.title ? `<b class="lbl">${esc(b.title)}</b>` : ''}${b.html}</div>`);
      case 'code': { const d = el(`<div><pre class="code"><code>${hl(b.code)}</code></pre>${b.caption ? `<div class="caption">${b.caption}</div>` : ''}</div>`); return d; }
      case 'table': return el(`<div class="tw"><table><tr>${b.head.map(x => `<th>${x}</th>`).join('')}</tr>${b.rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</table></div>`);
      case 'mcq': return mcq(b, done);
      case 'multi': return multi(b, done);
      case 'fill': return fill(b, done);
      case 'order': return order(b, done);
      case 'bug': return bug(b, done);
      case 'num': return num(b, done);
      case 'lab': return lab(b, l);
      case 'widget': return (WIDGETS[b.name] || (() => el('<div>?</div>')))(b, done);
    }
    return el('<div></div>');
  }
  function qbox(b, label) {
    const d = el(`<div class="q ${S.items[b.key] ? 'done' : ''}"><div class="qh">${label}${S.items[b.key] ? ' · ✓' : ''}</div><div class="qt">${b.q}</div></div>`);
    if (b.code) d.appendChild(el(`<pre class="code"><code>${hl(b.code)}</code></pre>`));
    return d;
  }
  function feedback(d) { const f = el('<div class="fb"></div>'); d.appendChild(f);
    return (good, html) => { f.className = 'fb show ' + (good ? 'good' : 'bad'); f.innerHTML = html; if (good) d.classList.add('done'); }; }

  function mcq(b, done) {
    const d = qbox(b, 'Quiz'); const fb = feedback(d);
    const order = b.keep ? b.opts.map((_, i) => i) : shuffle(b.opts.map((_, i) => i), b.key);
    order.forEach(i => { const o = el(`<button class="opt">${b.opts[i]}</button>`); d.insertBefore(o, d.querySelector('.fb'));
      o.onclick = () => { const ok = i === b.a; o.classList.add(ok ? 'right' : 'wrong');
        fb(ok, (ok ? '✓ Right. ' : '✗ Not quite. ') + (ok ? (b.why || '') : (b.hints && b.hints[i] ? b.hints[i] : 'Try another option.')));
        if (ok) { d.querySelectorAll('.opt').forEach(x => x.disabled = true); done(); } }; });
    if (S.items[b.key]) { const o = [...d.querySelectorAll('.opt')][order.indexOf(b.a)]; o.classList.add('right'); fb(true, '✓ ' + (b.why || '')); }
    return d;
  }
  function multi(b, done) {
    const d = qbox(b, 'Select all that apply'); const fb = feedback(d); const sel = new Set();
    b.opts.forEach((t, i) => { const o = el(`<button class="opt">☐ ${t}</button>`); d.insertBefore(o, d.querySelector('.fb'));
      o.onclick = () => { sel.has(i) ? sel.delete(i) : sel.add(i); o.classList.toggle('sel'); o.innerHTML = (sel.has(i) ? '☑ ' : '☐ ') + t; }; });
    const btn = el('<button class="btn small">Check</button>'); d.insertBefore(btn, d.querySelector('.fb'));
    btn.onclick = () => { const ok = b.a.length === sel.size && b.a.every(i => sel.has(i));
      [...d.querySelectorAll('.opt')].forEach((o, i) => { o.classList.remove('right', 'wrong'); if (sel.has(i)) o.classList.add(b.a.includes(i) ? 'right' : 'wrong'); });
      fb(ok, ok ? '✓ ' + (b.why || '') : '✗ Not all correct yet — ' + (b.hint || 'check each option again.')); if (ok) done(); };
    if (S.items[b.key]) fb(true, '✓ ' + (b.why || ''));
    return d;
  }
  function fill(b, done) {
    const d = qbox(b, 'Fill in the code'); const answers = [];
    const html = esc(b.code).replace(/\{\{(.+?)\}\}/g, (_, a) => { const alts = a.split('|').map(x => x.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
      answers.push(alts); const w = Math.max(...alts.map(x => x.length)) + 1; return `<input size="${w}" autocapitalize="off" autocomplete="off" spellcheck="false">`; });
    const box = el(`<div class="fillcode">${html}</div>`); d.appendChild(box); const fb = feedback(d);
    const inputs = [...box.querySelectorAll('input')]; let tries = 0;
    const row = el('<div class="row"><button class="btn small">Check</button><button class="btn ghost small" style="display:none">Show answer</button></div>');
    d.insertBefore(row, d.querySelector('.fb'));
    const [chk, show] = row.querySelectorAll('button');
    chk.onclick = () => { tries++; let all = true;
      inputs.forEach((inp, i) => { const ok = answers[i].some(a => b.ci ? norm(a).toLowerCase() === norm(inp.value).toLowerCase() : norm(a) === norm(inp.value));
        inp.classList.toggle('right', ok); inp.classList.toggle('wrong', !ok); all = all && ok; });
      fb(all, all ? '✓ ' + (b.why || '') : '✗ The red boxes need another look.' + (b.hint ? ' Hint: ' + b.hint : ''));
      if (tries >= 2 && !all) show.style.display = '';
      if (all) done(); };
    show.onclick = () => { inputs.forEach((inp, i) => { inp.value = answers[i][0]; }); toast('Answers filled in — press Check'); };
    if (S.items[b.key]) { inputs.forEach((inp, i) => { inp.value = answers[i][0]; inp.classList.add('right'); }); fb(true, '✓ ' + (b.why || '')); }
    return d;
  }
  function order(b, done) {
    const d = qbox(b, 'Put in order'); const picked = [];
    const pool = el('<div class="chips"></div>'), seq = el('<ol class="seq"></ol>'); d.appendChild(seq); d.appendChild(pool);
    const idx = shuffle(b.items.map((_, i) => i), b.key);
    idx.forEach(i => { const c = el(`<button class="chip">${b.items[i]}</button>`); pool.appendChild(c);
      c.onclick = () => { if (c.classList.contains('used')) return; c.classList.add('used'); picked.push(i); seq.appendChild(el(`<li>${b.items[i]}</li>`)); }; });
    const row = el('<div class="row"><button class="btn small">Check</button><button class="btn ghost small">Reset</button></div>'); d.appendChild(row);
    const fb = feedback(d); const [chk, rst] = row.querySelectorAll('button');
    rst.onclick = () => { picked.length = 0; seq.innerHTML = ''; pool.querySelectorAll('.chip').forEach(c => c.classList.remove('used')); };
    chk.onclick = () => { if (picked.length < b.items.length) return fb(false, 'Tap every item first.');
      const ok = picked.every((v, i) => v === i);
      let wrongAt = picked.findIndex((v, i) => v !== i);
      fb(ok, ok ? '✓ ' + (b.why || '') : `✗ Step ${wrongAt + 1} is out of place. Reset and try again.`); if (ok) done(); };
    if (S.items[b.key]) { b.items.forEach(t => seq.appendChild(el(`<li>${t}</li>`))); pool.style.display = 'none'; fb(true, '✓ ' + (b.why || '')); }
    return d;
  }
  function bug(b, done) {
    const d = el(`<div class="q ${S.items[b.key] ? 'done' : ''}"><div class="qh">Find the bug</div><div class="qt">${b.q}</div></div>`);
    const lines = b.code.split('\n'); const box = el('<div class="bugcode"></div>'); d.appendChild(box); const fb = feedback(d);
    lines.forEach((ln, i) => { const r = el(`<div><span class="ln">${i + 1}</span>${hl(ln) || ' '}</div>`); box.appendChild(r);
      r.onclick = () => { const ok = i === b.a; r.classList.add(ok ? 'right' : 'wrong'); fb(ok, ok ? '✓ ' + b.why : '✗ That line is fine. Look again.'); if (ok) done(); }; });
    if (S.items[b.key]) { box.children[b.a].classList.add('right'); fb(true, '✓ ' + b.why); }
    return d;
  }
  function num(b, done) {
    const d = qbox(b, 'Calculate'); const row = el(`<div class="row"><input class="num" inputmode="decimal" placeholder="answer"> <span class="muted">${b.unit || ''}</span><button class="btn small">Check</button></div>`);
    d.appendChild(row); const fb = feedback(d); const inp = row.querySelector('input');
    row.querySelector('button').onclick = () => { const v = parseFloat(String(inp.value).replace(',', '.')); const tol = b.tol != null ? b.tol : Math.abs(b.a) * 0.02;
      const ok = !isNaN(v) && Math.abs(v - b.a) <= tol; fb(ok, ok ? '✓ ' + (b.why || '') : '✗ Not quite.' + (b.hint ? ' Hint: ' + b.hint : '')); if (ok) done(); };
    if (S.items[b.key]) { inp.value = b.a; fb(true, '✓ ' + (b.why || '')); }
    return d;
  }

  // ---------- code labs ----------
  const strip = code => code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  function lab(b, l) {
    const st = S.labs[b.id] = S.labs[b.id] || {};
    const d = el(`<div class="q ${st.passed || st.revealed ? 'done' : ''}"><div class="qh">Code lab${st.passed ? ' · ✓ passed' : st.revealed ? ' · solution viewed' : ''}</div><div class="qt">${esc(b.title)}</div><div>${b.task}</div></div>`);
    const ta = el(`<textarea class="editor" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"></textarea>`);
    ta.value = st.code != null ? st.code : (b.starter || '');
    const syms = ['{', '}', '(', ')', ';', '[', ']', '<', '>', '=', '&', '*', '|', '!', '"', "'", '#', '_', '->', '::', '0x', '  '];
    const bar = el('<div class="symbar"></div>'); syms.forEach(s => { const k = el(`<button type="button">${esc(s === '  ' ? '⇥' : s)}</button>`);
      k.onclick = () => { const a = ta.selectionStart, z = ta.selectionEnd; ta.setRangeText(s, a, z, 'end'); ta.focus(); persist(); }; bar.appendChild(k); });
    let tmr; function persist() { clearTimeout(tmr); tmr = setTimeout(() => { st.code = ta.value; save(); }, 400); }
    ta.addEventListener('input', persist);
    ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); persist(); } });
    d.appendChild(bar); d.appendChild(ta);
    const row = el(`<div class="row"><button class="btn small">▶ Check my code</button><button class="btn ghost small">Hint</button><button class="btn ghost small">Reference</button><button class="btn ghost small">Reset</button></div>`);
    d.appendChild(row); const out = el('<ul class="checks"></ul>'); d.appendChild(out); const extra = el('<div></div>'); d.appendChild(extra);
    const [run, hint, ref, rst] = row.querySelectorAll('button');
    run.onclick = () => {
      st.code = ta.value; const src = strip(ta.value); let pass = 0;
      out.innerHTML = '';
      b.checks.forEach(c => { const re = new RegExp(c.re, c.f || 'm'); const hit = re.test(src); const ok = c.not ? !hit : hit; if (ok) pass++;
        out.appendChild(el(`<li class="${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'} ${c.msg}</li>`)); });
      if (pass === b.checks.length) { st.passed = true; d.classList.add('done'); toast('All checks pass'); }
      save(); l.refresh && l.refresh();
    };
    hint.onclick = () => { extra.innerHTML = `<div class="note tip"><b class="lbl">Hint</b>${b.hint || 'Re-read the lesson above.'}</div>`; };
    ref.onclick = () => { if (!st.passed && !confirm('Show the reference solution? Try the checks first — you learn more by getting stuck for a minute.')) return;
      st.revealed = true; save(); d.classList.add('done'); l.refresh && l.refresh();
      extra.innerHTML = ''; const box = el(`<div><p class="muted small">Reference solution (one correct way — yours may differ and still pass):</p><pre class="code"><code>${hl(b.solution)}</code></pre><div class="row"><button class="btn ghost small">Copy</button><button class="btn ghost small">Put it in the editor</button></div></div>`);
      const [cp, put] = box.querySelectorAll('button'); cp.onclick = () => copy(b.solution); put.onclick = () => { ta.value = b.solution; st.code = b.solution; save(); };
      extra.appendChild(box); };
    rst.onclick = () => { if (confirm('Replace your code with the starter code?')) { ta.value = b.starter || ''; st.code = ta.value; save(); } };
    return d;
  }

  // ---------- widgets ----------
  const WIDGETS = {};
  WIDGETS.bits = (b, done) => {
    const d = el(`<div class="widget"><div class="wh">Widget · bits of one byte</div><p class="small">${b.text || 'Tap bits to turn them on. Watch the decimal and hex values.'}</p><div class="bits"></div><p class="big" style="margin-top:10px"></p></div>`);
    let v = 0; const box = d.querySelector('.bits'), outp = d.querySelector('.big');
    for (let i = 7; i >= 0; i--) { const k = el(`<button>0<small>bit ${i}</small></button>`); box.appendChild(k);
      k.onclick = () => { v ^= 1 << i; draw(); }; }
    function draw() { [...box.children].forEach((k, j) => { const i = 7 - j, on = (v >> i) & 1; k.className = on ? 'on' : ''; k.firstChild.textContent = on; });
      outp.innerHTML = `${v} = 0x${v.toString(16).toUpperCase().padStart(2, '0')} = 0b${v.toString(2).padStart(8, '0')}`;
      if (b.goal != null && v === b.goal) { outp.innerHTML += ' ✓'; done(); } }
    if (b.goal != null) d.appendChild(el(`<p class="small"><b>Goal:</b> make the value <code>${b.goalText}</code>.${S.items[b.key] ? ' ✓ done' : ''}</p>`));
    draw(); return d;
  };
  WIDGETS.mask = (b, done) => {
    const rtc = [0, 2, 4, 12, 13, 14, 15, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39];
    const d = el(`<div class="widget"><div class="wh">Widget · EXT1 wake mask builder (classic ESP32)</div>
      <p class="small">Tap the GPIOs that should wake the hub. Only RTC-capable pins can wake it from deep sleep [DS, ESP32 datasheet Table 2-1]. Pins used by the LILYGO for something else are outlined in amber.</p>
      <div class="pins"></div><pre class="code" style="margin-top:10px"></pre><p class="small goal"></p></div>`);
    const used = { 4: 'PWRKEY', 12: 'LED/strap', 25: 'FLIGHT', 26: 'modem RX', 27: 'modem TX', 32: 'DTR', 33: 'RING', 34: 'STATUS', 35: 'battery ADC', 36: 'solar ADC', 2: 'SD MISO', 14: 'SD SCK', 15: 'SD MOSI', 13: 'SD CS', 0: 'BOOT' };
    const sel = new Set(); const grid = d.querySelector('.pins'), pre = d.querySelector('pre');
    for (let g = 0; g <= 39; g++) { if ([6, 7, 8, 9, 10, 11, 20, 24, 28, 29, 30, 31, 37, 38].includes(g)) continue;
      const ok = rtc.includes(g); const k = el(`<button class="pin ${ok ? '' : 'dim'} ${used[g] ? 'used' : ''}">GPIO${g}<br><small>${used[g] || (ok ? 'RTC' : '—')}</small></button>`);
      k.onclick = () => { if (!ok) { toast('GPIO' + g + ' cannot wake from deep sleep'); return; } sel.has(g) ? sel.delete(g) : sel.add(g); k.classList.toggle('on'); draw(); }; grid.appendChild(k); }
    function draw() { const pins = [...sel].sort((a, c) => a - c); let v = 0n; pins.forEach(p => v |= 1n << BigInt(p));
      pre.innerHTML = hl(`uint64_t mask = ${pins.length ? pins.map(p => '(1ULL << ' + p + ')').join(' | ') : '0'};\n// = 0x${v.toString(16).toUpperCase().padStart(10, '0')}\nesp_sleep_enable_ext1_wakeup_io(mask, ESP_EXT1_WAKEUP_ANY_HIGH);`);
      if (b.goal) { const ok = pins.join(',') === b.goal.join(','); d.querySelector('.goal').innerHTML = `<b>Goal:</b> ${b.goalText}${ok || S.items[b.key] ? ' ✓' : ''}`; if (ok) done(); } }
    draw(); return d;
  };
  WIDGETS.crc = (b, done) => {
    const d = el(`<div class="widget"><div class="wh">Widget · CRC-32 playground</div><p class="small">Type anything. Change a single letter and watch the whole CRC change — that is why the hub can detect a damaged photo.</p>
      <input class="num" style="width:100%" value="123456789"><p class="big" style="margin-top:10px"></p><p class="small muted">The standard check value of CRC-32 for "123456789" is CBF43926. Our <code>crc32Update()</code> produces exactly that (checked when this app was built).</p></div>`);
    const inp = d.querySelector('input'), o = d.querySelector('.big');
    const T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
    function crc(str) { const by = new TextEncoder().encode(str); let c = 0xFFFFFFFF; for (const x of by) c = T[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
    function draw() { o.textContent = '0x' + crc(inp.value).toString(16).toUpperCase().padStart(8, '0') + '  (' + new TextEncoder().encode(inp.value).length + ' bytes)'; }
    inp.oninput = draw; draw(); return d;
  };
  WIDGETS.chunks = (b, done) => {
    const d = el(`<div class="widget"><div class="wh">Widget · how a photo travels over ESP-NOW</div>
      <label class="small">JPEG size: <b class="sz"></b> KB <span class="tag">[E]</span></label><input type="range" min="5" max="120" value="25">
      <label class="small">Data bytes per chunk: <b class="cs"></b></label><input type="range" min="50" max="244" value="200">
      <table><tr><th>Chunks</th><td class="n1"></td></tr><tr><th>Header bytes added</th><td class="n2"></td></tr><tr><th>Air time at 1 Mbps, data only</th><td class="n3"></td></tr><tr><th>Fits one AT+HTTPDATA (≤153,600 B [DS, AT manual])</th><td class="n4"></td></tr></table>
      <p class="small muted">Air time ignores ESP-NOW framing, acknowledgements and retries, so the real time is longer [E]. Measure it (K-10).</p></div>`);
    const [r1, r2] = d.querySelectorAll('input');
    function draw() { const kb = +r1.value, cs = +r2.value, bytes = kb * 1024, n = Math.ceil(bytes / cs);
      d.querySelector('.sz').textContent = kb; d.querySelector('.cs').textContent = cs + (cs + 6 > 250 ? ' (too big: header 6 + data must be ≤ 250)' : '');
      d.querySelector('.n1').textContent = n; d.querySelector('.n2').textContent = (n * 6) + ' B';
      d.querySelector('.n3').textContent = ((bytes + n * 6) * 8 / 1e6).toFixed(2) + ' s'; d.querySelector('.n4').textContent = bytes <= 153600 ? 'yes' : 'no'; }
    r1.oninput = r2.oninput = draw; draw(); return d;
  };
  WIDGETS.budget = (b, done) => {
    const d = el(`<div class="widget"><div class="wh">Widget · daily energy budget (planning figures)</div>
      <p class="small">Every default is a planning figure from PROJECT-STATE §6 <span class="tag">[E]</span> — none is measured yet. Move the sliders to see what matters most.</p>
      <div class="in"></div><table><tr><th>Use per day</th><td class="u"></td></tr><tr><th>Usable capacity (3,000 × 0.55)</th><td>1,650 mAh</td></tr><tr><th>Days on a full cell, no sun</th><td class="days"></td></tr></table></div>`);
    const f = [['Standby', 'mAh/day', 15, 5, 60], ['Events per day', '', 5, 0, 20], ['Energy per event', 'mAh', 18, 5, 40], ['Heartbeats', 'mAh/day', 6, 0, 20]];
    const box = d.querySelector('.in'); const v = f.map(x => x[2]);
    f.forEach((x, i) => { const w = el(`<div><label class="small">${x[0]}: <b>${x[2]}</b> ${x[1]}</label><input type="range" min="${x[3]}" max="${x[4]}" value="${x[2]}"></div>`);
      const r = w.querySelector('input'); r.oninput = () => { v[i] = +r.value; w.querySelector('b').textContent = r.value; draw(); }; box.appendChild(w); });
    function draw() { const u = v[0] + v[1] * v[2] + v[3]; d.querySelector('.u').textContent = u + ' mAh'; d.querySelector('.days').textContent = (1650 / u).toFixed(1) + ' days'; }
    draw(); return d;
  };
  WIDGETS.seq = (b, done) => {
    const steps = C.sequence;
    const d = el(`<div class="widget"><div class="wh">Widget · one trigger, step by step (📐 proposed design)</div><p class="small step"></p><div class="stage"></div>
      <div class="row"><button class="btn ghost small">‹ Back</button><button class="btn small">Next ›</button></div></div>`);
    let i = 0; const [bk, nx] = d.querySelectorAll('button');
    function draw() { const s = steps[i]; d.querySelector('.step').innerHTML = `<b>${i + 1}/${steps.length}.</b> ${s.text}`;
      d.querySelector('.stage').innerHTML = Object.entries(s.state).map(([k, v]) => `<div class="${s.lit && s.lit.includes(k) ? 'lit' : ''}"><b>${k}</b>${v}</div>`).join('');
      bk.disabled = i === 0; nx.textContent = i === steps.length - 1 ? '↺ Restart' : 'Next ›';
      if (i === steps.length - 1 && b.goal) done(); }
    bk.onclick = () => { i = Math.max(0, i - 1); draw(); }; nx.onclick = () => { i = i === steps.length - 1 ? 0 : i + 1; draw(); };
    draw(); return d;
  };
  WIDGETS.wakeloop = (b, done) => {
    const d = el(`<div class="widget"><div class="wh">Widget · the level-triggered wake trap</div>
      <p class="small">The hub is about to sleep with EXT1 "wake when any pin is HIGH". A camera node still holds WAKE high. Choose what the firmware does first, then run it.</p>
      <div class="row"><label class="small"><input type="checkbox" class="w"> wait for WAKE to go LOW before sleeping</label></div>
      <div class="row"><button class="btn small">▶ Run 10 seconds</button></div><pre class="code log" style="max-height:220px"></pre></div>`);
    const run = d.querySelector('button'), log = d.querySelector('.log'), w = d.querySelector('.w');
    run.onclick = () => { let t = 0, lines = [], wakes = 0, wake = true; const wakeFalls = 2.4;
      while (t < 10) { if (t >= wakeFalls) wake = false;
        if (w.checked) { if (wake) { lines.push(`t=${t.toFixed(1)}s  WAKE high → waiting…`); t += 0.5; continue; }
          lines.push(`t=${t.toFixed(1)}s  WAKE low → deep sleep. Stays asleep until the next trigger. ✓`); break; }
        if (wake) { wakes++; lines.push(`t=${t.toFixed(1)}s  sleep → WAKE is HIGH → wakes at once (boot #${wakes}, ~100 mA)`); t += 0.4; }
        else { lines.push(`t=${t.toFixed(1)}s  WAKE low → sleeps properly`); break; } }
      if (!w.checked) lines.push(`\n${wakes} wasted boots. With a node stuck high this never stops.`);
      log.textContent = lines.join('\n'); if (w.checked && b.goal) done(); };
    return d;
  };
  WIDGETS.pinmap = (b) => {
    const data = C.pinmaps[b.board];
    const d = el(`<div class="widget"><div class="wh">Widget · ${esc(data.title)}</div><p class="small">${data.text}</p><div class="pins"></div><div class="note" style="display:none"></div></div>`);
    const grid = d.querySelector('.pins'), info = d.querySelector('.note');
    data.pins.forEach(p => { const k = el(`<button class="pin ${p.cls || ''}">${esc(p.label)}<br><small>${esc(p.short)}</small></button>`);
      k.onclick = () => { grid.querySelectorAll('.pin').forEach(x => x.classList.remove('on')); k.classList.add('on'); info.style.display = ''; info.innerHTML = `<b>${esc(p.label)}</b> — ${p.info}`; }; grid.appendChild(k); });
    return d;
  };
  WIDGETS.adc = (b, done) => {
    const d = el(`<div class="widget"><div class="wh">Widget · battery reading through a divider</div>
      <p class="small">The ADC can only measure up to about 3.1 V at 11 dB attenuation [DS, Arduino ADC docs], so the board halves the battery voltage first. The ×2 divider ratio is an assumption [E] until you calibrate it against your multimeter (I-07).</p>
      <label class="small">Real battery: <b class="bv"></b> V</label><input type="range" min="300" max="420" value="380">
      <label class="small">Calibration factor BAT_CAL: <b class="cf"></b></label><input type="range" min="90" max="110" value="100">
      <table><tr><th>At the ADC pin (÷2)</th><td class="a"></td></tr><tr><th>Firmware reports (×2 × BAT_CAL)</th><td class="f"></td></tr><tr><th>Floor decision</th><td class="dcs"></td></tr></table></div>`);
    const [r1, r2] = d.querySelectorAll('input');
    function draw() { const v = r1.value / 100, cf = r2.value / 100, pin = v / 2, rep = pin * 2 * cf; d.querySelector('.bv').textContent = v.toFixed(2); d.querySelector('.cf').textContent = cf.toFixed(2);
      d.querySelector('.a').textContent = (pin * 1000).toFixed(0) + ' mV'; d.querySelector('.f').textContent = (rep * 1000).toFixed(0) + ' mV';
      d.querySelector('.dcs').textContent = rep < 3.4 ? 'below 3,400 mV → refuse everything, sleep' : rep < 3.6 ? 'below 3,600 mV → capture allowed, no modem' : 'modem allowed'; }
    r1.oninput = r2.oninput = draw; draw(); return d;
  };

  // ---------- reference screens ----------
  function refScreen() { shell('Cheat sheet', '#/', C.cheatsheet, 'ref'); }
  function glossary() {
    const main = shell('Glossary', '#/', `<input class="search" placeholder="Search terms…"><dl></dl>`, 'glo');
    const dl = main.querySelector('dl'), s = main.querySelector('input');
    function draw() { const q = s.value.toLowerCase(); dl.innerHTML = C.glossary.filter(g => !q || (g[0] + g[1]).toLowerCase().includes(q)).map(g => `<dt>${esc(g[0])}</dt><dd>${g[1]}</dd>`).join(''); }
    s.oninput = draw; draw();
  }
  function codeScreen() {
    const files = [['SmartPost_Node.ino', FW.node, 'Camera node · XIAO ESP32-S3 Sense'], ['SmartPost_Hub.ino', FW.hub, 'Hub · LILYGO T-SIM7600E-H'], ['SmartPostProtocol.h', FW.protocol, 'Shared by both sketches']];
    let h = `<div class="note warn"><b class="lbl">Status: untested (📐)</b>These are the course's reference programs for the proposed design in PROJECT-STATE §5. They were compile-checked against ESP32 core 3.3.8 in GitHub Actions, not run on your boards. Bench-test each part in the order of the project's next-steps list before trusting them.</div>`;
    h += files.map((f, i) => `<div class="card"><b>${f[0]}</b><div class="muted small">${f[2]} · ${(f[1] || '').split('\n').length} lines</div><div class="row"><button class="btn small" data-v="${i}">View</button><button class="btn ghost small" data-c="${i}">Copy</button></div><div class="v"></div></div>`).join('');
    const main = shell('Firmware', '#/', h, 'code');
    main.querySelectorAll('[data-v]').forEach(bt => bt.onclick = () => { const f = files[+bt.dataset.v]; const box = bt.closest('.card').querySelector('.v');
      box.innerHTML = box.innerHTML ? '' : `<pre class="code"><code>${hl(f[1] || '')}</code></pre>`; });
    main.querySelectorAll('[data-c]').forEach(bt => bt.onclick = () => copy(files[+bt.dataset.c][1] || ''));
  }
  function sources() { shell('Sources', '#/', C.sources, 'learn'); }
  function about() { shell('About & labels', '#/', C.about, 'learn'); }

  // ---------- router ----------
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [a, b] = h.split('/');
    if (a === 'm') moduleScreen(b); else if (a === 'l') lessonScreen(b); else if (a === 'ref') refScreen();
    else if (a === 'glossary') glossary(); else if (a === 'code') codeScreen(); else if (a === 'sources') sources(); else if (a === 'about') about(); else home();
  }
  window.addEventListener('hashchange', route);
  route();
})();

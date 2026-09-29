// Treeni-tracker – frontend (yhden sivun sovellus)
const $ = id => document.getElementById(id);
const app = $('app');

// SVG-ikonit (viivapiirros, 24×24)
const ICONS = {
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"/>',
  dumbbell: '<rect x="1.5" y="9" width="2.2" height="6" rx="1" fill="currentColor"/><rect x="4.4" y="6.5" width="3" height="11" rx="1.4" fill="currentColor"/><rect x="16.6" y="6.5" width="3" height="11" rx="1.4" fill="currentColor"/><rect x="20.3" y="9" width="2.2" height="6" rx="1" fill="currentColor"/><rect x="7.4" y="10.9" width="9.2" height="2.2" rx="1.1" fill="currentColor"/>',
  target: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
  wind: '<path d="M17.7 7.7A2.5 2.5 0 1 1 19.5 12H2M9.6 4.6A2 2 0 1 1 11 8H2m10.6 11.4A2 2 0 1 0 14 16H2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  clock: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  play: '<path d="M8 5.5v13a.6.6 0 0 0 .9.5l10.4-6.5a.6.6 0 0 0 0-1L8.9 5a.6.6 0 0 0-.9.5z" fill="currentColor"/>',
  check: '<path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="3.5" cy="6" r="1.3" fill="currentColor"/><circle cx="3.5" cy="12" r="1.3" fill="currentColor"/><circle cx="3.5" cy="18" r="1.3" fill="currentColor"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 10.5v3.5l2.3 1.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9.5 2.5h5M12 2.5V6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

const PHASE_META = {
  warmup:     { label: 'Lämmittely',  color: 'var(--warmup)',     icon: 'flame' },
  activating: { label: 'Aktivoinnit', color: 'var(--activating)', icon: 'pulse' },
  explosive:  { label: 'Räjähtävät',  color: 'var(--explosive)',  icon: 'bolt' },
  strength:   { label: 'Voima',       color: 'var(--strength)',   icon: 'dumbbell' },
  core:       { label: 'Keskivartalo',color: 'var(--core)',       icon: 'target' },
  cooldown:   { label: 'Jäähdyttely', color: 'var(--warmup)',     icon: 'wind' },
};
const PROG_META = {
  leg:   { grad: 'grad-leg',   icon: 'bolt' },
  upper: { grad: 'grad-upper', icon: 'dumbbell' },
  core:  { grad: 'grad-core',  icon: 'flame' },
};
const PHASE_ORDER = ['warmup', 'activating', 'explosive', 'strength', 'core', 'cooldown'];
const METRIC_LABEL = { weight_reps: 'Paino + toistot', reps: 'Toistot', distance: 'Matka (m)', time: 'Aika' };

let programsList = [];
let meta = {};
const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- API ----------
async function api(pathStr, opts) {
  const res = await fetch(`./api/${pathStr}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(`API ${pathStr}: ${res.status}`);
  return res.json();
}
const getActive = () => { try { return JSON.parse(localStorage.getItem('treeni_session') || 'null'); } catch { return null; } };
const setActive = v => v ? localStorage.setItem('treeni_session', JSON.stringify(v)) : localStorage.removeItem('treeni_session');
const doneKey = sid => `treeni_done_${sid}`;
const getDone = sid => new Set(JSON.parse(localStorage.getItem(doneKey(sid)) || '[]'));
const setDone = (sid, set) => localStorage.setItem(doneKey(sid), JSON.stringify([...set]));

let toastTimer = null;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2000);
}

// ---------- muotoilu ----------
function fmtDuration(sec) {
  sec = Math.round(sec);
  if (sec >= 60 && sec % 60 === 0) return `${sec / 60} min`;
  if (sec >= 60) return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  return `${sec} s`;
}
function parseDuration(str) {
  str = (str || '').trim();
  if (!str) return null;
  if (str.includes(':')) { const [m, s] = str.split(':'); return (Number(m) || 0) * 60 + (Number(s) || 0); }
  return Number(str) || null;
}
function setShort(metric, s) {
  if (metric === 'weight_reps') return `${s.weightKg != null ? s.weightKg + 'kg' : ''}${s.weightKg != null && s.reps != null ? '×' : ''}${s.reps != null ? s.reps : ''}` || '–';
  if (metric === 'reps') return s.reps != null ? `${s.reps}` : '–';
  if (metric === 'distance') return s.distanceM != null ? `${s.distanceM} m` : '–';
  if (metric === 'time') return s.seconds != null ? fmtDuration(s.seconds) : '–';
  return '–';
}
function setFull(metric, s) {
  if (metric === 'weight_reps') return `${s.weightKg != null ? s.weightKg + ' kg' : 'omapaino'} × ${s.reps != null ? s.reps : '–'}`;
  if (metric === 'reps') return `${s.reps != null ? s.reps : '–'} toistoa`;
  if (metric === 'distance') return `${s.distanceM != null ? s.distanceM : '–'} m`;
  if (metric === 'time') return s.seconds != null ? fmtDuration(s.seconds) : '–';
  return '–';
}
function fmtDate(iso) { return new Date(iso).toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' }); }
function prescription(ex) {
  const parts = [];
  if (ex.sets) parts.push(`${ex.sets} ×`);
  if (ex.targetReps) parts.push(ex.targetReps);
  let s = parts.join(' ');
  if (ex.metric === 'weight_reps' && ex.targetWeight != null) s += `${s ? ' ' : ''}@ ${ex.targetWeight} kg`;
  return s;
}
const progName = id => (programsList.find(p => p.id === id) || {}).name || 'Treeni';
function firstNum(s) { const m = (s || '').match(/\d+(?:[.,]\d+)?/); return m ? Number(m[0].replace(',', '.')) : null; }
function targetSecondsOf(s) {
  s = (s || '').toLowerCase().trim(); if (!s) return null;
  if (s.includes(':')) return parseDuration(s);
  const n = firstNum(s); if (n == null) return null;
  return s.includes('min') ? n * 60 : n;
}
// Reseptin arvo lukuna (alaraja alueesta, esim. "6–8" → 6). Käytetään esitäyttöön ja "valmis"-pikakirjaukseen.
function targetFields(ex) {
  const f = {};
  if (ex.metric === 'weight_reps') { f.reps = firstNum(ex.targetReps); if (ex.targetWeight != null) f.weightKg = ex.targetWeight; }
  else if (ex.metric === 'reps') { f.reps = firstNum(ex.targetReps); }
  else if (ex.metric === 'distance') { f.distanceM = firstNum(ex.targetReps); }
  else if (ex.metric === 'time') { f.seconds = targetSecondsOf(ex.targetReps); }
  return f;
}

// ---------- ajastin ----------
// "Kylkilankku 30, Keskilankku 60" tai "Vaihe 1 min" -> [{label, seconds}]
function parseTimerStages(str) {
  return (str || '').split(/[,\n;]+/).map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(.*?)\s*(\d+(?:[.,]\d+)?)\s*(min|s)?\.?$/i);
    if (!m) return null;
    let sec = Number(m[2].replace(',', '.'));
    if ((m[3] || 's').toLowerCase() === 'min') sec *= 60;
    return { label: m[1].trim() || 'Vaihe', seconds: Math.round(sec) };
  }).filter(s => s && s.seconds > 0);
}

// Nouseva ajastin: +5 s / vaihe jokaisen tehdyn kerran jälkeen (viime kirjauksen perusteella), max 2× perusaika
function timerStagesFor(ex) {
  const stages = parseTimerStages(ex.timerStages);
  if (!stages.length || !ex.timerProgress) return stages;
  const base = stages.reduce((a, s) => a + s.seconds, 0);
  const sets = (ex.last && ex.last.sets) || [];
  const lastSecs = [...sets].reverse().map(s => s.seconds).find(v => v != null);
  let bump = 0;
  if (lastSecs != null && lastSecs >= base) bump = Math.floor((lastSecs - base) / (5 * stages.length)) * 5 + 5;
  return stages.map(s => ({ label: s.label, seconds: Math.min(s.seconds + bump, s.seconds * 2) }));
}

let audioCtx = null;
function beep(freq, dur = 0.12, when = 0) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.28, audioCtx.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + when + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(audioCtx.currentTime + when); o.stop(audioCtx.currentTime + when + dur + 0.05);
  } catch (e) {}
}
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
const clockFmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Vaiheistettu ajastin. onDone(totalSeconds) kutsutaan kun koko sarja on tehty loppuun.
function openTimer(stages, title, onDone) {
  if (!stages.length) return;
  const total = stages.reduce((a, s) => a + s.seconds, 0);
  // Vaiheiden väliin 5 s asennonvaihtotauko (ei lasketa kirjattavaan aikaan)
  const seq = [{ label: 'Valmistaudu', seconds: 5, prep: true }];
  stages.forEach((s, i) => {
    if (i) seq.push({ label: 'Vaihda asento', seconds: 5, prep: true });
    seq.push({ ...s, wi: i });
  });
  const el = document.createElement('div');
  el.className = 'timer-sheet';
  el.innerHTML = `
    <button class="t-close">✕</button>
    <div class="t-title">${esc(title || '')}</div>
    <div class="t-stage"></div>
    <div class="t-clock"></div>
    <div class="t-next"></div>
    <div class="t-progress">${stages.map(s => `<span class="t-seg" style="flex:${s.seconds}"></span>`).join('')}</div>
    <div class="t-controls">
      <button class="btn ghost t-skip">Ohita vaihe</button>
      <button class="btn t-pause">Tauko</button>
    </div>`;
  document.body.appendChild(el);

  const stageEl = el.querySelector('.t-stage'), clockEl = el.querySelector('.t-clock'),
        nextEl = el.querySelector('.t-next'), segs = el.querySelectorAll('.t-seg'),
        pauseBtn = el.querySelector('.t-pause');
  let idx = 0, left = seq[0].seconds, running = true, lastTick = null, lastWhole = null, raf = null;

  beep(660); // herätä iOS-audio käyttäjän kosketuksesta
  const draw = () => {
    const cur = seq[idx];
    stageEl.textContent = cur.label;
    stageEl.classList.toggle('prep', !!cur.prep);
    clockEl.textContent = clockFmt(Math.max(0, Math.ceil(left)));
    const nxt = seq.slice(idx + 1).find(s => s.wi != null);
    nextEl.textContent = nxt ? `Seuraavaksi: ${nxt.label} ${clockFmt(nxt.seconds)}` : 'Viimeinen vaihe';
    const wi = cur.wi;
    const upcoming = seq.slice(idx).find(s => s.wi != null);
    const doneN = wi != null ? wi : (upcoming ? upcoming.wi : stages.length);
    segs.forEach((sg, i) => {
      sg.classList.toggle('done', i < doneN);
      sg.classList.toggle('cur', i === wi);
    });
  };
  const finish = () => {
    running = false; cancelAnimationFrame(raf);
    beep(880, 0.5); beep(1100, 0.6, 0.25); buzz([200, 80, 200]);
    stageEl.textContent = 'Valmis!'; clockEl.textContent = '💪'; nextEl.textContent = '';
    segs.forEach(sg => sg.classList.add('done'));
    setTimeout(() => el.remove(), 1600);
    if (onDone) onDone(total);
  };
  const advance = () => {
    idx++;
    if (idx >= seq.length) return finish();
    left = seq[idx].seconds; lastWhole = null;
    beep(880); beep(880, 0.12, 0.18); buzz(120);
    draw();
  };
  const tick = (ts) => {
    if (!running) return;
    if (lastTick != null) {
      left -= (ts - lastTick) / 1000;
      const whole = Math.ceil(left);
      if (whole !== lastWhole && whole > 0 && whole <= 3) beep(560, 0.09); // loppulaskenta
      lastWhole = whole;
      if (left <= 0) { lastTick = ts; advance(); if (!running) return; }
      else draw();
    }
    lastTick = ts;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  draw();

  pauseBtn.onclick = () => {
    running = !running;
    pauseBtn.textContent = running ? 'Tauko' : 'Jatka';
    if (running) { lastTick = null; raf = requestAnimationFrame(tick); }
    else cancelAnimationFrame(raf);
  };
  el.querySelector('.t-skip').onclick = () => { if (idx < seq.length) advance(); };
  el.querySelector('.t-close').onclick = () => { running = false; cancelAnimationFrame(raf); el.remove(); };
}

// ---------- navigointi ----------
function setHeader(title, sub, showBack, backFn) {
  $('head-title').textContent = title;
  $('head-sub').textContent = sub || '';
  $('back-btn').classList.toggle('hidden', !showBack);
  $('back-btn').onclick = backFn || renderHome;
}

// ---------- HOME ----------
async function renderHome() {
  setHeader('Treeni', meta.note || '', false);
  app.innerHTML = `<div class="loading">Ladataan…</div>`;
  programsList = await api('programs');
  const active = getActive();
  let html = '';
  if (active) {
    html += `<div class="card active-card">
      <div class="active-badge"><span class="pulse"></span>Kesken oleva treeni</div>
      <div class="ex-name" style="margin:8px 0 14px">${esc(progName(active.program))}</div>
      <div class="row">
        <button class="btn" id="resume">${icon('play')}Jatka</button>
        <button class="btn danger" id="finish">Lopeta</button>
      </div></div>`;
  }
  html += programsList.map(p => {
    const pm = PROG_META[p.id] || { grad: 'grad-leg', icon: 'dumbbell' };
    return `
    <div class="card prog-card ${pm.grad}" data-prog="${p.id}">
      <div class="watermark">${icon(pm.icon)}</div>
      <div class="ex-top" style="align-items:center">
        <div class="prog-icon">${icon(pm.icon)}</div>
        <div style="flex:1">
          <div class="ex-name">${esc(p.name)}</div>
          <div class="sess-meta">${p.exerciseCount} liikettä</div>
        </div>
      </div>
      <div class="row" style="margin-top:16px">
        <button class="btn" data-start="${p.id}">${icon('play')}Aloita</button>
        <button class="btn ghost small" data-view="${p.id}" style="flex:0 0 auto">${icon('list')}Liikkeet</button>
      </div>
    </div>`;
  }).join('');
  html += `<button class="btn secondary" id="go-history" style="margin-top:6px">${icon('clock')}Historia</button>`;
  app.innerHTML = html;

  if (active) {
    $('resume').onclick = () => renderSession(active.id, active.program);
    $('finish').onclick = () => finishSession(active.id);
  }
  app.querySelectorAll('[data-start]').forEach(b => b.onclick = () => startProgram(b.dataset.start));
  app.querySelectorAll('[data-view]').forEach(b => b.onclick = () => renderProgram(b.dataset.view));
  $('go-history').onclick = renderHistory;
}

async function startProgram(programId) {
  const s = await api('sessions', { method: 'POST', body: JSON.stringify({ program: programId }) });
  setActive({ id: s.id, program: programId });
  renderSession(s.id, programId);
}

async function finishSession(sid) {
  await api(`sessions/${sid}`, { method: 'PATCH', body: JSON.stringify({ finish: true }) });
  setActive(null); localStorage.removeItem(doneKey(sid));
  toast('Treeni tallennettu 💪'); renderHome();
}

// ---------- SESSION ----------
async function renderSession(sid, programId) {
  setHeader(progName(programId), 'Kirjaa sarjat vaiheittain', true);
  app.innerHTML = `<div class="loading">Ladataan…</div>`;
  const [{ exercises }, sess] = await Promise.all([
    api(`program?program=${programId}&withLast=1&exclude=${sid}`),
    api(`sessions/${sid}`),
  ]);
  const sets = sess.sets || [];
  // Kiertoliikkeistä näytetään vain tähän treeniin valitut (vanhoissa treeneissä kaikki)
  const rotIds = sess.rotationExerciseIds;
  const visible = exercises.filter(e => !e.rotate || !rotIds || rotIds.includes(e.id));
  const byEx = {};
  for (const s of sets) (byEx[s.exerciseId] = byEx[s.exerciseId] || []).push(s);
  const done = getDone(sid);

  let html = '';
  for (const phase of PHASE_ORDER) {
    const list = visible.filter(e => e.phase === phase);
    if (!list.length) continue;
    const pm = PHASE_META[phase];
    html += `<div class="phase-band" style="--pc:${pm.color}">${icon(pm.icon)}${pm.label}</div>`;
    for (const ex of list) html += exerciseCard(ex, byEx[ex.id] || [], done.has(ex.id));
  }
  html += `<button class="btn" id="finish-session" style="margin-top:18px">${icon('check')}Lopeta ja tallenna treeni</button><div style="height:24px"></div>`;
  app.innerHTML = html;
  app.querySelectorAll('.ex').forEach(card => wireCard(card, sid));
  $('finish-session').onclick = () => finishSession(sid);
}

function dotsHtml(done, target) {
  const n = Math.max(target || 0, done);
  let d = '';
  for (let i = 0; i < n; i++) d += `<span class="dot ${i < done ? 'on' : ''}"></span>`;
  const lbl = n ? (target ? `${done}/${target} sarjaa` : `${done} sarjaa`) : '';
  return `<div class="dots" data-dots data-target="${target || 0}">${d}${lbl ? `<span class="lbl">${lbl}</span>` : ''}</div>`;
}

function exerciseCard(ex, sets, isDone) {
  const pm = PHASE_META[ex.phase];
  const presc = prescription(ex);
  const tst = timerStagesFor(ex);
  const lastHtml = ex.last && ex.last.sets && ex.last.sets.length
    ? `<div class="last">Viimeksi <b>${fmtDate(ex.last.sessionDate + 'T12:00:00')}</b>: ${ex.last.sets.map(s => setShort(ex.metric, s)).join(', ')}</div>` : '';
  const setRows = sets.map((s, i) =>
    `<div class="set-row" data-set="${s.id}"><span class="no">${i + 1}.</span><span class="val">${setFull(ex.metric, s)}</span><button class="del" data-del="${s.id}">✕</button></div>`).join('');
  const tf = targetFields(ex);
  return `
  <div class="card ex ${isDone ? 'done' : ''}" data-ex="${ex.id}" data-metric="${ex.metric}" data-name="${esc(ex.name)}" data-phase="${ex.phase}" data-stages="${esc(JSON.stringify(tst))}"
    data-tsets="${ex.sets || 1}" data-tweight="${ex.targetWeight != null ? ex.targetWeight : ''}" data-treps="${tf.reps != null ? tf.reps : ''}" data-tdist="${tf.distanceM != null ? tf.distanceM : ''}" data-tsec="${tf.seconds != null ? tf.seconds : ''}"
    style="--pc:${pm.color}">
    <div class="ex-top">
      <div class="ex-name">${esc(ex.name)}</div>
      ${presc ? `<div class="ex-target">${esc(presc)}</div>` : ''}
      <button class="ex-check ${isDone ? 'on' : ''}" data-check>✓</button>
    </div>
    ${dotsHtml(sets.length, ex.sets)}
    ${ex.cue ? `<div class="cue-toggle" data-cuetoggle>Ohje ▾</div><div class="cue hidden" data-cue>${esc(ex.cue)}</div>` : ''}
    ${lastHtml}
    <div class="sets" data-sets>${setRows}</div>
    ${tst.length ? `<button class="timer-btn" data-timer>${icon('timer')}Käynnistä ajastin<span class="timer-secs">${tst.map(s => s.seconds + ' s').join(' · ')}</span></button>` : ''}
    <div class="entry" data-entry>${metricInputs(ex)}<button class="add-set" data-add>+ Sarja</button></div>
  </div>`;
}

function metricInputs(ex) {
  const lastSet = ex.last && ex.last.sets && ex.last.sets.length ? ex.last.sets[ex.last.sets.length - 1] : null;
  const tf = targetFields(ex);
  const v = (last, targ) => (last != null ? last : (targ != null ? targ : ''));
  if (ex.metric === 'weight_reps') {
    const w = v(lastSet && lastSet.weightKg, ex.targetWeight);
    const r = v(lastSet && lastSet.reps, tf.reps);
    return `<div class="field w"><label>kg</label><input type="number" inputmode="decimal" step="0.5" data-f="weightKg" value="${w}"></div>
    <div class="field w"><label>toistot</label><input type="number" inputmode="numeric" data-f="reps" value="${r}"></div>`;
  }
  if (ex.metric === 'reps') { const r = v(lastSet && lastSet.reps, tf.reps); return `<div class="field grow"><label>toistot</label><input type="number" inputmode="numeric" data-f="reps" value="${r}"></div>`; }
  if (ex.metric === 'distance') { const d = v(lastSet && lastSet.distanceM, tf.distanceM); return `<div class="field grow"><label>metriä</label><input type="number" inputmode="numeric" data-f="distanceM" value="${d}"></div>`; }
  if (ex.metric === 'time') {
    const s = v(lastSet && lastSet.seconds, tf.seconds);
    const disp = (s !== '' && s != null && s >= 60) ? `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}` : s;
    return `<div class="field grow"><label>kesto (mm:ss tai s)</label><input type="text" inputmode="numeric" data-f="seconds" value="${disp}"></div>`;
  }
  return '';
}

function wireCard(card, sid) {
  const exId = card.dataset.ex, metric = card.dataset.metric;
  const cueT = card.querySelector('[data-cuetoggle]');
  if (cueT) cueT.onclick = () => card.querySelector('[data-cue]').classList.toggle('hidden');
  const dotsEl = card.querySelector('[data-dots]');
  const target = dotsEl ? Number(dotsEl.dataset.target) || 0 : 0;
  const refreshProgress = () => {
    if (!dotsEl) return;
    const done = card.querySelectorAll('.set-row').length;
    const n = Math.max(target, done);
    let d = '';
    for (let i = 0; i < n; i++) d += `<span class="dot ${i < done ? 'on' : ''}"></span>`;
    const lbl = n ? (target ? `${done}/${target} sarjaa` : `${done} sarjaa`) : '';
    dotsEl.innerHTML = d + (lbl ? `<span class="lbl">${lbl}</span>` : '');
  };

  const setsEl = card.querySelector('[data-sets]');
  const appendRow = (saved) => {
    const setNo = card.querySelectorAll('.set-row').length + 1;
    const row = document.createElement('div');
    row.className = 'set-row'; row.dataset.set = saved.id;
    row.innerHTML = `<span class="no">${setNo}.</span><span class="val">${setFull(metric, saved)}</span><button class="del">✕</button>`;
    row.querySelector('.del').onclick = () => delSet(saved.id, row, refreshProgress);
    setsEl.appendChild(row); refreshProgress();
  };
  const logSet = (fields, setNo) => api('sets', { method: 'POST', body: JSON.stringify({
    sessionId: sid, exerciseId: exId, exerciseName: card.dataset.name, metric, phase: card.dataset.phase, setNo, ...fields }) });
  const markDone = on => {
    const chk = card.querySelector('[data-check]'); const d = getDone(sid);
    if (on) { d.add(exId); chk.classList.add('on'); card.classList.add('done'); }
    else { d.delete(exId); chk.classList.remove('on'); card.classList.remove('done'); }
    setDone(sid, d);
  };

  // "Valmis"-nappi: jos yhtään sarjaa ei ole kirjattu, kirjaa reseptin mukaiset sarjat automaattisesti.
  card.querySelector('[data-check]').onclick = async (e) => {
    const btn = e.currentTarget;
    if (getDone(sid).has(exId)) { markDone(false); return; }
    if (card.querySelectorAll('.set-row').length === 0) {
      const nSets = Math.max(1, Number(card.dataset.tsets) || 1);
      const base = {};
      if (card.dataset.tweight !== '') base.weightKg = Number(card.dataset.tweight);
      if (card.dataset.treps !== '') base.reps = Number(card.dataset.treps);
      if (card.dataset.tdist !== '') base.distanceM = Number(card.dataset.tdist);
      if (card.dataset.tsec !== '') base.seconds = Number(card.dataset.tsec);
      btn.disabled = true;
      try { for (let i = 0; i < nSets; i++) appendRow(await logSet(base, i + 1)); }
      catch (err) { toast('Tallennus epäonnistui'); }
      btn.disabled = false;
    }
    markDone(true);
  };

  const tbtn = card.querySelector('[data-timer]');
  if (tbtn) tbtn.onclick = () => {
    let st = [];
    try { st = JSON.parse(card.dataset.stages || '[]'); } catch (e) {}
    openTimer(st, card.dataset.name, async total => {
      if (metric !== 'time') return;
      try { appendRow(await logSet({ seconds: total }, card.querySelectorAll('.set-row').length + 1)); }
      catch (e) { toast('Tallennus epäonnistui'); }
    });
  };

  card.querySelector('[data-add]').onclick = async () => {
    const fields = {};
    card.querySelectorAll('[data-f]').forEach(inp => {
      const f = inp.dataset.f;
      if (f === 'seconds') fields.seconds = parseDuration(inp.value);
      else fields[f] = inp.value === '' ? null : Number(inp.value);
    });
    if (!Object.values(fields).some(v => v != null && !Number.isNaN(v))) { toast('Syötä arvo'); return; }
    try {
      appendRow(await logSet(fields, card.querySelectorAll('.set-row').length + 1));
    } catch (e) { toast('Tallennus epäonnistui'); }
  };

  card.querySelectorAll('.del').forEach(b => {
    const row = b.closest('.set-row');
    b.onclick = () => delSet(row.dataset.set, row, refreshProgress);
  });
}

async function delSet(id, rowEl, cb) {
  await api(`sets/${id}`, { method: 'DELETE' });
  const parent = rowEl.parentElement; rowEl.remove();
  [...parent.querySelectorAll('.set-row')].forEach((r, i) => r.querySelector('.no').textContent = `${i + 1}.`);
  if (cb) cb();
}

// ---------- HISTORIA ----------
async function renderHistory() {
  setHeader('Historia', '', true);
  app.innerHTML = `<div class="loading">Ladataan…</div>`;
  const sessions = await api('sessions');
  if (!sessions.length) { app.innerHTML = `<div class="empty">Ei vielä treenejä.<br>Aloita ensimmäinen!</div>`; return; }
  app.innerHTML = `<div class="card">${sessions.map(s => {
    const dur = s.endedAt ? Math.round((new Date(s.endedAt) - new Date(s.startedAt)) / 60000) : null;
    return `<div class="sess-item" data-sess="${s.id}">
      <div><div class="sess-date">${fmtDate(s.startedAt)} · ${esc(progName(s.program))}</div>
      <div class="sess-meta">${s.exerciseCount} liikettä · ${s.setCount} sarjaa${dur != null ? ` · ${dur} min` : ' · kesken'}</div></div>
      <span class="chev">›</span></div>`;
  }).join('')}</div>`;
  app.querySelectorAll('[data-sess]').forEach(el => el.onclick = () => renderSessionDetail(el.dataset.sess));
}

async function renderSessionDetail(id) {
  setHeader('Treeni', '', true, renderHistory);
  app.innerHTML = `<div class="loading">Ladataan…</div>`;
  const s = await api(`sessions/${id}`);
  const byEx = {};
  for (const set of s.sets) (byEx[set.exerciseId] = byEx[set.exerciseId] || { name: set.exerciseName || 'Liike', metric: set.metric || 'reps', phase: set.phase, sets: [] }).sets.push(set);
  const dur = s.endedAt ? Math.round((new Date(s.endedAt) - new Date(s.startedAt)) / 60000) : null;
  let html = `<div class="card"><div class="sess-date">${fmtDate(s.startedAt)} · ${esc(progName(s.program))}</div>
    <div class="sess-meta">${Object.keys(byEx).length} liikettä · ${s.sets.length} sarjaa${dur != null ? ` · ${dur} min` : ''}</div></div>`;
  const groups = Object.values(byEx).sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase));
  for (const g of groups) {
    html += `<div class="card"><div class="ex-name">${esc(g.name)}</div>
      <div class="sets">${g.sets.map((x, i) => `<div class="set-row"><span class="no">${i + 1}.</span><span class="val">${setFull(g.metric, x)}</span></div>`).join('')}</div></div>`;
  }
  html += `<button class="btn danger" id="del-sess">Poista tämä treeni</button><div style="height:16px"></div>`;
  app.innerHTML = html;
  $('del-sess').onclick = async () => {
    if (!confirm('Poistetaanko koko treeni?')) return;
    await api(`sessions/${id}`, { method: 'DELETE' }); toast('Poistettu'); renderHistory();
  };
}

// ---------- OHJELMAN MUOKKAUS ----------
async function renderProgram(programId) {
  setHeader('Liikkeet', progName(programId), true);
  app.innerHTML = `<div class="loading">Ladataan…</div>`;
  const data = await api(`program?program=${programId}`);
  const exercises = data.exercises;
  let html = '';
  for (const phase of PHASE_ORDER) {
    const list = exercises.filter(e => e.phase === phase);
    if (!list.length) continue;
    const pm = PHASE_META[phase];
    html += `<div class="phase-head" style="--pc:${pm.color}">${icon(pm.icon)}${pm.label}</div><div class="card">`;
    list.forEach((ex, i) => {
      html += `<div class="edit-ex" data-ex="${ex.id}">
        <div style="display:flex;flex-direction:column">
          <button class="mv" data-up ${i === 0 ? 'disabled' : ''}>▲</button>
          <button class="mv" data-down ${i === list.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
        <div class="nm">${esc(ex.name)}<div class="metric-tag">${METRIC_LABEL[ex.metric]}${prescription(ex) ? ' · ' + esc(prescription(ex)) : ''}${ex.rotate ? ' · <span class="rot-tag">↻ kierto</span>' : ''}</div></div>
        <button class="ed" data-edit>Muokkaa</button>
      </div>`;
    });
    html += `</div>`;
  }
  html += `<button class="btn secondary" id="add-ex">+ Lisää liike</button><div style="height:20px"></div>`;
  app.innerHTML = html;

  $('add-ex').onclick = () => openExerciseForm(null, programId, exercises);
  app.querySelectorAll('.edit-ex').forEach(row => {
    const id = row.dataset.ex;
    row.querySelector('[data-edit]').onclick = () => openExerciseForm(exercises.find(e => e.id === id), programId, exercises);
    const up = row.querySelector('[data-up]'), down = row.querySelector('[data-down]');
    if (up && !up.disabled) up.onclick = () => moveExercise(id, -1, exercises, programId);
    if (down && !down.disabled) down.onclick = () => moveExercise(id, 1, exercises, programId);
  });
}

async function moveExercise(id, dir, exercises, programId) {
  const ex = exercises.find(e => e.id === id);
  const list = exercises.filter(e => e.phase === ex.phase);
  const idx = list.findIndex(e => e.id === id);
  if (idx + dir < 0 || idx + dir >= list.length) return;
  [list[idx], list[idx + dir]] = [list[idx + dir], list[idx]];
  await api('exercises/reorder', { method: 'POST', body: JSON.stringify({ order: list.map(e => e.id) }) });
  renderProgram(programId);
}

function openExerciseForm(ex, programId, exercises) {
  const isNew = !ex;
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  const opt = (val, cur, label) => `<option value="${val}" ${cur === val ? 'selected' : ''}>${label}</option>`;
  sheet.innerHTML = `<div class="sheet-card">
    <div class="sheet-title">${isNew ? 'Uusi liike' : 'Muokkaa liikettä'}</div>
    <label class="f-label">Nimi</label>
    <input class="f-input" id="ef-name" value="${esc(ex ? ex.name : '')}">
    <label class="f-label">Ohjelma</label>
    <select class="f-select" id="ef-program">${programsList.map(p => opt(p.id, ex ? ex.program : programId, p.name)).join('')}</select>
    <label class="f-label">Vaihe</label>
    <select class="f-select" id="ef-phase">${PHASE_ORDER.map(p => opt(p, ex ? ex.phase : 'strength', PHASE_META[p].label)).join('')}</select>
    <label class="f-label">Mittari</label>
    <select class="f-select" id="ef-metric">${Object.keys(METRIC_LABEL).map(m => opt(m, ex ? ex.metric : 'weight_reps', METRIC_LABEL[m])).join('')}</select>
    <label class="check-row"><input type="checkbox" id="ef-rotate" ${ex && ex.rotate ? 'checked' : ''}>
      <span>Kiertävä liike – ei joka treenissä, vaan vuorotellen muiden kiertävien kanssa</span></label>
    <div class="row">
      <div style="flex:0 0 90px"><label class="f-label">Sarjat</label><input class="f-input" id="ef-sets" type="number" inputmode="numeric" value="${ex && ex.sets != null ? ex.sets : ''}"></div>
      <div style="flex:1"><label class="f-label">Tavoite (esim. 6–8, 20 m, 45 s)</label><input class="f-input" id="ef-reps" value="${esc(ex ? ex.targetReps : '')}"></div>
    </div>
    <label class="f-label">Painosuositus kg (valinnainen)</label>
    <input class="f-input" id="ef-weight" type="number" inputmode="decimal" step="0.5" value="${ex && ex.targetWeight != null ? ex.targetWeight : ''}">
    <label class="f-label">Ajastin (valinnainen, esim. "Kylkilankku 30, Keskilankku 60")</label>
    <input class="f-input" id="ef-timer" value="${esc(ex ? ex.timerStages : '')}">
    <label class="check-row"><input type="checkbox" id="ef-timerprog" ${ex && ex.timerProgress ? 'checked' : ''}>
      <span>Nouseva ajastin – vaiheet +5 s aina kun edellinen on tehty (max 2× perusaika)</span></label>
    <label class="f-label">Ohje / vinkki</label>
    <textarea class="f-input" id="ef-cue">${esc(ex ? ex.cue : '')}</textarea>
    <div class="row" style="margin-top:16px">
      <button class="btn ghost" id="ef-cancel">Peruuta</button>
      <button class="btn" id="ef-save">Tallenna</button>
    </div>
    ${isNew ? '' : `<button class="btn danger" id="ef-del" style="margin-top:10px">Poista liike</button>`}
  </div>`;
  document.body.appendChild(sheet);
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
  sheet.querySelector('#ef-cancel').onclick = () => sheet.remove();
  sheet.querySelector('#ef-save').onclick = async () => {
    const g = id => sheet.querySelector(id);
    const body = {
      name: g('#ef-name').value.trim(), program: g('#ef-program').value,
      phase: g('#ef-phase').value, metric: g('#ef-metric').value,
      sets: g('#ef-sets').value === '' ? null : Number(g('#ef-sets').value),
      targetReps: g('#ef-reps').value.trim(),
      targetWeight: g('#ef-weight').value === '' ? null : Number(g('#ef-weight').value),
      cue: g('#ef-cue').value.trim(),
      rotate: g('#ef-rotate').checked,
      timerStages: g('#ef-timer').value.trim(),
      timerProgress: g('#ef-timerprog').checked,
    };
    if (!body.name) { toast('Anna nimi'); return; }
    if (isNew) await api('exercises', { method: 'POST', body: JSON.stringify(body) });
    else await api(`exercises/${ex.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    sheet.remove(); toast('Tallennettu'); renderProgram(g('#ef-program') ? body.program : programId);
  };
  if (!isNew) sheet.querySelector('#ef-del').onclick = async () => {
    if (!confirm('Poistetaanko liike ohjelmasta? (historia säilyy)')) return;
    await api(`exercises/${ex.id}`, { method: 'DELETE' }); sheet.remove(); toast('Poistettu'); renderProgram(programId);
  };
}

// ---------- käynnistys ----------
async function init() {
  try {
    const [progs, prog] = await Promise.all([api('programs'), api('program')]);
    programsList = progs; meta = prog.meta || {};
  } catch (e) { app.innerHTML = `<div class="empty">Yhteysvirhe. Päivitä sivu.</div>`; return; }
  renderHome();
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
init();

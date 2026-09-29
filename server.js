// Treeni-tracker – backend
// Cloud Run + Firestore. Kaikki reitit salaisen polun takana (kuten Pablo-päiväkirja).

const express = require('express');
const path = require('path');
const { Firestore } = require('@google-cloud/firestore');

const TOKEN = process.env.APP_TOKEN || 'dev-token';
const PORT = process.env.PORT || 8080;

const db = new Firestore();
const exercisesCol = db.collection('treeni_exercises');
const sessionsCol = db.collection('treeni_sessions');
const setsCol = db.collection('treeni_sets');
const metaCol = db.collection('treeni_meta');

const app = express();
app.use(express.json());

// ---------- vakiot ----------
const PROGRAMS = [
  { id: 'leg',   name: 'Jalkatreeni (fysio)', emoji: '🦵', desc: 'Lämmittely → aktivoinnit → räjähtävät → voima → keskivartalo → jäähdyttely' },
  { id: 'upper', name: 'Yläkroppa',           emoji: '💪', desc: 'Yläkropan voimaliikkeet' },
  { id: 'core',  name: 'Keskivartalo 10 min', emoji: '🔥', desc: 'Nopea keskivartaloputki' },
];
const PROGRAM_IDS = PROGRAMS.map(p => p.id);
const PHASES = ['warmup', 'activating', 'explosive', 'strength', 'core', 'cooldown'];
const METRICS = ['weight_reps', 'reps', 'distance', 'time'];
// Kiertävistä liikkeistä (rotate: true) otetaan joka treeniin mukaan näin monta per vaihe,
// aina se jota on tehty vähiten viimeksi.
const ROTATION_PER_PHASE = 1;

// Ohjelmaliike: program, phase, name, metric + resepti (sets, targetReps-teksti, targetWeight kg).
// targetReps on vapaa teksti joka pitää sisällään yksikön kun tarpeen ("6–8", "20 m", "45 s", "5 min").
const S = (program, phase, name, metric, sets, targetReps, extra = {}) =>
  ({ program, phase, name, metric, sets: sets || null, targetReps: targetReps || '', targetWeight: null, cue: '', ...extra });

const DEFAULT_PROGRAM = [
  // ===== JALKATREENI (fysio) =====
  S('leg', 'warmup', 'Yleislämmittely', 'time', null, '5 min', { cue: 'Kevyt lämmittely, esim. kuntopyörä tai hölkkä.' }),

  S('leg', 'activating', 'Lonkankoukistaja-aktivointi', 'reps', 2, '10–12', {
    rotate: true,
    cue: 'Tapa 1: toinen jalka kiinni puolissa lankulla, kaatuu ns. taaksepäin – muista tuoda toista polvea mukana, lonkkakulma se joka muuttuu. Tapa 2: seiso korkealla, tuo kahvakuula tms. ylöspäin, muista lantion hallinta.' }),
  S('leg', 'activating', 'Nilkan ulko-/sisäkierto', 'reps', 2, '15'),
  S('leg', 'activating', 'Hiippailykävely painoilla', 'distance', 4, '20 m', { cue: 'Painot molemmissa käsissä, sitten päkiöillä. Polvet suorana ja koukussa.' }),
  S('leg', 'activating', 'Tähtilankku / kylkilankku jalannostolla', 'time', 3, '30 s', { cue: 'Jalka nousee myös, nilkasta.' }),
  S('leg', 'activating', 'Lonkanloitontajat', 'reps', 3, '12–15', { rotate: true, cue: 'Loitonna jalkaa hallitusti (kuminauha tai talja).' }),

  S('leg', 'explosive', 'Yuri band pull → yhden jalan draivaus ylös', 'reps', 2, '10', { cue: 'Vahva ankkuri/kumppari tolppien väliin, siitä yhden jalan draivaus ylös.' }),
  S('leg', 'explosive', 'Kuminauha sivueteneminen, räjähtävä ponnistus', 'distance', 2, '10 m', { cue: 'Ponnista räjähtävästi taakse jäävällä jalalla. Molemmille jaloille.' }),
  S('leg', 'explosive', 'Boksihypyt', 'reps', 3, '5', { rotate: true }),
  S('leg', 'explosive', 'Pogot', 'reps', 3, '10'),
  S('leg', 'explosive', 'Yhden jalan ristikyykky + räjähtävä polvi ylös', 'reps', 3, '5', { rotate: true }),
  S('leg', 'explosive', 'Downstep, jarrutus', 'reps', 3, '5', { rotate: true, cue: 'Joutuu jarruttamaan räjähtävään osaan.' }),

  S('leg', 'strength', 'Lonkankoukistaja taljalla', 'weight_reps', 3, '10–12', { targetWeight: 15, cue: 'Nojaa korkeaan penkkiin/lankkuun, vedä jalkaa.' }),
  S('leg', 'strength', 'Kyykyt', 'weight_reps', 3, '6–8', { targetWeight: 40 }),
  S('leg', 'strength', 'Hip thrust', 'weight_reps', 3, '8–10', { targetWeight: 50 }),
  S('leg', 'strength', 'Takareisi jumppapallolla', 'reps', 3, '8–10', { cue: 'Jarruttava yhdellä jalalla.' }),

  S('leg', 'core', 'Lankkusarja', 'time', 2, '2 min', {
    cue: 'Putkeen ilman taukoja: kylkilankku 30 s → keskilankku 1 min → copenhagen-kylkilankku 30 s. Toinen kierros toisella puolella.',
    timerStages: 'Kylkilankku 30, Keskilankku 60, Copenhagen-kylkilankku 30', timerProgress: true }),
  S('leg', 'core', 'Dead bug', 'time', 2, '1 min', { cue: 'Alaselkä kiinni lattiassa koko liikkeen ajan.', timerStages: 'Dead bug 60' }),
  S('leg', 'core', 'Käsilläseisontaharjoittelu', 'time', null, '', { cue: 'Seinää vasten tai vapaana, pidot 20–60 s. Yhteensä n. 5 min.' }),

  S('leg', 'cooldown', 'Venyttely', 'time', null, '5 min', { cue: 'Lonkankoukistajat, takareidet, pakarat.' }),

  // ===== YLÄKROPPA =====
  S('upper', 'warmup', 'Lämmittely (hartiat/olkapäät)', 'time', null, '3 min'),
  S('upper', 'strength', 'Penkkipunnerrus', 'weight_reps', 3, '8–10', { targetWeight: 25 }),
  S('upper', 'strength', 'Ylätalja tai leuanveto', 'weight_reps', 3, '8–10', { targetWeight: 30 }),
  S('upper', 'strength', 'Pystypunnerrus', 'weight_reps', 3, '8–10', { targetWeight: 15 }),
  S('upper', 'strength', 'Kulmasoutu', 'weight_reps', 3, '10', { targetWeight: 25 }),
  S('upper', 'strength', 'Olkapään sivunostot', 'weight_reps', 3, '12–15', { targetWeight: 5 }),
  S('upper', 'strength', 'Hauiskääntö', 'weight_reps', 3, '10–12', { targetWeight: 8 }),
  S('upper', 'strength', 'Ojentajapunnerrus taljassa', 'weight_reps', 3, '10–12', { targetWeight: 15 }),

  // ===== KESKIVARTALO 10 min =====
  S('core', 'core', 'Lankku', 'time', 3, '45 s'),
  S('core', 'core', 'Kylkilankku (per puoli)', 'time', 2, '30 s'),
  S('core', 'core', 'Dead bug', 'reps', 3, '10'),
  S('core', 'core', 'Vatsarutistus', 'reps', 3, '15'),
  S('core', 'core', 'Selkäojennus (superman)', 'reps', 3, '12'),
  S('core', 'core', 'Vuorikiipeilijä', 'time', 3, '30 s'),
];

// ---------- apurit ----------
function todayStr(now = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
function phaseIndex(p) { const i = PHASES.indexOf(p); return i === -1 ? PHASES.length : i; }

function cleanExercise(body) {
  const out = {};
  const num = v => (v === undefined || v === null || v === '') ? null : Number(v);
  if (typeof body.name === 'string') out.name = body.name.trim().slice(0, 120);
  if (PROGRAM_IDS.includes(body.program)) out.program = body.program;
  if (PHASES.includes(body.phase)) out.phase = body.phase;
  if (METRICS.includes(body.metric)) out.metric = body.metric;
  if (typeof body.cue === 'string') out.cue = body.cue.trim().slice(0, 800);
  if (typeof body.targetReps === 'string') out.targetReps = body.targetReps.trim().slice(0, 24);
  if ('sets' in body) out.sets = num(body.sets);
  if ('targetWeight' in body) out.targetWeight = num(body.targetWeight);
  if (typeof body.order === 'number') out.order = body.order;
  if (typeof body.active === 'boolean') out.active = body.active;
  if (typeof body.rotate === 'boolean') out.rotate = body.rotate;
  if (typeof body.timerStages === 'string') out.timerStages = body.timerStages.trim().slice(0, 300);
  if (typeof body.timerProgress === 'boolean') out.timerProgress = body.timerProgress;
  return out;
}

async function seedIfEmpty() {
  const snap = await exercisesCol.limit(1).get();
  if (!snap.empty) return;
  const batch = db.batch();
  DEFAULT_PROGRAM.forEach((ex, i) => batch.set(exercisesCol.doc(), { ...ex, order: i, active: true, createdAt: new Date() }));
  batch.set(metaCol.doc('program'), { note: 'Pari kertaa viikossa', updatedAt: new Date() }, { merge: true });
  await batch.commit();
  console.log('Kylvettiin oletusohjelmat:', DEFAULT_PROGRAM.length, 'liikettä');
}

// exerciseId -> viimeisin sessio jossa liike esiintyy (yksi kysely, ryhmittely muistissa)
async function lastByExercise(excludeSessionId = null) {
  const snap = await setsCol.orderBy('sessionDate', 'desc').limit(1200).get();
  const byEx = {};
  for (const d of snap.docs) {
    const s = d.data();
    if (excludeSessionId && s.sessionId === excludeSessionId) continue;
    const cur = byEx[s.exerciseId];
    if (!cur) byEx[s.exerciseId] = { sessionId: s.sessionId, sessionDate: s.sessionDate, sets: [s] };
    else if (s.sessionId === cur.sessionId) cur.sets.push(s);
  }
  for (const k of Object.keys(byEx)) byEx[k].sets.sort((a, b) => (a.setNo || 0) - (b.setNo || 0));
  return byEx;
}

// ---------- API salaisen polun takana ----------
const r = express.Router();

r.get('/api/config', (req, res) => res.json({ name: 'Treeni', programs: PROGRAMS, phases: PHASES, metrics: METRICS }));

r.get('/api/programs', async (req, res) => {
  await seedIfEmpty();
  const snap = await exercisesCol.get();
  const counts = {};
  snap.docs.forEach(d => { const e = d.data(); if (e.active !== false) counts[e.program] = (counts[e.program] || 0) + 1; });
  res.json(PROGRAMS.map(p => ({ ...p, exerciseCount: counts[p.id] || 0 })));
});

r.get('/api/program', async (req, res) => {
  await seedIfEmpty();
  const prog = PROGRAM_IDS.includes(req.query.program) ? req.query.program : null;
  const [snap, metaDoc] = await Promise.all([exercisesCol.get(), metaCol.doc('program').get()]);
  let exercises = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.active !== false);
  if (prog) exercises = exercises.filter(e => e.program === prog);
  exercises.sort((a, b) => phaseIndex(a.phase) - phaseIndex(b.phase) || (a.order || 0) - (b.order || 0));
  if (req.query.withLast === '1') {
    const last = await lastByExercise(req.query.exclude || null);
    exercises = exercises.map(e => ({ ...e, last: last[e.id] || null }));
  }
  res.json({ exercises, meta: metaDoc.exists ? metaDoc.data() : {} });
});

r.post('/api/exercises', async (req, res) => {
  const ex = cleanExercise(req.body || {});
  if (!ex.name || !ex.program || !ex.phase || !ex.metric) return res.status(400).json({ error: 'name, program, phase, metric vaaditaan' });
  if (ex.order === undefined) ex.order = Date.now() % 100000;
  ex.active = true; ex.createdAt = new Date();
  const ref = await exercisesCol.add(ex);
  res.json({ id: ref.id, ...ex });
});

r.patch('/api/exercises/:id', async (req, res) => {
  const patch = cleanExercise(req.body || {}); patch.updatedAt = new Date();
  await exercisesCol.doc(req.params.id).set(patch, { merge: true });
  res.json({ ok: true });
});

r.delete('/api/exercises/:id', async (req, res) => {
  await exercisesCol.doc(req.params.id).set({ active: false, updatedAt: new Date() }, { merge: true });
  res.json({ ok: true });
});

r.post('/api/exercises/reorder', async (req, res) => {
  const order = Array.isArray(req.body && req.body.order) ? req.body.order : [];
  const batch = db.batch();
  order.forEach((id, i) => batch.set(exercisesCol.doc(id), { order: i }, { merge: true }));
  await batch.commit();
  res.json({ ok: true });
});

r.patch('/api/program-meta', async (req, res) => {
  const note = typeof (req.body && req.body.note) === 'string' ? req.body.note.slice(0, 300) : '';
  await metaCol.doc('program').set({ note, updatedAt: new Date() }, { merge: true });
  res.json({ ok: true });
});

// Istunnot
r.post('/api/sessions', async (req, res) => {
  const now = new Date();
  const program = PROGRAM_IDS.includes(req.body && req.body.program) ? req.body.program : 'leg';
  const doc = { program, startedAt: now, sessionDate: todayStr(now), endedAt: null, note: '' };
  // Valitaan kiertoliikkeet: per vaihe mukaan ROTATION_PER_PHASE kpl, vähiten viimeksi tehty ensin.
  const snap = await exercisesCol.get();
  const rot = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(e => e.active !== false && e.program === program && e.rotate === true);
  if (rot.length) {
    const last = await lastByExercise();
    const chosen = [];
    for (const phase of PHASES) {
      const pool = rot.filter(e => e.phase === phase);
      if (!pool.length) continue;
      pool.sort((a, b) =>
        ((last[a.id] || {}).sessionDate || '').localeCompare((last[b.id] || {}).sessionDate || '') ||
        (a.order || 0) - (b.order || 0));
      chosen.push(...pool.slice(0, ROTATION_PER_PHASE).map(e => e.id));
    }
    doc.rotationExerciseIds = chosen;
  }
  const ref = await sessionsCol.add(doc);
  res.json({ id: ref.id, ...doc, startedAt: now.toISOString() });
});

r.patch('/api/sessions/:id', async (req, res) => {
  const patch = {};
  if (req.body && req.body.finish) patch.endedAt = new Date();
  if (req.body && typeof req.body.note === 'string') patch.note = req.body.note.slice(0, 500);
  await sessionsCol.doc(req.params.id).set(patch, { merge: true });
  res.json({ ok: true });
});

r.delete('/api/sessions/:id', async (req, res) => {
  const id = req.params.id;
  const setsSnap = await setsCol.where('sessionId', '==', id).get();
  const batch = db.batch();
  setsSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(sessionsCol.doc(id));
  await batch.commit();
  res.json({ ok: true });
});

r.get('/api/sessions', async (req, res) => {
  const snap = await sessionsCol.orderBy('startedAt', 'desc').limit(60).get();
  const out = [];
  for (const d of snap.docs) {
    const s = d.data();
    const setsSnap = await setsCol.where('sessionId', '==', d.id).get();
    const sets = setsSnap.docs.map(x => x.data());
    out.push({
      id: d.id, program: s.program || 'leg',
      startedAt: s.startedAt.toDate().toISOString(),
      endedAt: s.endedAt ? s.endedAt.toDate().toISOString() : null,
      sessionDate: s.sessionDate, note: s.note || '',
      setCount: sets.length, exerciseCount: new Set(sets.map(x => x.exerciseId)).size,
    });
  }
  res.json(out);
});

r.get('/api/sessions/:id', async (req, res) => {
  const doc = await sessionsCol.doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'not found' });
  const s = doc.data();
  const setsSnap = await setsCol.where('sessionId', '==', req.params.id).get();
  const sets = setsSnap.docs.map(d => ({ id: d.id, ...d.data(), at: d.data().at.toDate().toISOString() }));
  sets.sort((a, b) => (a.setNo || 0) - (b.setNo || 0));
  res.json({
    id: doc.id, program: s.program || 'leg',
    startedAt: s.startedAt.toDate().toISOString(),
    endedAt: s.endedAt ? s.endedAt.toDate().toISOString() : null,
    sessionDate: s.sessionDate, note: s.note || '',
    rotationExerciseIds: s.rotationExerciseIds || null, sets,
  });
});

// Sarjat
r.post('/api/sets', async (req, res) => {
  const b = req.body || {};
  if (!b.sessionId || !b.exerciseId) return res.status(400).json({ error: 'sessionId ja exerciseId vaaditaan' });
  const sess = await sessionsCol.doc(b.sessionId).get();
  if (!sess.exists) return res.status(400).json({ error: 'tuntematon sessio' });
  const num = x => (x === undefined || x === null || x === '') ? null : Number(x);
  const doc = {
    sessionId: b.sessionId, exerciseId: b.exerciseId,
    exerciseName: typeof b.exerciseName === 'string' ? b.exerciseName.slice(0, 120) : '',
    metric: METRICS.includes(b.metric) ? b.metric : 'reps',
    phase: PHASES.includes(b.phase) ? b.phase : null,
    sessionDate: sess.data().sessionDate,
    setNo: Number(b.setNo) || 1,
    weightKg: num(b.weightKg), reps: num(b.reps), distanceM: num(b.distanceM), seconds: num(b.seconds),
    note: typeof b.note === 'string' ? b.note.slice(0, 200) : '',
    at: new Date(),
  };
  const ref = await setsCol.add(doc);
  res.json({ id: ref.id, ...doc, at: doc.at.toISOString() });
});

r.delete('/api/sets/:id', async (req, res) => { await setsCol.doc(req.params.id).delete(); res.json({ ok: true }); });

r.get('/api/sets', async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'sessionId vaaditaan' });
  const snap = await setsCol.where('sessionId', '==', sessionId).get();
  const sets = snap.docs.map(d => ({ id: d.id, ...d.data(), at: d.data().at.toDate().toISOString() }));
  sets.sort((a, b) => (a.setNo || 0) - (b.setNo || 0));
  res.json(sets);
});

// Staattiset tiedostot
r.use(express.static(path.join(__dirname, 'public')));

app.use(`/${TOKEN}`, r);
app.get('/', (req, res) => res.status(404).send('404'));
app.get('/healthz', (req, res) => res.send('ok'));

app.listen(PORT, () => console.log(`Treeni-tracker portissa ${PORT}, polku /${TOKEN}/`));

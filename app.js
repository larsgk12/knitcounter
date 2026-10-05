'use strict';

// ---------- Lagring ----------
const STORAGE_KEY = 'strikketeller.v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.projects)) return s;
    }
  } catch (e) { /* tom eller ødelagt lagring: start på nytt */ }
  return { projects: [], currentId: null, keepAwake: false };
}

let state = loadState();

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Klarte ikke å lagre'); }
}

function current() {
  return state.projects.find(p => p.id === state.currentId) || null;
}

function touch(p) {
  p.updatedAt = Date.now();
  save();
}

function defaultName() {
  const names = new Set(state.projects.map(p => p.name));
  let n = state.projects.length + 1;
  while (names.has('Prosjekt ' + n)) n++;
  return 'Prosjekt ' + n;
}

function parsePerRow(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function createProject(name, perRow) {
  const p = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: (name || '').trim() || defaultName(),
    rows: 0,
    stitches: 0,
    stitchesPerRow: parsePerRow(perRow),
    notes: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  state.projects.push(p);
  return p;
}

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const viewList = $('view-list');
const viewCounter = $('view-counter');

function showView(name) {
  viewList.hidden = name !== 'list';
  viewCounter.hidden = name !== 'counter';
  updateWakeLock();
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

function bump(el) {
  el.classList.remove('bump');
  void el.offsetWidth; // start animasjonen på nytt
  el.classList.add('bump');
}

// ---------- Prosjektliste ----------
function renderList() {
  const list = $('project-list');
  list.innerHTML = '';
  const projects = [...state.projects].sort((a, b) => b.updatedAt - a.updatedAt);
  $('empty-hint').hidden = projects.length > 0;

  for (const p of projects) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'project-item';

    const name = document.createElement('span');
    name.className = 'pi-name';
    name.textContent = p.name;

    const meta = document.createElement('span');
    meta.className = 'pi-meta';
    meta.textContent = `Rad ${p.rows} · ${p.stitches}${p.stitchesPerRow ? '/' + p.stitchesPerRow : ''} m`;

    btn.append(name, meta);
    btn.addEventListener('click', () => openProject(p.id));
    li.append(btn);
    list.append(li);
  }
}

function openProject(id) {
  state.currentId = id;
  save();
  renderCounter();
  showView('counter');
}

$('btn-new').addEventListener('click', () => {
  $('in-new-name').value = '';
  $('in-new-name').placeholder = defaultName();
  $('in-new-per-row').value = '';
  $('dlg-new').showModal();
});

$('form-new').addEventListener('submit', e => {
  if (!e.submitter || e.submitter.value !== 'create') return;
  const p = createProject($('in-new-name').value, $('in-new-per-row').value);
  save();
  renderList();
  openProject(p.id);
});

// ---------- Teller ----------
function renderCounter() {
  const p = current();
  if (!p) return;
  $('project-title').textContent = p.name;
  $('rows-value').textContent = p.rows;
  $('stitches-value').textContent = p.stitches;

  const prog = $('stitch-progress');
  if (p.stitchesPerRow) {
    $('stitches-extra').textContent = `av ${p.stitchesPerRow} per rad`;
    prog.hidden = false;
    $('stitch-progress-bar').style.width = Math.min(100, (p.stitches / p.stitchesPerRow) * 100) + '%';
  } else {
    $('stitches-extra').textContent = 'manuell rad';
    prog.hidden = true;
  }
}

function addRow(delta) {
  const p = current();
  if (!p) return;
  p.rows = Math.max(0, p.rows + delta);
  touch(p);
  renderCounter();
  bump($('rows-value'));
}

function addStitch(delta) {
  const p = current();
  if (!p) return;
  p.stitches = Math.max(0, p.stitches + delta);

  if (delta > 0 && p.stitchesPerRow && p.stitches >= p.stitchesPerRow) {
    p.stitches = 0;
    p.rows += 1;
    vibrate([60, 60, 60]);
    toast(`Ny rad! Du er på rad ${p.rows}`);
    bump($('rows-value'));
  }
  touch(p);
  renderCounter();
  bump($('stitches-value'));
}

$('btn-row-plus').addEventListener('click', () => { vibrate(25); addRow(1); });
$('btn-row-minus').addEventListener('click', () => addRow(-1));
$('btn-stitch-plus').addEventListener('click', () => { vibrate(15); addStitch(1); });
$('btn-stitch-minus').addEventListener('click', () => addStitch(-1));

$('btn-row-reset').addEventListener('click', () => {
  const p = current();
  if (p && confirm('Nullstille radtelleren?')) {
    p.rows = 0;
    touch(p);
    renderCounter();
  }
});

$('btn-stitch-reset').addEventListener('click', () => {
  const p = current();
  if (p && confirm('Nullstille masketelleren?')) {
    p.stitches = 0;
    touch(p);
    renderCounter();
  }
});

$('btn-back').addEventListener('click', () => {
  state.currentId = null;
  save();
  renderList();
  showView('list');
});

// ---------- Innstillinger ----------
$('btn-settings').addEventListener('click', () => {
  const p = current();
  if (!p) return;
  $('in-name').value = p.name;
  $('in-per-row').value = p.stitchesPerRow || '';
  $('in-notes').value = p.notes || '';
  $('dlg-settings').showModal();
});

$('form-settings').addEventListener('submit', e => {
  if (!e.submitter || e.submitter.value !== 'save') return;
  const p = current();
  if (!p) return;
  p.name = $('in-name').value.trim() || p.name;
  p.stitchesPerRow = parsePerRow($('in-per-row').value);
  p.notes = $('in-notes').value;
  touch(p);
  renderCounter();
});

$('btn-delete').addEventListener('click', () => {
  const p = current();
  if (!p || !confirm(`Slette «${p.name}»? Dette kan ikke angres.`)) return;
  state.projects = state.projects.filter(x => x.id !== p.id);
  state.currentId = null;
  save();
  $('dlg-settings').close('deleted');
  renderList();
  showView('list');
});

// ---------- Skjermen alltid på (Screen Wake Lock API) ----------
let wakeLock = null;

async function updateWakeLock() {
  const want = state.keepAwake && !viewCounter.hidden && document.visibilityState === 'visible';
  renderWakeButton();

  if (!want) {
    if (wakeLock) { try { await wakeLock.release(); } catch (e) {} wakeLock = null; }
    return;
  }
  if (wakeLock || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) {
    wakeLock = null;
    toast('Fikk ikke holdt skjermen på (f.eks. pga. strømsparing)');
  }
}

function renderWakeButton() {
  const on = state.keepAwake;
  $('btn-wake').setAttribute('aria-pressed', String(on));
  $('wake-label').textContent = on ? 'Skjermen holdes på' : 'Skjermen kan slukke';
}

$('btn-wake').addEventListener('click', () => {
  if (!('wakeLock' in navigator)) {
    toast('Nettleseren din støtter ikke dette. Prøv Chrome eller Safari.');
    return;
  }
  state.keepAwake = !state.keepAwake;
  save();
  toast(state.keepAwake ? 'Skjermen holdes på' : 'Skjermen kan slukke igjen');
  updateWakeLock();
});

// Nettleseren slipper låsen når appen skjules; hent den tilbake når du kommer tilbake.
document.addEventListener('visibilitychange', updateWakeLock);

// ---------- Oppstart ----------
renderList();
if (current()) {
  renderCounter();
  showView('counter');
} else {
  showView('list');
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

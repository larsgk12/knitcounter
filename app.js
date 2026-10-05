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
  const el = name === 'list' ? viewList : viewCounter;
  const wasHidden = el.hidden;
  viewList.hidden = name !== 'list';
  viewCounter.hidden = name !== 'counter';
  if (wasHidden && booted) {
    el.classList.remove('slide-forward', 'slide-back');
    void el.offsetWidth;
    el.classList.add(name === 'counter' ? 'slide-forward' : 'slide-back');
  }
  window.scrollTo(0, 0);
  updateWakeLock();
}
let booted = false;

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
    meta.textContent = `Øk/fell ${p.rows} · Omg ${p.stitches}${p.stitchesPerRow ? '/' + p.stitchesPerRow : ''}`;

    btn.append(name, meta);
    btn.addEventListener('click', () => openProject(p.id));
    li.append(btn);
    list.append(li);
  }
}

// Prosjektet legges i nettleserhistorikken, så tilbakeknappen på Android
// (og sveip tilbake på iPhone) går til prosjektlisten i stedet for å lukke appen.
function openProject(id) {
  state.currentId = id;
  save();
  renderCounter();
  if (!history.state || history.state.view !== 'counter') {
    history.pushState({ view: 'counter' }, '');
  }
  showView('counter');
}

function closeProject() {
  state.currentId = null;
  save();
  renderList();
  showView('list');
}

window.addEventListener('popstate', e => {
  if (e.state && e.state.view === 'counter' && current()) {
    renderCounter();
    showView('counter');
  } else if (!viewCounter.hidden) {
    closeProject();
  }
});

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
    $('stitches-extra').textContent = `av ${p.stitchesPerRow} før økning/felling`;
    prog.hidden = false;
    $('stitch-progress-bar').style.width = Math.min(100, (p.stitches / p.stitchesPerRow) * 100) + '%';
  } else {
    $('stitches-extra').textContent = 'manuell';
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
    toast(`Tid for økning/felling! (nr. ${p.rows})`);
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

// Bekreft med to trykk i stedet for confirm(), som enkelte mobilnettlesere og
// installerte apper blokkerer stille.
function confirmTap(btn, action) {
  const label = btn.textContent;
  let timer = null;
  btn.addEventListener('click', () => {
    if (!btn.classList.contains('confirming')) {
      btn.classList.add('confirming');
      btn.textContent = 'Trykk igjen';
      vibrate(10);
      timer = setTimeout(reset, 3000);
      return;
    }
    reset();
    action();
  });
  function reset() {
    clearTimeout(timer);
    btn.classList.remove('confirming');
    btn.textContent = label;
  }
}

confirmTap($('btn-row-reset'), () => {
  const p = current();
  if (!p) return;
  p.rows = 0;
  touch(p);
  renderCounter();
  toast('Økning/felling er nullstilt');
});

confirmTap($('btn-stitch-reset'), () => {
  const p = current();
  if (!p) return;
  p.stitches = 0;
  touch(p);
  renderCounter();
  toast('Omgangstelleren er nullstilt');
});

$('btn-back').addEventListener('click', () => {
  if (history.state && history.state.view === 'counter') history.back();
  else closeProject();
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

confirmTap($('btn-delete'), () => {
  const p = current();
  if (!p) return;
  state.projects = state.projects.filter(x => x.id !== p.id);
  $('dlg-settings').close('deleted');
  if (history.state && history.state.view === 'counter') history.back();
  else closeProject();
  toast(`«${p.name}» er slettet`);
});

// ---------- Skjermen alltid på (Screen Wake Lock API) ----------
let wakeLock = null;

async function updateWakeLock(fromUser = false) {
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
    if (fromUser) toast('Fikk ikke holdt skjermen på (f.eks. pga. strømsparing)');
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
  updateWakeLock(true);
});

// Nettleseren slipper låsen når appen skjules; hent den tilbake når du kommer tilbake.
document.addEventListener('visibilitychange', () => updateWakeLock());

// ---------- Installer som app ----------
const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEvent = null;

function showInstallBanner(text) {
  if (isStandalone() || state.installDismissed) return;
  $('install-text').innerHTML = text;
  $('install-banner').hidden = false;
}

// Android/Chrome/Edge: nettleseren lar oss vise vår egen installer-knapp.
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvent = e;
  $('btn-install').hidden = false;
  showInstallBanner('Installer Strikketeller, så åpnes den som en vanlig app fra hjemskjermen.');
});

$('btn-install').addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $('btn-install').hidden = true;
  $('install-banner').hidden = true;
});

window.addEventListener('appinstalled', () => {
  $('btn-install').hidden = true;
  $('install-banner').hidden = true;
  toast('Strikketeller er installert');
});

$('btn-install-close').addEventListener('click', () => {
  $('install-banner').hidden = true;
  state.installDismissed = true;
  save();
});

// iPhone/iPad har ingen installer-knapp, så vi forklarer hvordan.
if (isIos && !isStandalone()) {
  showInstallBanner('Legg appen på hjemskjermen: trykk <b>Del</b> <span aria-hidden="true">⎙</span> og velg <b>Legg til på Hjem-skjerm</b>.');
}

// ---------- Oppstart ----------
renderList();
history.replaceState({ view: 'list' }, '');
if (current()) {
  renderCounter();
  history.pushState({ view: 'counter' }, '');
  showView('counter');
} else {
  showView('list');
}
booted = true;

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

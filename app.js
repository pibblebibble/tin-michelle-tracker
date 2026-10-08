// Tin & Michelle wedding tracker.
// The shell, seat planner and print flow are carried over from Vivien's October tracker.
// New here: the venue's table layout, exported versions, the live guest list and editable to-dos.

const STORE = 'tm-wedding-tracker-v1:';
const SEATING_STORAGE = STORE + 'seat-planner';
const SEATING_DOCUMENT_STORAGE = STORE + 'seat-planner-document-name';
const SEATING_VERSION_STORAGE = STORE + 'seat-planner-version';
const SEATING_LABEL_STORAGE = STORE + 'seat-planner-version-label';
const SEATING_HISTORY_STORAGE = STORE + 'seat-planner-history';
const SEATING_PLAN_VERSION = '2027-03-06-venue-layout-v1';
const GUEST_KEY_STORAGE = STORE + 'guest-passcode';
const GUEST_CACHE_STORAGE = STORE + 'guest-cache';
const TASK_STORAGE = STORE + 'tasks';
const WEDDING_DATE = '2027-03-06T00:00:00+08:00';
const SITE_TITLE = 'Tin & Michelle — Wedding Tracker';

// The RSVP sheet's script. This is a second deployment of the same script the invite's form posts to:
// both write to and read from the one Google Sheet. The guest list is only returned with the passcode.
const RSVP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzEdqQHlpCtHTz0SBBylvnsrVQxuawXj0eJjLxbRvpBuKKIYlqdB0OZvHsRdLrLjvLR/exec';

// Venue layout: one main table of 12, then rows of six-seat tables as on the floor plan.
// To change the room, edit TABLE_ROWS here and the grid-template-areas in apple-ui.css.
const TABLE_ROWS = [['A', 8], ['B', 7], ['C', 7]];
const TABLE_LAYOUT = Object.freeze([
  { label: 'Main', name: 'Main table', capacity: 12, shape: 'round', orientation: 'vertical', area: 'main' },
  ...TABLE_ROWS.flatMap(([row, count]) => Array.from({ length: count }, (_, index) => ({
    label: `${row}${index + 1}`,
    name: `Table ${row}${index + 1}`,
    capacity: 6,
    shape: 'bar',
    orientation: 'stack',
    area: `${row.toLowerCase()}${index + 1}`
  })))
]);
const FLOOR_ZONES = [
  ['buffet', 'Buffet counter', ''],
  ['walk', 'Walkway', ''],
  ['guest', 'Guest entrance', 'floor-zone-entrance'],
  ['couple', 'Bride & groom entrance', 'floor-zone-entrance']
];
const DEFAULT_SEATING = TABLE_LAYOUT.map(table => Array(table.capacity).fill(''));
let guestData = loadGuestCache();
let seatingPlan = loadSeatingPlan();
let selectedTable = 1;
let currentSeat = null;
let seatingStatusTimer = null;
const menu = document.querySelector('#siteMenu');
const backdrop = document.querySelector('#menuBackdrop');
const menuButton = document.querySelector('#menuButton');

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

function loadSeatingPlan() {
  try {
    const saved = JSON.parse(localStorage.getItem(SEATING_STORAGE));
    const version = localStorage.getItem(SEATING_VERSION_STORAGE);
    const valid = version === SEATING_PLAN_VERSION && Array.isArray(saved) && saved.length === TABLE_LAYOUT.length && saved.every((table, index) => Array.isArray(table) && table.length === TABLE_LAYOUT[index].capacity);
    if (valid) return saved.map(table => table.map(cleanName));
  } catch (error) {}
  return DEFAULT_SEATING.map(table => [...table]);
}

function persistSeatingPlan() {
  localStorage.setItem(SEATING_STORAGE, JSON.stringify(seatingPlan));
  localStorage.setItem(SEATING_VERSION_STORAGE, SEATING_PLAN_VERSION);
  const documentName = document.querySelector('#seatingDocumentName');
  if (documentName) localStorage.setItem(SEATING_DOCUMENT_STORAGE, cleanName(documentName.value));
  localStorage.setItem(SEATING_LABEL_STORAGE, versionLabel());
}

function seatingTotals() {
  const capacity = seatingPlan.reduce((total, table) => total + table.length, 0);
  const assigned = seatingPlan.reduce((total, table) => total + table.filter(Boolean).length, 0);
  return { assigned, open: capacity - assigned };
}

function tableName(index) {
  return TABLE_LAYOUT[index]?.name || `Table ${index + 1}`;
}

// Everyone who should get a seat: attending guests and their named plus-ones.
function seatingRoster() {
  const names = [];
  guestData.rows.filter(guest => guest.attending).forEach(guest => {
    names.push(guest.name);
    if (guest.plusOneName) names.push(guest.plusOneName);
  });
  return [...new Set(names.map(cleanName).filter(Boolean))];
}

function refreshSeatingRoster() {
  const list = document.querySelector('#seatingGuestNames');
  if (list) list.innerHTML = seatingRoster().map(name => `<option value="${escapeHtml(name)}"></option>`).join('');
  updateUnassignedRemark();
}

function seatOf(name) {
  const wanted = cleanName(name).toLocaleLowerCase();
  if (!wanted) return '';
  for (let tableIndex = 0; tableIndex < seatingPlan.length; tableIndex += 1) {
    if (seatingPlan[tableIndex].some(value => cleanName(value).toLocaleLowerCase() === wanted)) return TABLE_LAYOUT[tableIndex].label;
  }
  return '';
}

function unassignedGuestNames() {
  const assigned = new Set(seatingPlan.flat().filter(Boolean).map(name => cleanName(name).toLocaleLowerCase()));
  return seatingRoster().filter(name => !assigned.has(name.toLocaleLowerCase()));
}

function updateUnassignedRemark() {
  const remark = document.querySelector('#unassignedRemark');
  const summary = document.querySelector('#unassignedSummary');
  const list = document.querySelector('#unassignedGuestList');
  const icon = remark?.querySelector('i');
  const missing = unassignedGuestNames();
  if (!remark || !summary || !list) return;
  remark.classList.toggle('has-unassigned', missing.length > 0);
  icon?.classList.toggle('ph-check-circle', missing.length === 0);
  icon?.classList.toggle('ph-warning-circle', missing.length > 0);
  const total = seatingRoster().length;
  summary.textContent = !total ? 'Attending guests will be listed here once the guest list is connected.' : missing.length ? `${missing.length} attending ${missing.length === 1 ? 'guest has' : 'guests have'} not been assigned a seat:` : `All ${total} attending guests are assigned a seat.`;
  list.hidden = missing.length === 0;
  list.innerHTML = missing.map(name => `<li>${escapeHtml(name)}</li>`).join('');
}

function setSeatingStatus(message, tone = '') {
  const status = document.querySelector('#seatingSaveStatus');
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
  clearTimeout(seatingStatusTimer);
  if (tone !== 'error') seatingStatusTimer = setTimeout(() => {
    status.textContent = 'Changes are saved in this browser.';
    delete status.dataset.tone;
  }, 2800);
}

function renderTablePicker() {
  const picker = document.querySelector('#tablePicker');
  if (!picker) return;
  const scrolled = picker.scrollLeft; // keep the row of tabs where the person left it
  picker.innerHTML = seatingPlan.map((table, index) => {
    const number = index + 1;
    const assigned = table.filter(Boolean).length;
    return `<button type="button" class="${selectedTable === number ? 'active' : ''}" onclick="selectTable(${number})" aria-pressed="${selectedTable === number}">${TABLE_LAYOUT[index].label} · ${assigned}/${table.length}</button>`;
  }).join('');
  picker.scrollLeft = scrolled;
}

function seatButton(tableIndex, seatIndex, position = '') {
  const name = seatingPlan[tableIndex][seatIndex];
  const number = seatIndex + 1;
  const label = name || 'Open seat';
  return `<button type="button" class="seat-button${name ? ' occupied' : ''}${position ? ` seat-${position}` : ''}" onclick="openSeatDialog(${tableIndex}, ${seatIndex})" title="${escapeHtml(name || `${tableName(tableIndex)}, seat ${number}`)}" aria-label="${tableName(tableIndex)}, seat ${number}: ${escapeHtml(label)}"><span class="seat-number">${number}</span>${escapeHtml(label)}</button>`;
}

function tableSurface(tableIndex, shape) {
  const number = tableIndex + 1;
  const layout = TABLE_LAYOUT[tableIndex];
  const caption = shape === 'bar' ? '' : 'Table';
  return `<button class="table-surface table-surface-${shape}" type="button" onclick="selectTable(${number})" aria-label="Select ${escapeHtml(layout.name)}"><span><strong>${escapeHtml(layout.label)}</strong>${caption}</span></button>`;
}

function renderTableDiagram(tableIndex) {
  const table = seatingPlan[tableIndex];
  const layout = TABLE_LAYOUT[tableIndex];
  if (layout.orientation === 'around') {
    return `<div class="table-diagram table-diagram-around">${seatButton(tableIndex, 0, 'top')}${seatButton(tableIndex, 1, 'left')}${tableSurface(tableIndex, layout.shape)}${seatButton(tableIndex, 2, 'right')}${seatButton(tableIndex, 3, 'bottom')}</div>`;
  }
  const half = table.length / 2;
  if (layout.orientation === 'stack') {
    // Six-seat tables: three guests on each long side, listed above and below the table.
    const far = table.slice(0, half).map((name, seat) => seatButton(tableIndex, seat)).join('');
    const near = table.slice(half).map((name, seat) => seatButton(tableIndex, seat + half)).join('');
    return `<div class="table-diagram table-diagram-stack"><div class="seat-stack">${far}</div>${tableSurface(tableIndex, 'bar')}<div class="seat-stack">${near}</div></div>`;
  }
  if (layout.orientation === 'vertical') {
    const left = table.slice(0, half).map((name, seat) => seatButton(tableIndex, seat)).join('');
    const right = table.slice(half).map((name, seat) => seatButton(tableIndex, seat + half)).join('');
    return `<div class="table-diagram table-diagram-vertical"><div class="seat-column" style="--seat-count:${half}">${left}</div>${tableSurface(tableIndex, layout.shape)}<div class="seat-column" style="--seat-count:${half}">${right}</div></div>`;
  }
  const top = table.slice(0, half).map((name, seat) => seatButton(tableIndex, seat)).join('');
  const bottom = table.slice(half).map((name, seat) => seatButton(tableIndex, seat + half)).join('');
  return `<div class="table-diagram table-diagram-horizontal"><div class="seat-row" style="--seat-count:${half}">${top}</div>${tableSurface(tableIndex, layout.shape)}<div class="seat-row" style="--seat-count:${half}">${bottom}</div></div>`;
}

function renderFloorplan() {
  const floorplan = document.querySelector('#seatFloorplan');
  if (!floorplan) return;
  const zones = FLOOR_ZONES.map(([area, label, extra]) => `<div class="floor-zone ${extra}" style="grid-area:${area}" aria-hidden="true">${escapeHtml(label)}</div>`).join('');
  floorplan.innerHTML = zones + seatingPlan.map((table, index) => {
    const number = index + 1;
    const layout = TABLE_LAYOUT[index];
    const assigned = table.filter(Boolean).length;
    return `<article class="floor-table${selectedTable === number ? ' selected' : ''}" data-table="${number}" data-area="${layout.area}" data-shape="${layout.shape}" data-orientation="${layout.orientation}" style="grid-area:${layout.area}"><header class="floor-table-heading"><button type="button" onclick="selectTable(${number})">${escapeHtml(layout.orientation === 'stack' ? layout.label : layout.name)}</button><span>${assigned}/${table.length}</span></header>${renderTableDiagram(index)}</article>`;
  }).join('');
  const totals = seatingTotals();
  document.querySelector('#seatingAssignedCount').textContent = totals.assigned;
  document.querySelector('#seatingOpenCount').textContent = totals.open;
  renderTablePicker();
  updateUnassignedRemark();
  if (document.querySelector('#guestPanels')) renderGuests();
}

// Picking a table never moves the page: the chosen table simply appears under the tabs.
function selectTable(number) {
  selectedTable = number;
  document.querySelectorAll('.floor-table').forEach(table => table.classList.toggle('selected', Number(table.dataset.table) === number));
  renderTablePicker();
}

function findNameMatches(name, excludeTable, excludeSeat) {
  const normalized = cleanName(name).toLocaleLowerCase();
  const inputTokens = normalized.split(' ').filter(Boolean);
  if (!normalized) return [];
  const matches = [];
  seatingPlan.forEach((table, tableIndex) => table.forEach((value, seatIndex) => {
    if (tableIndex === excludeTable && seatIndex === excludeSeat) return;
    const guestName = cleanName(value);
    const candidate = guestName.toLocaleLowerCase();
    if (!candidate) return;
    const candidateTokens = candidate.split(' ');
    const exact = candidate === normalized;
    const strongPartial = !exact && inputTokens.every(inputToken => candidateTokens.some(candidateToken => candidateToken === inputToken || (inputToken.length >= 4 && candidateToken.startsWith(inputToken))));
    if (exact || strongPartial) matches.push({ tableIndex, seatIndex, name: guestName, exact });
  }));
  return matches;
}

function validateSeatName() {
  const input = document.querySelector('#seatNameInput');
  const warning = document.querySelector('#seatDuplicateWarning');
  const message = document.querySelector('#seatMatchMessage');
  const list = document.querySelector('#seatMatchList');
  const save = document.querySelector('#saveSeatButton');
  if (!input || !currentSeat) return true;
  const matches = findNameMatches(input.value, currentSeat.tableIndex, currentSeat.seatIndex);
  const exact = matches.some(match => match.exact);
  warning.hidden = matches.length === 0;
  message.textContent = matches.length ? exact ? 'That exact name is already assigned. Move the guest instead of creating a duplicate.' : matches.length === 1 ? 'This may be the same guest. Check before adding another person.' : `We found ${matches.length} possible matches. Choose one only if it is the same person.` : '';
  list.innerHTML = matches.map(match => `<div><span><strong>${escapeHtml(match.name)}</strong><small>${tableName(match.tableIndex)} · Seat ${match.seatIndex + 1}</small></span><button type="button" onclick="moveMatchedGuest(${match.tableIndex}, ${match.seatIndex})">${seatingPlan[currentSeat.tableIndex][currentSeat.seatIndex] ? 'Swap here' : 'Move here'}</button></div>`).join('');
  save.disabled = exact;
  save.textContent = matches.length && !exact ? 'Save as a different guest' : 'Save name';
  input.setAttribute('aria-invalid', String(exact));
  return !exact;
}

function moveMatchedGuest(sourceTable, sourceSeat) {
  if (!currentSeat) return;
  const targetTable = currentSeat.tableIndex;
  const targetSeat = currentSeat.seatIndex;
  const guest = seatingPlan[sourceTable][sourceSeat];
  const displaced = seatingPlan[targetTable][targetSeat];
  seatingPlan[targetTable][targetSeat] = guest;
  seatingPlan[sourceTable][sourceSeat] = displaced || '';
  persistSeatingPlan();
  renderFloorplan();
  closeSeatDialog();
  setSeatingStatus(displaced ? `${guest} and ${displaced} swapped seats.` : `${guest} moved to ${tableName(targetTable)}, Seat ${targetSeat + 1}.`);
}

function openSeatDialog(tableIndex, seatIndex) {
  selectTable(tableIndex + 1);
  currentSeat = { tableIndex, seatIndex };
  const dialog = document.querySelector('#seatDialog');
  const input = document.querySelector('#seatNameInput');
  const name = seatingPlan[tableIndex][seatIndex];
  document.querySelector('#seatDialogLocation').textContent = `${tableName(tableIndex)} · Seat ${seatIndex + 1}`;
  document.querySelector('#seatDialogTitle').textContent = name ? 'Edit guest' : 'Add a guest';
  document.querySelector('#clearSeatButton').disabled = !name;
  input.value = name;
  validateSeatName();
  dialog.showModal();
  requestAnimationFrame(() => input.focus());
}

function closeSeatDialog() {
  const dialog = document.querySelector('#seatDialog');
  if (dialog?.open) dialog.close();
  currentSeat = null;
}

function submitSeatName(event) {
  event.preventDefault();
  const input = document.querySelector('#seatNameInput');
  const name = cleanName(input.value);
  input.value = name;
  if (!name) {
    input.setCustomValidity('Enter a guest name.');
    input.reportValidity();
    input.setCustomValidity('');
    return;
  }
  if (!validateSeatName()) return;
  seatingPlan[currentSeat.tableIndex][currentSeat.seatIndex] = name;
  persistSeatingPlan();
  renderFloorplan();
  closeSeatDialog();
  setSeatingStatus(`${name} saved to ${tableName(selectedTable - 1)}.`);
}

function clearCurrentSeat() {
  if (!currentSeat) return;
  const oldName = seatingPlan[currentSeat.tableIndex][currentSeat.seatIndex];
  seatingPlan[currentSeat.tableIndex][currentSeat.seatIndex] = '';
  persistSeatingPlan();
  renderFloorplan();
  closeSeatDialog();
  setSeatingStatus(oldName ? `${oldName} removed. The seat is open.` : 'Seat is already open.');
}

function saveSeatingPlan() {
  persistSeatingPlan();
  setSeatingStatus(`Plan saved at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`);
}

function versionLabel() {
  return cleanName(document.querySelector('#seatingVersion')?.value) || 'v1';
}

function loadSeatingHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(SEATING_HISTORY_STORAGE));
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    return [];
  }
}

function renderSeatingHistory() {
  const wrap = document.querySelector('#versionHistory');
  const list = document.querySelector('#versionHistoryList');
  const history = loadSeatingHistory();
  wrap.hidden = history.length === 0;
  list.innerHTML = history.map((entry, index) => `<li><span><strong>${escapeHtml(entry.version)}</strong> · exported ${escapeHtml(entry.when)} · ${entry.assigned} seated</span><button type="button" onclick="restoreSeatingVersion(${index})">Restore this version</button></li>`).join('');
}

// Every export keeps a copy of the plan under its version label, so an earlier one can be brought back.
function recordSeatingVersion() {
  const version = versionLabel();
  const when = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  const entry = { version, when, assigned: seatingTotals().assigned, plan: seatingPlan.map(table => [...table]) };
  const history = [entry, ...loadSeatingHistory().filter(item => item.version !== version)].slice(0, 20);
  localStorage.setItem(SEATING_HISTORY_STORAGE, JSON.stringify(history));
  renderSeatingHistory();
}

function restoreSeatingVersion(index) {
  const entry = loadSeatingHistory()[index];
  const valid = entry && Array.isArray(entry.plan) && entry.plan.length === TABLE_LAYOUT.length && entry.plan.every((table, i) => Array.isArray(table) && table.length === TABLE_LAYOUT[i].capacity);
  if (!valid) return;
  if (!confirm(`Replace the current seat plan with ${entry.version}? The current plan is only kept if it has been exported.`)) return;
  seatingPlan = entry.plan.map(table => table.map(cleanName));
  document.querySelector('#seatingVersion').value = entry.version;
  persistSeatingPlan();
  renderFloorplan();
  setSeatingStatus(`${entry.version} restored.`);
}

function setupSeatingVersions() {
  const field = document.querySelector('#seatingVersion');
  const saved = localStorage.getItem(SEATING_LABEL_STORAGE);
  if (saved) field.value = saved;
  field.addEventListener('input', () => localStorage.setItem(SEATING_LABEL_STORAGE, versionLabel()));
  renderSeatingHistory();
}

function printSeatingPlan() {
  const nameField = document.querySelector('#seatingDocumentName');
  const pageTitle = document.querySelector('#seatingPageTitle');
  const documentName = cleanName(nameField.value);
  if (!documentName) {
    setSeatingStatus('Add a document name before printing.', 'error');
    nameField.focus();
    return;
  }
  nameField.value = documentName;
  persistSeatingPlan();
  recordSeatingVersion();
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const printTitle = `${documentName} · ${versionLabel()} · ${today}`;
  const previousTitle = document.title;
  const previousHeading = pageTitle.textContent;
  document.body.classList.add('printing-seat-plan');
  document.title = printTitle; // the browser uses this as the PDF file name
  pageTitle.textContent = printTitle;
  const cleanup = () => {
    window.removeEventListener('afterprint', cleanup);
    document.body.classList.remove('printing-seat-plan');
    document.title = previousTitle;
    pageTitle.textContent = previousHeading;
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  requestAnimationFrame(() => {
    window.print();
    cleanup();
  });
}

function setupSeatingPlanner() {
  const nameField = document.querySelector('#seatingDocumentName');
  const savedName = localStorage.getItem(SEATING_DOCUMENT_STORAGE);
  if (savedName) nameField.value = savedName;
  nameField.addEventListener('input', () => {
    localStorage.setItem(SEATING_DOCUMENT_STORAGE, cleanName(nameField.value));
    setSeatingStatus('Document name saved.');
  });
  document.querySelector('#seatingTableCount').textContent = String(TABLE_LAYOUT.length);
  setupSeatingVersions();
  document.querySelector('#seatNameInput').addEventListener('input', validateSeatName);
  document.querySelector('#seatDialog').addEventListener('cancel', () => { currentSeat = null; });
  persistSeatingPlan();
  renderFloorplan();
}

function toggleMenu(force) {
  const open = typeof force === 'boolean' ? force : !menu.classList.contains('open');
  menu.classList.toggle('open', open);
  backdrop.classList.toggle('open', open);
  menu.setAttribute('aria-hidden', String(!open));
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  document.body.classList.toggle('drawer-open', open);
}

function showView(id, targetId) {
  const next = document.getElementById(id) ? id : 'home';
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === next));
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === next));
  history.replaceState(null, '', next === 'home' ? location.pathname : `#${next}`);
  document.title = next === 'home' ? SITE_TITLE : `${document.querySelector(`#${next} h2`)?.textContent} — Tin & Michelle`;
  if (next === 'guests') refreshGuests();
  toggleMenu(false);
  requestAnimationFrame(() => {
    const target = targetId ? document.getElementById(targetId) : null;
    window.scrollTo({ top: target ? Math.max(0, target.offsetTop - 96) : 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
}

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view, button.dataset.scrollTarget)));
menuButton.addEventListener('click', () => toggleMenu());
document.querySelector('#drawerClose').addEventListener('click', () => toggleMenu(false));
backdrop.addEventListener('click', () => toggleMenu(false));
document.addEventListener('keydown', event => { if (event.key === 'Escape') toggleMenu(false); });
document.querySelector('#backToTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

function updateCountdown() {
  const target = new Date(WEDDING_DATE);
  document.querySelector('#daysToWedding').textContent = String(Math.max(0, Math.ceil((target - new Date()) / 86400000)));
}

// ---------- Pending items ----------
// The list lives in data/tasks.json, grouped under a date and a title, and is changed by asking
// Codex or Claude. On the page you only tick things off; ticks are kept in this browser.

const TASK_FILE = 'data/tasks.json';
let taskGroups = [];
let taskTicks = loadTaskTicks();

function loadTaskTicks() {
  try {
    const saved = JSON.parse(localStorage.getItem(TASK_STORAGE));
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch (error) {
    return {};
  }
}

function allTasks() {
  return taskGroups.flatMap(group => group.items);
}

function taskDone(task) {
  return Object.prototype.hasOwnProperty.call(taskTicks, task.id) ? Boolean(taskTicks[task.id]) : task.done;
}

function groupDateParts(value) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? new Date(`${value}T00:00:00`) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return { day: String(date.getDate()), month: date.toLocaleDateString('en-GB', { month: 'long' }), long: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) };
}

function renderTasks() {
  const tasks = allTasks();
  const complete = tasks.filter(taskDone).length;
  document.querySelector('#pendingGroups').innerHTML = taskGroups.map(group => {
    const done = group.items.filter(taskDone).length;
    const parts = groupDateParts(group.date);
    const time = parts ? `<time datetime="${escapeHtml(group.date)}"><span class="pending-day">${parts.day}</span><span class="pending-month">${parts.month}</span></time>` : '';
    const count = group.items.length ? `${done} / ${group.items.length} complete` : 'No items yet';
    const items = group.items.length ? group.items.map(task => `<label class="pending-item"><input type="checkbox" data-task="${escapeHtml(task.id)}"${taskDone(task) ? ' checked' : ''}><span class="pending-check"><i class="ph ph-check" aria-hidden="true"></i></span><strong>${escapeHtml(task.text)}</strong></label>`).join('') : '<p class="pending-empty">Nothing here yet.</p>';
    return `<article class="pending-group"><h3>${time}<span class="pending-event">${escapeHtml(group.title)}</span><span class="pending-section-count">${count}</span></h3><div class="pending-list">${items}</div></article>`;
  }).join('');
  document.querySelector('#pendingProgressCount').textContent = `${complete} of ${tasks.length} completed`;
  document.querySelector('#pendingProgressFill').style.width = `${tasks.length ? complete / tasks.length * 100 : 0}%`;
  document.querySelector('#homePendingCount').textContent = String(tasks.length - complete);
}

async function loadTasks() {
  let data = {};
  try {
    const response = await fetch(`${TASK_FILE}?t=${Date.now()}`, { cache: 'no-store' });
    data = await response.json();
  } catch (error) {}
  const groups = Array.isArray(data.groups) ? data.groups : [{ id: 'wedding-day', date: '2027-03-06', title: 'Wedding Day', items: data.items }];
  taskGroups = groups.filter(group => group && cleanName(group.title)).map((group, groupIndex) => ({
    id: String(group.id || `group-${groupIndex + 1}`),
    date: String(group.date || ''),
    title: cleanName(group.title),
    items: (Array.isArray(group.items) ? group.items : []).filter(task => task && cleanName(task.text)).map((task, index) => ({ id: String(task.id || `${group.id || groupIndex}-${index + 1}`), text: cleanName(task.text), done: Boolean(task.done) }))
  }));
  // Forget ticks that now agree with the shared list, or belong to items that were removed.
  const known = new Map(allTasks().map(task => [task.id, task]));
  Object.keys(taskTicks).forEach(id => {
    if (!known.has(id) || known.get(id).done === Boolean(taskTicks[id])) delete taskTicks[id];
  });
  localStorage.setItem(TASK_STORAGE, JSON.stringify(taskTicks));
  renderTasks();
}

function bindTasks() {
  document.querySelector('#pendingGroups').addEventListener('change', event => {
    const id = event.target.dataset.task;
    if (!id) return;
    taskTicks[id] = event.target.checked;
    localStorage.setItem(TASK_STORAGE, JSON.stringify(taskTicks));
    renderTasks();
  });
  document.querySelector('#pendingCopy').addEventListener('click', copyPendingPage);
  renderTasks();
  loadTasks();
}

// One button copies the whole Pending Items page as plain text (dates, titles, items and
// what is ticked), ready to paste to Codex or Claude along with whatever should change.
function pendingPageText() {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const groups = taskGroups.map(group => {
    const parts = groupDateParts(group.date);
    const heading = [parts ? parts.long : '', group.title].filter(Boolean).join(' — ');
    const items = group.items.length ? group.items.map(task => `[${taskDone(task) ? 'x' : ' '}] ${task.text}`).join('\n') : '(no items yet)';
    return `${heading}\n${items}`;
  }).join('\n\n');
  return `Pending Items on the Tin & Michelle wedding tracker, as of ${today}.\nPlease update the tracker to match this, with my changes below.\n\n${groups}\n\nMy changes:\n`;
}

async function copyPendingPage() {
  const text = pendingPageText();
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    // Older browsers, or a page without clipboard permission
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  const note = document.querySelector('#pendingCopyNote');
  note.textContent = 'Copied. Paste it to Codex or Claude and type your changes underneath.';
  clearTimeout(copyPendingPage.timer);
  copyPendingPage.timer = setTimeout(() => { note.textContent = 'Ticks are saved in this browser.'; }, 5000);
}

// ---------- Guest list: read live from the invite's RSVP sheet ----------

function loadGuestCache() {
  try {
    const saved = JSON.parse(localStorage.getItem(GUEST_CACHE_STORAGE));
    if (saved && Array.isArray(saved.rows)) return saved;
  } catch (error) {}
  return { rows: [], fetchedAt: 0 };
}

function guestKey() {
  return localStorage.getItem(GUEST_KEY_STORAGE) || '';
}

function setGuestStatus(message, tone = '') {
  const status = document.querySelector('#guestStatus');
  status.textContent = message;
  status.dataset.tone = tone;
}

function normaliseGuest(row) {
  const attending = String(row.attending || '').trim().toLowerCase() === 'yes';
  const bringing = attending && String(row.plusOne || '').trim().toLowerCase() === 'yes';
  return {
    name: cleanName(row.name),
    attending,
    plusOneName: bringing ? cleanName(row.plusOneName) : '',
    bringing,
    dietary: cleanName(row.dietary),
    phone: cleanName(row.phone),
    email: cleanName(row.email),
    message: cleanName(row.message),
    received: row.received || ''
  };
}

function guestRowsHtml(rows, attending) {
  return rows.map((guest, index) => {
    const seats = [seatOf(guest.name), guest.plusOneName ? seatOf(guest.plusOneName) : ''].filter(Boolean);
    const seatText = [...new Set(seats)].join(', ');
    const status = attending ? `<span class="attending-label">Attending${guest.bringing ? ' · 2' : ''}</span>` : '<span class="declined-label">Declined</span>';
    const plusOne = guest.bringing ? escapeHtml(guest.plusOneName || 'Name not given') : '—';
    return `<tr><td class="guest-number">${index + 1}</td><td><strong>${escapeHtml(guest.name)}</strong>${guest.message ? `<small>“${escapeHtml(guest.message)}”</small>` : ''}</td><td${guest.bringing ? '' : ' class="no-plus-one"'}>${plusOne}</td><td>${escapeHtml(guest.dietary || '—')}</td><td>${escapeHtml(guest.phone || '—')}</td><td>${attending ? escapeHtml(seatText || 'Not seated') : '—'}</td><td class="guest-rsvp">${status}</td></tr>`;
  }).join('');
}

function guestPanelHtml(title, note, rows, attending) {
  if (!rows.length) return '';
  return `<article class="guest-event-panel"><div class="guest-section-heading${attending ? '' : ' declined-heading'}"><h3>${title}</h3><span>${note}</span></div><div class="guest-list"><table class="guest-table"><thead><tr><th>No.</th><th>Guest</th><th>Plus-one</th><th>Dietary</th><th>WhatsApp</th><th>Table</th><th>RSVP status</th></tr></thead><tbody>${guestRowsHtml(rows, attending)}</tbody></table></div></article>`;
}

function renderGuests() {
  const connected = Boolean(guestKey());
  const rows = guestData.rows;
  const attending = rows.filter(guest => guest.attending).sort((a, b) => a.name.localeCompare(b.name));
  const declined = rows.filter(guest => !guest.attending).sort((a, b) => a.name.localeCompare(b.name));
  const plusOnes = attending.filter(guest => guest.bringing).length;
  const people = attending.length + plusOnes;

  document.querySelector('#guestConnect').hidden = connected;
  document.querySelector('#guestLive').hidden = !connected;
  ['#guestRefresh', '#guestDisconnect'].forEach(id => { document.querySelector(id).hidden = !connected; });
  document.querySelector('#guestDownload').hidden = !connected || !rows.length;
  document.querySelector('#homeGuestCount').textContent = connected && guestData.fetchedAt ? String(people) : '—';
  if (!connected) return;

  document.querySelector('#guestReplies').textContent = String(rows.length);
  document.querySelector('#guestAttending').textContent = String(people);
  document.querySelector('#guestPlusOnes').textContent = String(plusOnes);
  document.querySelector('#guestDeclined').textContent = String(declined.length);
  const withDietary = attending.filter(guest => guest.dietary && !/^(none|no|nil|n\/a|-)$/i.test(guest.dietary)).length;
  document.querySelector('#guestSummaryNote').textContent = rows.length ? `${attending.length} ${attending.length === 1 ? 'guest has' : 'guests have'} accepted, bringing ${plusOnes} ${plusOnes === 1 ? 'plus-one' : 'plus-ones'}. ${withDietary} with dietary notes.` : '';
  document.querySelector('#guestPanels').innerHTML = rows.length
    ? guestPanelHtml('Attending', `${people} ${people === 1 ? 'guest' : 'guests'} including plus-ones`, attending, true) + guestPanelHtml('Declined', `${declined.length} ${declined.length === 1 ? 'guest' : 'guests'}`, declined, false)
    : '<div class="guest-empty"><h3>No replies yet</h3><p>Replies will appear here as guests respond to the invite.</p></div>';
  labelTables();
}

let guestRequest = null;

async function refreshGuests(announce = false) {
  const key = guestKey();
  if (!key) { renderGuests(); return; }
  if (guestRequest) return guestRequest;
  if (announce || !guestData.fetchedAt) setGuestStatus('Updating…');
  guestRequest = (async () => {
    try {
      // The passcode travels in the request body, not the address.
      const response = await fetch(RSVP_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'guests', key }) });
      const data = await response.json();
      if (!data || data.ok !== true || !Array.isArray(data.guests)) throw new Error((data && data.error) || 'Not available');
      guestData = { rows: data.guests.map(normaliseGuest).filter(guest => guest.name), fetchedAt: Date.now() };
      localStorage.setItem(GUEST_CACHE_STORAGE, JSON.stringify(guestData));
      setGuestStatus(`Live · updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`, 'live');
    } catch (error) {
      const message = String(error.message || '');
      if (/wrong passcode/i.test(message)) {
        localStorage.removeItem(GUEST_KEY_STORAGE);
        setGuestStatus('That passcode was not accepted. Please try again.', 'error');
      } else if (/missing required fields|passcode not set/i.test(message)) {
        setGuestStatus('The RSVP sheet has not been set up to share the guest list yet.', 'error');
      } else {
        setGuestStatus(`Could not reach the RSVP sheet${guestData.fetchedAt ? '. Showing the last saved copy.' : '.'}`, 'error');
      }
    } finally {
      guestRequest = null;
      renderGuests();
      refreshSeatingRoster();
    }
  })();
  return guestRequest;
}

function downloadGuestCsv() {
  const header = ['Name', 'Attending', 'Plus-one', 'Dietary', 'WhatsApp', 'Email', 'Table', 'Message'];
  const lines = guestData.rows.map(guest => [guest.name, guest.attending ? 'Yes' : 'No', guest.plusOneName, guest.dietary, guest.phone, guest.email, seatOf(guest.name), guest.message]);
  const csv = [header, ...lines].map(line => line.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'Tin-Michelle-guest-list.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

function setupGuests() {
  const dialog = document.querySelector('#guestKeyDialog');
  const input = document.querySelector('#guestKeyInput');
  const closeDialog = () => { if (dialog.open) dialog.close(); };
  document.querySelector('#guestConnectButton').addEventListener('click', () => { input.value = ''; dialog.showModal(); requestAnimationFrame(() => input.focus()); });
  document.querySelector('#guestKeyClose').addEventListener('click', closeDialog);
  document.querySelector('#guestKeyCancel').addEventListener('click', closeDialog);
  document.querySelector('#guestKeyForm').addEventListener('submit', event => {
    event.preventDefault();
    const key = input.value.trim();
    if (!key) return;
    localStorage.setItem(GUEST_KEY_STORAGE, key);
    closeDialog();
    renderGuests();
    refreshGuests(true);
  });
  document.querySelector('#guestRefresh').addEventListener('click', () => refreshGuests(true));
  document.querySelector('#guestDownload').addEventListener('click', downloadGuestCsv);
  document.querySelector('#guestDisconnect').addEventListener('click', () => {
    if (!confirm('Disconnect the guest list from this browser? The saved copy of the list is removed too.')) return;
    localStorage.removeItem(GUEST_KEY_STORAGE);
    localStorage.removeItem(GUEST_CACHE_STORAGE);
    guestData = { rows: [], fetchedAt: 0 };
    setGuestStatus('Not connected.');
    renderGuests();
    refreshSeatingRoster();
  });
  if (guestKey() && guestData.fetchedAt) setGuestStatus(`Saved copy from ${new Date(guestData.fetchedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}`);
  renderGuests();
  refreshGuests();
  // Keep the list fresh while the guest list is on screen.
  setInterval(() => {
    if (document.visibilityState === 'visible' && document.querySelector('#guests').classList.contains('active')) refreshGuests();
  }, 60000);
}

function labelTables() {
  document.querySelectorAll('table').forEach(table => {
    const labels = [...table.querySelectorAll('th')].map(cell => cell.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(row => {
      [...row.children].forEach((cell, index) => { cell.dataset.label = labels[index] || ''; });
    });
  });
}

updateCountdown();
bindTasks();
setupSeatingPlanner();
setupGuests();
refreshSeatingRoster();
showView(location.hash.slice(1) || 'home');

// ============================================================
// Tournament.gs — Fall 2026 tournament ACES shifts (Nov 9–14)
// ============================================================
// HOW TO USE
//   1. Apps Script editor → "+" next to Files → Script → name it Tournament
//   2. Paste this whole file, save (Ctrl+S).
//   3. Function dropdown → previewTournamentShifts → Run. Check the
//      Execution log: every name should say "matched".
//   4. Function dropdown → loadTournamentShifts → Run. Reload the site.
//   5. To undo: removeTournamentShifts (removes only these 27 slots).
//
// It uses SHEET_ID, SHEETS, uid(), sheetToObjects() and sheetToList()
// from Code.gs (same project, so they are in scope).
// Edit the TOURNAMENT_SHIFTS table below before running if assignments
// changed since the 11/3 plan. Running loadTournamentShifts twice is safe:
// a slot that already exists (same date + campus + shift) is skipped.

const TOURNAMENT_SHIFTS = [
  // date,         campus,          shift,             ACE name
  // ---- Monday 11/9 ----
  ['2026-11-09', 'South Campus', '5:00-7:00pm',     'David Block'],
  ['2026-11-09', 'South Campus', '7:00-9:00pm',     'Colin Bear'],
  ['2026-11-09', 'McGovern',     '5:00-7:00pm',     'Carter Wiley'],
  ['2026-11-09', 'McGovern',     '7:00-9:00pm',     'Ross Thompson'],
  ['2026-11-09', 'Bayland',      '5:00-7:00pm',     'Frank Ortiz'],
  ['2026-11-09', 'Bayland',      '7:00-9:00pm',     'Mac McDaniel'],
  // ---- Tuesday 11/10 ----
  ['2026-11-10', 'South Campus', '5:00-7:00pm',     'Ryan Hardin'],
  ['2026-11-10', 'South Campus', '7:00-9:00pm',     'Chris Howard'],
  ['2026-11-10', 'Bayland',      '5:00-7:00pm',     'Seve Ramirez'],
  ['2026-11-10', 'Bayland',      '7:00-9:00pm',     'Justin Gregg'],
  // ---- Wednesday 11/11 ----
  ['2026-11-11', 'South Campus', '5:00-7:00pm',     'Eric Danziger'],
  ['2026-11-11', 'South Campus', '7:00-9:00pm',     'David Whitley'],
  ['2026-11-11', 'Bayland',      '5:00-7:00pm',     'Stephanie Landis'],
  ['2026-11-11', 'Bayland',      '7:00-9:00pm',     'Kyle Jung'],
  // ---- Thursday 11/12 ----
  ['2026-11-12', 'South Campus', '5:00-7:00pm',     'Patrick Cresap'],
  ['2026-11-12', 'South Campus', '7:00-9:00pm',     'Richard Falcone'],
  ['2026-11-12', 'Bayland',      '5:00-7:00pm',     'Jim McDade'],
  ['2026-11-12', 'Bayland',      '7:00-9:00pm',     'Lee Donovan'],
  // ---- Friday 11/13 ----
  ['2026-11-13', 'South Campus', '5:00-7:00pm',     'Marko Hirvensalo'],
  ['2026-11-13', 'South Campus', '7:00-9:00pm',     'Chad Kuck'],
  ['2026-11-13', 'Bayland',      '5:00-7:00pm',     'Greg McEldowney'],
  ['2026-11-13', 'Bayland',      '7:00-9:00pm',     'Matt Moake'],
  // ---- Saturday 11/14 (South Campus only) ----
  ['2026-11-14', 'South Campus', '8:30-10:30am',    'Dennis Stasio'],
  ['2026-11-14', 'South Campus', '10:30am-12:30pm', 'Collins Free'],
  ['2026-11-14', 'South Campus', '12:30-2:30pm',    'Mike Kim'],
  ['2026-11-14', 'South Campus', '2:30-4:30pm',     'Russell Gray'],
  ['2026-11-14', 'South Campus', '4:30-6:30pm',     'Carlos Valdez'],
];

// If the Campuses tab already has a campus whose name contains the value
// (case-insensitive), that existing name is used instead of adding a new one.
// e.g. 'McGovern' → 'Pershing/McGovern' if that is what the Sheet has.
const TOURNAMENT_CAMPUS_MATCH = { 'McGovern': 'mcgovern', 'South Campus': 'south campus', 'Bayland': 'bayland' };

// ------------------------------------------------------------
// Dry run: logs what loadTournamentShifts would do. Writes nothing.
// ------------------------------------------------------------
function previewTournamentShifts() { tournamentRun_(false); }

// ------------------------------------------------------------
// Adds the campuses and slots. Unmatched names are left blank (shown as
// "Open" on the site) so a coordinator can assign them by hand.
// ------------------------------------------------------------
function loadTournamentShifts() { tournamentRun_(true); }

function tournamentRun_(write) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const aces = sheetToObjects(ss, SHEETS.ACES);
  const existingSlots = sheetToObjects(ss, SHEETS.SLOTS);
  const campusSheet = ss.getSheetByName(SHEETS.CAMPUSES);
  const campuses = sheetToList(ss, SHEETS.CAMPUSES);

  // Resolve campus names against the Sheet
  const campusFor = {};
  const newCampuses = [];
  Object.keys(TOURNAMENT_CAMPUS_MATCH).forEach(key => {
    const needle = TOURNAMENT_CAMPUS_MATCH[key];
    const found = campuses.find(c => String(c).toLowerCase().includes(needle));
    if (found) { campusFor[key] = found; }
    else { campusFor[key] = key; newCampuses.push(key); }
  });

  const existingKeys = new Set(existingSlots.map(s => slotKey_(normDate_(s.date), s.campus, s.shift)));
  const rows = [];
  const report = { matched: [], unmatched: [], skipped: [] };

  TOURNAMENT_SHIFTS.forEach(([date, campusKey, shift, name]) => {
    const campus = campusFor[campusKey] || campusKey;
    const key = slotKey_(date, campus, shift);
    if (existingKeys.has(key)) { report.skipped.push(`${date} ${campus} ${shift}`); return; }
    const ace = findAceByName_(aces, name);
    if (ace) report.matched.push(`${name} → ${ace.name} (${ace.id})`);
    else     report.unmatched.push(`${name}  [${date} ${campus} ${shift}]`);
    rows.push([uid(), campus, date, shift, ace ? ace.id : '']);
  });

  Logger.log(`=== TOURNAMENT ${write ? 'LOAD' : 'PREVIEW'} ===`);
  Logger.log(`Campuses to add: ${newCampuses.length ? newCampuses.join(', ') : 'none'}`);
  Logger.log(`Campus mapping: ${JSON.stringify(campusFor)}`);
  Logger.log(`Slots to add: ${rows.length}   already present (skipped): ${report.skipped.length}`);
  report.matched.forEach(m => Logger.log('matched   ' + m));
  report.unmatched.forEach(u => Logger.log('UNMATCHED ' + u));
  report.skipped.forEach(s => Logger.log('skipped   ' + s));

  if (!write) {
    uiAlert_('Preview only — nothing written.\n\n' +
      `Slots to add: ${rows.length}\nAlready present: ${report.skipped.length}\n` +
      `Names matched: ${report.matched.length}\nNames NOT matched: ${report.unmatched.length}` +
      (report.unmatched.length ? '\n\n' + report.unmatched.join('\n') : '') +
      (newCampuses.length ? `\n\nCampuses to add: ${newCampuses.join(', ')}` : ''));
    return;
  }

  newCampuses.forEach(c => campusSheet.appendRow([c]));
  if (rows.length) {
    const slotSheet = ss.getSheetByName(SHEETS.SLOTS);
    slotSheet.getRange(slotSheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  }
  uiAlert_('Tournament loaded.\n\n' +
    `✅ ${rows.length} slots added (${report.skipped.length} already present)\n` +
    `✅ ${report.matched.length} names matched\n` +
    (report.unmatched.length
      ? `⚠ ${report.unmatched.length} left Open — assign in the Coordinator tab:\n` + report.unmatched.join('\n')
      : '✅ all names matched') +
    (newCampuses.length ? `\n\nCampuses added: ${newCampuses.join(', ')}` : ''));
}

// ------------------------------------------------------------
// Removes exactly the slots listed in TOURNAMENT_SHIFTS (by date + campus
// + shift). Regular-season slots are untouched. Does not touch Trades.
// ------------------------------------------------------------
function removeTournamentShifts() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const campuses = sheetToList(ss, SHEETS.CAMPUSES);
  const keys = new Set();
  TOURNAMENT_SHIFTS.forEach(([date, campusKey, shift]) => {
    const needle = TOURNAMENT_CAMPUS_MATCH[campusKey] || campusKey.toLowerCase();
    const campus = campuses.find(c => String(c).toLowerCase().includes(needle)) || campusKey;
    keys.add(slotKey_(date, campus, shift));
  });
  const sheet = ss.getSheetByName(SHEETS.SLOTS);
  const data = sheet.getDataRange().getValues();
  let removed = 0;
  for (let i = data.length - 1; i >= 1; i--) {   // bottom-up so row numbers stay valid
    const r = data[i];
    if (keys.has(slotKey_(normDate_(r[2]), r[1], r[3]))) { sheet.deleteRow(i + 1); removed++; }
  }
  Logger.log(`Removed ${removed} tournament slots.`);
  uiAlert_(`Removed ${removed} tournament slots.`);
}

// ------------------------------------------------------------
// Helpers (private to this file)
// ------------------------------------------------------------
function slotKey_(date, campus, shift) {
  return [date, campus, shift].map(x => String(x || '').trim().toLowerCase()).join('|');
}

// Dates come back from the Sheet as text (2026-11-09) when the column is
// text, or as Date objects if Sheets auto-formatted the column. Handle both.
function normDate_(v) {
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  return String(v || '').trim().slice(0, 10);
}

function normName_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Exact normalized match first; then "last first" order; then a unique
// last-name match as a fallback (logged so you can check it).
function findAceByName_(aces, name) {
  const target = normName_(name);
  let hit = aces.find(a => normName_(a.name) === target);
  if (hit) return hit;
  const parts = target.split(' ');
  if (parts.length >= 2) {
    const swapped = parts.slice(1).join(' ') + ' ' + parts[0];
    hit = aces.find(a => normName_(a.name) === swapped);
    if (hit) return hit;
    const last = parts[parts.length - 1];
    const byLast = aces.filter(a => normName_(a.name).split(' ').pop() === last);
    if (byLast.length === 1) { Logger.log(`note: "${name}" matched by last name to "${byLast[0].name}"`); return byLast[0]; }
  }
  return null;
}

function uiAlert_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

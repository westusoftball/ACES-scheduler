// ============================================================
// Ack.gs — shift acknowledgement (confirmed / conflict)
// ============================================================
// HOW TO INSTALL (one-time, then redeploy)
//   1. Apps Script editor → "+" next to Files → Script → name it Ack.
//      Paste this whole file. Save.
//   2. In Code.gs, find the switch inside handleRequest and add one line
//      next to the other cases:
//
//        case 'setAck':          result = setAck(p); break;
//        case 'claimSlot':       result = claimSlot(p); break;
//
//   3. Deploy → Manage deployments → pencil icon → Version: New version
//      → Deploy. (Required: the web app only serves the deployed version.)
//
// The first call adds three columns to the Slots tab headers: ack, ackBy,
// ackAt. getAll already returns every column by header name, so the site
// picks them up with no other backend change.
//
//   ack    'confirmed' | 'conflict' | ''   (blank = awaiting reply)
//   ackBy  the ACE id that answered. The site only honours an answer when
//          ackBy still equals the slot's aceId, so a traded shift shows as
//          "awaiting reply" for the new person without any extra logic.
//   ackAt  ISO timestamp of the answer

function setAck(p) {
  if (!p.slotId) return { error: 'slotId required' };
  const status = String(p.status || '');
  if (['confirmed', 'conflict', ''].indexOf(status) < 0) return { error: 'status must be confirmed, conflict, or blank' };

  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.SLOTS);
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];

  // Make sure the three columns exist (added on first use).
  const col = {};
  ['ack', 'ackBy', 'ackAt'].forEach(h => {
    let i = headers.indexOf(h);
    if (i < 0) { i = headers.length; headers.push(h); sheet.getRange(1, i + 1).setValue(h); }
    col[h] = i + 1;   // 1-based for getRange
  });

  const idCol = headers.indexOf('id'), aceCol = headers.indexOf('aceId');
  for (let r = 1; r < data.length; r++) {
    if (data[r][idCol] !== p.slotId) continue;
    const assigned = data[r][aceCol];
    if (!assigned) return { error: 'This shift has no ACE assigned' };
    if (p.aceId && p.aceId !== assigned) return { error: 'This shift is no longer assigned to you — reload the page' };
    sheet.getRange(r + 1, col.ack).setValue(status);
    sheet.getRange(r + 1, col.ackBy).setValue(status ? assigned : '');
    sheet.getRange(r + 1, col.ackAt).setValue(status ? new Date().toISOString() : '');
    return { ok: true, slotId: p.slotId, status };
  }
  return { error: 'Slot not found' };
}

// ============================================================
// claimSlot — "Pick up this shift"
// ============================================================
// Router line for Code.gs (next to the setAck one):
//
//        case 'claimSlot':       result = claimSlot(p); break;
//
// A volunteer takes an OPEN shift, or one whose current ACE has flagged a
// conflict. The slot's aceId becomes the volunteer, the old answer is
// cleared (so it shows "awaiting reply" for them), an approved row is added
// to Trades so history and the daily report stay accurate, and both people
// are emailed. Confirmed or awaiting shifts cannot be taken.

function claimSlot(p) {
  if (!p.slotId || !p.aceId) return { error: 'slotId and aceId required' };
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const aces = sheetToObjects(ss, SHEETS.ACES);
  const volunteer = aces.find(a => a.id === p.aceId);
  if (!volunteer) return { error: 'ACE not found' };

  const sheet = ss.getSheetByName(SHEETS.SLOTS);
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const c = { id: h.indexOf('id'), campus: h.indexOf('campus'), date: h.indexOf('date'), shift: h.indexOf('shift'),
              aceId: h.indexOf('aceId'), ack: h.indexOf('ack'), ackBy: h.indexOf('ackBy'), ackAt: h.indexOf('ackAt') };

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[c.id] !== p.slotId) continue;
    const assigned = row[c.aceId];
    const conflict = c.ack >= 0 && row[c.ack] === 'conflict' && row[c.ackBy] === assigned;
    if (assigned && assigned === volunteer.id) return { error: 'This shift is already yours' };
    if (assigned && !conflict) return { error: 'This shift is not open for pickup — the current ACE has not flagged a conflict' };

    sheet.getRange(r + 1, c.aceId + 1).setValue(volunteer.id);
    [c.ack, c.ackBy, c.ackAt].forEach(i => { if (i >= 0) sheet.getRange(r + 1, i + 1).setValue(''); });

    // Log it as an approved trade, filling columns by header name.
    const tSheet = ss.getSheetByName(SHEETS.TRADES);
    const tH = tSheet.getDataRange().getValues()[0];
    const tradeId = uid();
    const vals = {
      id: tradeId, slotId: p.slotId, fromId: assigned || '', toId: volunteer.id,
      submitterName: volunteer.name, status: 'approved', coordinator: 'Picked up via site',
      notes: assigned ? 'Covered a conflict' : 'Picked up an open shift',
      loggedAt: new Date().toISOString(), token: '', reminderSent: 'true', toSlotId: ''
    };
    tSheet.appendRow(tH.map(k => (k in vals) ? vals[k] : ''));

    const desc = `${fmtDay_(row[c.date])} — ${row[c.campus]} — ${row[c.shift]}`;
    const released = assigned ? aces.find(a => a.id === assigned) : null;
    try {
      if (volunteer.email) GmailApp.sendEmail(volunteer.email,
        `[${LEAGUE_NAME}] You picked up an ACE shift`,
        `Hi ${volunteer.name},\n\nYou are now responsible for this shift:\n\n  📅 ${desc}\n\n${released ? 'It was previously ' + released.name + "'s; they have been told." : 'It was open.'}\n\nPlease open the schedule and confirm it from your profile.\n\n— ${LEAGUE_NAME} Scheduling`);
      if (released && released.email) GmailApp.sendEmail(released.email,
        `[${LEAGUE_NAME}] Your shift has been picked up`,
        `Hi ${released.name},\n\n${volunteer.name} has picked up your shift:\n\n  📅 ${desc}\n\nYou are NO LONGER responsible for it.\n\n— ${LEAGUE_NAME} Scheduling`);
    } catch (e) { Logger.log('claimSlot email failed: ' + e.message); }

    return { ok: true, tradeId, fromId: assigned || '', toId: volunteer.id };
  }
  return { error: 'Slot not found' };
}

// Date cell may be text ('2026-11-09') or a real Date; format either.
function fmtDay_(v) {
  const d = (v instanceof Date) ? v : (() => { const [y, m, dd] = String(v).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, dd); })();
  return isNaN(d) ? String(v) : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

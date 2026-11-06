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

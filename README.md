# ACES Shift Scheduler (WUSA)

Live site: https://westusoftball.github.io/ACES-scheduler/
Repo: https://github.com/westusoftball/ACES-scheduler (moved from cranead/ACES-scheduler; the old URL redirects)

## How it fits together

| Piece | Where it lives | What it does |
|---|---|---|
| `index.html` | this repo, served by GitHub Pages | The whole frontend: schedule grid, profiles, trade requests, coordinator panel |
| `Code.gs` | Google Apps Script project attached to the ACE Scheduler Google Sheet | The backend API (`?action=...`), trade confirmation emails, reminders, daily report |
| Google Sheet | tabs `ACEs`, `Campuses`, `Slots`, `Trades`, `TarpCrew`, `Committees` | The database |

The frontend talks to the backend through `SCRIPT_URL` near the top of the
`<script>` block in `index.html`. Editing `index.html` and committing to `main`
updates the site within about a minute. Editing `Code.gs` requires
**Deploy → Manage deployments → Edit → New version → Deploy** before the change
is live.

The deployed `Code.gs` is the source of truth for the backend. The copy in
`apps-script/` here holds only add-on scripts; paste them into the Apps Script
project as separate files.

## Shift acknowledgement (confirm / conflict)

Each ACE opens **Profile**, picks their name, and clicks **Confirm** or
**Conflict** on each upcoming shift. The schedule colours shifts green
(confirmed), blue (awaiting reply), red (conflict) or amber (open), and lists
conflicts and open shifts under **Needs coverage** at the top. A conflicted
shift has a **Request trade** button that pre-fills the trade form.

The status lives in three columns on the `Slots` tab (`ack`, `ackBy`, `ackAt`),
created automatically on first use. An answer only counts while `ackBy` still
matches the slot's `aceId`, so a traded shift returns to "awaiting reply" for
the new person.

**One-time backend install** (the site shows "Unknown action: setAck" until done):

1. Apps Script → **+** → Script → name it `Ack` → paste `apps-script/Ack.gs` → save.
2. In `Code.gs`, inside the `switch` in `handleRequest`, add:
   ```javascript
   case 'setAck':          result = setAck(p); break;
   ```
3. **Deploy → Manage deployments → pencil → Version: New version → Deploy.**

## Past shifts

The schedule hides dates before today. Tick **Show past shifts** to see the
whole season. Profiles list upcoming shifts first and fold past ones under
"Past shifts". The trade form only offers upcoming shifts.

## Loading the Fall 2026 tournament shifts

`apps-script/Tournament.gs` adds the 27 tournament shifts (Nov 9–14, South
Campus / McGovern / Bayland) to the `Slots` tab and matches each name to an
existing ACE.

1. Open the Sheet → **Extensions → Apps Script**.
2. **+** next to Files → **Script** → name it `Tournament`, paste the file, save.
3. Run `previewTournamentShifts` first. The execution log lists every name as
   `matched` or `UNMATCHED`. Fix any unmatched names (add the ACE in the
   Coordinator tab, or correct the spelling in the table at the top of the file).
4. Run `loadTournamentShifts`. Reload the site.
5. `removeTournamentShifts` deletes exactly those 27 slots if you need to start over.

No redeploy is needed: these functions only write to the Sheet.

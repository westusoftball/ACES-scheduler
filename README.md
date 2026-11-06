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

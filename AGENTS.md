# Instructions for AI coding assistants

This is the private planning tracker for Tin & Michelle's wedding (6 March 2027). Read `README.md` first.
It is a plain HTML, CSS and JavaScript site served by GitHub Pages from `main`: **anything pushed to `main` is live.**

## The requests you will usually get

### Pending items (most common)
The pending items list is `data/tasks.json`. The page only lets people tick items off; **all adding, removing
and rewording goes through you.** Requests come in two forms:

- **Plain words**, for example "add a pending item: book the florist" or "remove the photobooth one".
- **A pasted status note** copied from the tracker. It starts with "Pending items status from the wedding
  tracker" and lists items under `Done:` and `Still open:`. Set `done` to `true` for every item under Done and
  `false` for every item under Still open, matching by text. The user often adds extra changes underneath the
  note in plain words; apply those too.

The file format:

```json
{
  "updated": "8 Oct 2026",
  "items": [
    { "id": "task-1", "text": "Confirm the photobooth vendor", "done": false }
  ]
}
```

- `id` must be unique and must never change once an item exists (people's ticks are stored against it).
  For a new item use the next free `task-N`.
- `text` is one short sentence. `done` is `true` or `false`.
- Set `updated` to today's date in the same style.
- Keep it valid JSON: double quotes, no trailing commas.
- Edit only this file, then commit as `Update pending items` and push. For this one kind of change you do not
  need to ask before pushing.

### "Change the rundown"
Edit the `<ol>` inside `<section id="rundown">` in `index.html`. One line per time slot:
`<li><time>7:05 PM</time><span>Cake cutting.</span></li>`. For sub-points, copy a `schedule-with-notes` item.
Keep times in the `6:00 PM` style. Do not invent timings or programme items; ask if something is unclear.

### "Change the table layout"
Edit `TABLE_ROWS` (and the main table entry) at the top of `app.js`, **and** the `grid-template-areas` for
`.seat-floorplan` in `apple-ui.css`. There are two copies of that grid, one for screen and one inside
`@media print`; change both. Then bump `SEATING_PLAN_VERSION` in `app.js`, and warn the user first:
changing it resets seat plans saved in people's browsers.

## Ground rules

- **Never push without the user's go-ahead**, except for pending-items updates as described above.
- **No build step and no dependencies.** Do not add a framework, bundler or package.json.
- **The design is approved.** Do not restyle anything unless asked for that specific change.
- **No guest data in this repo.** The guest list is read live from a Google Sheet and needs a passcode that
  each person types into the tracker. Never write guest names, phone numbers, emails or the passcode into
  any file, commit message or test.
- **Do not change `RSVP_ENDPOINT`** in `app.js` unless the user says the Sheet's script has been redeployed
  at a new address.
- Seat plans and exported versions live in each person's browser (local storage), not in the repo. There
  is nothing to edit for those.

## Checking a change

Serve the folder (`npx serve .`), open it at phone width and desktop width, and click through all five tabs.
After editing `data/tasks.json`, confirm the Pending Items page lists the items with the right ones ticked.

# Instructions for AI coding assistants

This is the private planning tracker for Tin & Michelle's wedding (6 March 2027). Read `README.md` first.
It is a plain HTML, CSS and JavaScript site served by GitHub Pages from `main`: **anything pushed to `main` is live.**

## The requests you will usually get

### "Update the pending items" (most common)
The user will paste a block exported from the tracker's Pending Items page. It contains a JSON object.

1. Replace the whole contents of `data/tasks.json` with that JSON, exactly as given.
2. Do not edit any other file.
3. Commit with the message `Update pending items` and push.

If the user asks in plain words instead ("add a task to book the florist", "mark the photobooth one as done"),
edit `data/tasks.json` yourself. The format is:

```json
{
  "updated": "8 Oct 2026",
  "items": [
    { "id": "task-1", "text": "Confirm the photobooth vendor", "done": false }
  ]
}
```

- `id` must be unique and must not change once an item exists. For a new item use the next free `task-N`.
- `text` is one short sentence. `done` is `true` or `false`.
- Set `updated` to today's date in the same style.
- Keep it valid JSON: double quotes, no trailing commas.

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

- **Never push without the user's go-ahead**, except for the pending-items update above, which they have
  already asked for by pasting the export.
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
After editing `data/tasks.json`, confirm the Pending Items page lists the items and shows no
"saved in this browser only" notice.

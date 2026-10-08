# Tin & Michelle · Wedding Plan Tracker

A private planning tracker for the couple: overview, rundown, live guest list, seat planner and to-dos.
Plain HTML, CSS and JavaScript with no build step. It is based on Vivien's October wedding tracker.

| File | What it is |
|---|---|
| `index.html` | All five views. The rundown text is edited here |
| `apple-ui.css` | Styling. Colours are the variables at the top; this tracker's additions are at the bottom |
| `app.js` | Seat planner, exported versions, live guest list, pending items |
| `data/tasks.json` | The shared pending items list |
| `AGENTS.md` | Instructions that Codex or Claude read before changing anything |

## What is saved where

- **Pending items:** the list is `data/tasks.json` in this repo, so everyone sees the same items. Ticks made on
  the page are kept in your browser until they are passed on (see below).
- **Seat plan and exported versions:** in the browser you are using (local storage). They do not sync between
  phones or laptops. Clearing site data removes them.
- **Guest list:** read live from the invite's RSVP Google Sheet. Nothing about guests is stored in this repo.

## Guest list

The tracker asks the invite's Sheet script for the responses and sends a passcode with the request. Each person
enters the passcode once per browser (**Guest List → Enter passcode**). The list refreshes every minute while the
page is open, and the last copy is kept in the browser so the seat planner still works offline.

The passcode lives in the Sheet's script under **Project Settings → Script properties** as `TRACKER_KEY`. See the
invite repo's README for the script itself.

## Pending items

- **To add, remove or reword an item,** tell Codex or Claude in plain words, for example "add a pending item:
  confirm the florist". It edits `data/tasks.json` and pushes. There is no add button on the page on purpose,
  so the list is only ever changed in one place.
- **To tick things off,** use the page. Ticks stay in your browser.
- **To share your ticks,** press **Copy status for Codex / Claude** and paste it to the assistant. It lists what
  is done and what is still open, and you can type any other changes underneath before sending.

## Seat planner

- The floor plan follows the venue: buffet along the top, rows A (8 tables), B (7) and C (7) of six seats each,
  and a main table of 12. To change it, edit `TABLE_ROWS` at the top of `app.js` and the `grid-template-areas`
  for `.seat-floorplan` in `apple-ui.css` (there are two copies: screen and print).
- Tap a seat to add a name. Names of attending guests and their plus-ones are suggested as you type.
- **Print / Save PDF** exports the plan with its version label and today's date in the title, and keeps a copy
  under **Exported versions** so an earlier version can be restored. Change the Version field (v1, v2, …) before
  exporting a new one.

## Editing the rundown

Each line in `index.html` is one of these:

```html
<li><time>7:05 PM</time><span>Cake cutting.</span></li>
```

For sub-points, copy one of the `schedule-with-notes` lines.

## Preview locally

Run `npx serve .` in this folder and open the address it prints.

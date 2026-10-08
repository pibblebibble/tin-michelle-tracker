# Tin & Michelle · Wedding Plan Tracker

A private planning tracker for the couple: overview, rundown, live guest list, seat planner, pending items
and an updates page for handing changes to Codex or Claude.
Plain HTML, CSS and JavaScript with no build step. It is based on Vivien's October wedding tracker.

| File | What it is |
|---|---|
| `index.html` | All six views. The rundown text is edited here |
| `apple-ui.css` | Styling. Colours are the variables at the top; this tracker's additions are at the bottom |
| `app.js` | Seat planner, exported versions, live guest list, pending items |
| `data/tasks.json` | The shared pending items list |
| `AGENTS.md` | Instructions that Codex or Claude read before changing anything |

## What is saved where

- **Pending items:** the list is `data/tasks.json` in this repo, so everyone sees the same items.
- **Ticks and update notes:** in your browser until you copy them to the assistant (see Updates below).
- **Seat plan and exported versions:** in the browser you are using (local storage). They do not sync between
  phones or laptops. Clearing site data removes them.
- **Guest list:** read live from the invite's RSVP Google Sheet. Nothing about guests is stored in this repo.

## Guest list

The tracker asks the invite's Sheet script for the responses and sends a passcode with the request. Each person
enters the passcode once per browser (**Guest List → Enter passcode**). The list refreshes every minute while the
page is open, and the last copy is kept in the browser so the seat planner still works offline.

The passcode lives in the Sheet's script under **Project Settings → Script properties** as `TRACKER_KEY`. See the
invite repo's README for the script itself.

## Updates: how changes get made

The tracker is edited by Codex or Claude, not by hand. The **Updates** tab is where you collect what you want
changed and hand it over in one go.

1. On **Updates**, note each change: where it is (Rundown, Pending Items, …), a title, a date or time if there
   is one, and any details. For example: Pending Items · "Cake tasting" · "12 Dec 2026, 3:00 PM" · "Add items:
   confirm flavours, pay deposit".
2. On **Pending Items**, tick off whatever is done.
3. Back on **Updates**, press **Copy for Codex / Claude**. The box above the button shows exactly what is copied:
   your notes plus which pending items are ticked.
4. Paste it to Codex or Claude opened in this folder. It makes the changes and pushes; `AGENTS.md` tells it how.
5. Press **Clear notes** once the changes are live.

Notes and ticks are kept in your browser until then. You can also skip the tab and just tell the assistant in
plain words.

## Pending items

Items are grouped under a date and a title (one card each) and live in `data/tasks.json`. There is no add
button on the page on purpose: the list is only ever changed through the assistant, so it stays in one place.

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

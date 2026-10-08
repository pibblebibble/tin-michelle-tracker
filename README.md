# Tin & Michelle · Wedding Plan Tracker

A private planning tracker for the couple: overview, rundown, live guest list, seat planner and pending items.
Plain HTML, CSS and JavaScript with no build step. It is based on Vivien's October wedding tracker.

| File | What it is |
|---|---|
| `index.html` | All five views. The rundown text is edited here |
| `apple-ui.css` | Styling. Colours are the variables at the top; this tracker's additions are at the bottom |
| `app.js` | Seat planner, exported versions, live guest list, pending items |
| `data/tasks.json` | The shared pending items list |
| `AGENTS.md` | Instructions that Codex or Claude read before changing anything |

## What is saved where

- **Pending items:** the list is `data/tasks.json` in this repo, so everyone sees the same items.
- **Ticks:** in your browser until you copy the page to the assistant (see Pending items below).
- **Seat plan and exported versions:** in the browser you are using (local storage). They do not sync between
  phones or laptops. Clearing site data removes them.
- **Guest list:** read live from the invite's RSVP Google Sheet. Nothing about guests is stored in this repo.

## Passcode

The whole tracker is locked. Opening it shows a passcode screen, and nothing else appears until the passcode is
accepted. It is asked for again in every new browser session (after the tab or browser is closed); **Lock** in the
footer locks it straight away.

The passcode is checked by the RSVP Sheet's script, not by this page, so it is not written anywhere in this repo.
It lives in the Sheet's script under **Project Settings → Script properties** as `TRACKER_KEY`. Change it there
and everyone has to enter the new one.

What this does and does not protect:

- **Guest data is properly protected.** Names, phone numbers and emails are only sent by the Sheet after the
  passcode is accepted.
- **The rest is hidden, not secret.** The rundown and table layout are part of the site's files, and this repo is
  public, so someone who goes looking in the code could read them. The lock keeps out anyone who simply has
  the link.

## Guest list

Once unlocked, the guest list is read live from the invite's RSVP Sheet. It refreshes every minute while the
Guest List tab is open, and the last copy is kept in the browser so the seat planner still works offline.

## Pending items

Items are grouped under a date and a title, one card each, and live in `data/tasks.json`.

- **Tick things off** on the page. Ticks stay in your browser.
- **To change the list** (new items, new dates, new headings, or to save your ticks for everyone), press
  **Copy this page for Codex / Claude**, paste it to the assistant, and type what you want changed underneath.
  You can also just tell the assistant in plain words without copying anything.

There is no add button on the page on purpose, so the list is only ever changed in one place.

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

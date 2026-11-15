# Claude New Tab

A calm, dark new tab page for Chrome (and Edge, Brave, Arc). Living ASCII animals drift
across a dot grid, a quote sits in the middle, a search bar goes to Google, quick links sit
below it, and an "Up next" card shows your Google Calendar.

Plain HTML, CSS and JavaScript. No build step, no npm, no remote code.

---

## Load it

1. Open `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick this folder (`claude-new-tab`).
4. Open a new tab. If Chrome asks whether to keep the new tab page, choose **Keep it**.

After editing any file: click the reload icon on the extension card, then open a new tab.

To work on the page in a normal browser tab: run `python3 -m http.server` in this folder and
open <http://localhost:8000/newtab.html>. (Opening the file directly does not work; browsers block
ES modules from `file://`.) Settings then live in `localStorage` instead of `chrome.storage`.

---

## Using it

| | |
|---|---|
| Type anywhere | Goes into the search bar (Chrome keeps focus in the address bar on new tabs, so this is the shortcut) |
| `Enter` | Google search, or go straight to a URL like `github.com/you` |
| `Cmd/Ctrl + Enter` | Same, in a new tab |
| `yt …` / `gh …` | Search YouTube / GitHub |
| Mic button | Dictate into the search bar (hidden where unsupported, e.g. Brave) |
| Click the background | Scatter the animals (Koi: drop food) |
| Animal pills (top) | Switch animal; remembered for next time |
| Right-click a quick link | Edit, move left/right, remove. Or drag tiles to reorder |
| Sliders button (top right) | Settings |
| `focus 25` (next to the clock) | Start a focus session (see below) |
| Double-click the background | Call a murmuration |
| `?` | Debug overlay: FPS, animal count, script ms per frame |

### Focus tide
Click **focus** next to the clock. Over about ten seconds the animals slow to stillness and dim,
the quote, links and switcher fade back, and a countdown replaces the clock (also shown in the tab
title). Every new tab shows the same session. When time's up, the animals burst back to life. If no
new tab was open at that moment, the burst plays the next time you open one. Session length (15,
25 or 50 minutes) is in Settings.

### Murmurations
Now and then the animals come apart into their own ASCII characters, which swirl together to spell
something in the empty space below the links, hold it for a few seconds, then fly home:
- an event starting within 20 minutes (if the calendar is connected), e.g. "Design review · in 12 min";
- otherwise the time, or the current quote's word (`word` in `js/quotes.js`).

They happen on about 1 in 3 new tabs and on the hour (**Settings → Murmurations**: Off / Sometimes /
Often), never during focus or with reduced motion on. Double-click the background to call one any
time; click while it's showing to scatter it. Tuning lives in `MURMUR` at the top of `js/murmur.js`.

---

## Customising

### Add a quote
Edit `js/quotes.js` and append to `QUOTES`:

```js
{ orig: 'मूळ ओळ', lang: 'mr', text: 'The English line.', src: 'Who said it' },
{ orig: null, lang: null, text: 'An English-only quote.', src: 'Someone' },
```

`lang` is `'sa'` (Sanskrit) or `'mr'` (Marathi) when there is an original line. The last 3
shown are never repeated.

### Add a search prefix
Edit `PREFIXES` in `js/search.js`. It appears in the hint row automatically:

```js
w: { label: 'Wikipedia', url: q => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}` },
```

### Change the default quick links
Edit `DEFAULT_LINKS` in `js/links.js`. These only apply until you edit links on the page
(after that your list is saved). **Settings → Reset to defaults** does not touch links; to get the
default links back, run `chrome.storage.local.remove('links')` in DevTools on the new tab page and reload.

### Tune the animals
- `js/flock.js`, `FLOCK` at the top: things shared by every animal (scatter strength and reach,
  how fast they settle, the no-go zone around the UI, cursor avoidance, edge turning).
- `js/animals/<animal>.js`, `BEHAVIOR` at the top: that animal's speed, spacing (`spread`),
  flocking, wander, and its special moves (dragonfly `dart`, frog `hop`, crab `walk`, koi `seek`,
  crane `formation`, jellyfish `pulse` / `trail`). The ASCII frames are just below.

While tuning, `__engine.FLOCK.scatterImpulse = 1000` in DevTools changes things live.

### Add an animal
1. Copy `js/animals/butterfly.js` to `js/animals/<name>.js`.
2. Change `id`, `label`, `color`, `count`, `sizeRange`, the `frames` and `BEHAVIOR`.
   - Frames are multi-line strings; keep them within ~16 columns × 7 rows. All frames are
     top-aligned, so keep the body on the same row in every frame.
   - Use `String.raw` so backslashes stay as typed.
   - Movement modes: leave `mode` out for flying/swimming (boids). Or use `'dart'`, `'hop'`
     or `'walk'` and copy that block from dragonfly / frog / crab.
   - Sprites face right by default. If yours faces left, set `facing: Math.PI`.
     Side-view sprites that should stay upright: `upright: true, flipX: true`.
3. Import it in `js/animals/index.js` and add it to `ANIMALS`. It shows up in the switcher.

---

## Google Calendar setup

The "Up next" card needs your own Google OAuth client (free, ~15 minutes, once).

1. Reload the extension, open **Settings**, and under **Google Calendar** copy the
   **redirect URI** (looks like `https://<extension-id>.chromiumapp.org/`).
2. Go to <https://console.cloud.google.com/> and create a project.
3. **APIs & Services → Library**: enable the **Google Calendar API**.
4. **OAuth consent screen** (Google Auth Platform): choose **External**, fill in an app name and
   your email, add yourself as a **test user**, and add the scope
   `https://www.googleapis.com/auth/calendar.readonly`.
5. **Credentials → Create credentials → OAuth client ID → Web application**. Under
   **Authorized redirect URIs**, paste the URI from step 1. Create it and copy the **Client ID**.
6. Paste it into `GOOGLE_CLIENT_ID` in `js/config.js`, reload the extension, and click
   **Settings → Connect Google Calendar**. Google will say the app isn't verified; continue.

Notes:
- Read-only access. Tokens last an hour and are renewed silently while you stay signed in to
  Google in this browser. If Google wants you to sign in again, the card shows **Reconnect**.
- While the app is in "Testing", Google may ask you to sign in again about once a week. Publishing
  the app (consent screen → Publish) avoids that; you'll still see the unverified warning once.
- The extension ID of an unpacked extension depends on the folder's location. If you move the
  folder, copy the new redirect URI from Settings into your OAuth client.
- `js/config.js` also sets how many days ahead to look, how many events to show and the refresh
  interval. The card hides on windows narrower than 1180px.

---

## Network and privacy

Nothing loads from the network to draw the page: fonts, icons and code are all bundled.
The only requests are:
- the navigation you trigger (search, links, calendar events);
- Google Calendar API calls, only after you connect it;
- the mic: Chrome's speech recognition sends audio to Google while you dictate.

Settings, links and the chosen animal are stored in `chrome.storage.local`. The calendar token is
kept out of `localStorage`.

Permissions: `storage` (settings) and `identity` (Google sign-in window).

---

## Files

```
manifest.json
newtab.html            page markup
css/style.css          all styles (colour tokens at the top)
js/main.js             boot: wires everything together
js/engine.js           canvas, DPR, fixed-timestep loop, sprite cache + glow, effects
js/flock.js            boids + movement modes + scatter/feed/swarm
js/animals/*.js        one file per animal + index.js registry
js/quotes.js           quotes + no-repeat picker
js/search.js           search bar, prefixes, mic
js/links.js            quick links
js/settings.js         settings panel + defaults
js/focus.js            focus tide: session timer, countdown, sleep/wake
js/murmur.js           murmurations: text → character targets, swirl in/out
js/calendar.js         Google sign-in + "Up next" card
js/config.js           your Google client ID and calendar options
js/clock.js            clock line
js/storage.js          chrome.storage wrapper with localStorage fallback
fonts/                 Inter, JetBrains Mono, Noto Sans Devanagari (woff2)
icons/                 extension icons
```

Performance (measured in headless Chrome on a Mac, "Many" density): 60 fps, 0.1–0.4 ms of script time per
frame for every animal. Sprites are pre-rendered once per (frame, size, colour, glow) and drawn with
`drawImage`; the loop pauses when the tab is hidden.

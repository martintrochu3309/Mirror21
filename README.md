# Mirror 21 · light app design handoff

Everything you need to build the light iPhone version of the course in VS Code.

```
mirror21-design-handoff/
├── index.html     opens the Offer page
├── html/          the app: Offer, My Path (map), Step screens (check-in, watch, learn, act), My Mirror, My Journey, restart
├── Audio-Video/   Step00-Mirror21.mp4 (Welcome) and Step01-Mirror21.mp4
├── assets/
│   ├── step/             Step screens: tokens.css, step.css, step02.css, checkin.css (copied unchanged from the design handoffs), step-app.css, step.js, fonts
│   ├── steps.js          the 21 step titles and which video/lesson each step uses
│   ├── progress.js       course rules and saved progress
│   ├── prototype.js/css  My Path map, My Mirror, My Journey, tabs, reset gear
│   ├── journey.css, opening-pages.css, restart-session.js
│   └── images/           Offer portrait and video posters
├── screens/       screenshots written by the browser test
├── tests/         unit tests and the browser test
├── manifest.webmanifest  makes the Home Screen icon open Mirror 21 as a full-screen app
└── _headers       Netlify: always serve the latest files
```

## Clickable preview

Open `index.html` in a browser, ideally through a local server such as VS Code Live Server so progress persists.

Opening the link goes straight to the Offer page. The preview connects Offer → My Path (map) → Step 01: Watch → Learn → Act → My Path → Step 02: Check in → Watch → Learn → Act → …

## Home Screen app (iPhone)

Every page carries the app manifest (`manifest.webmanifest`) and Apple's web-app tags, so "Add to Home Screen" from Safari gives a **Mirror 21** icon (black square, gold "21", `assets/icons/`) that opens full screen with no Safari bars. The status bar stays white with dark text. Screens keep clear of the clock and the home indicator using the phone's safe areas. Links to other websites (Stripe later) open Safari on top.

iPhones read these settings only when the icon is added: after a deploy that changes them, delete the old icon and add it again.
## Steps

The course is 21 **Steps** (previously "days"), plus **Step 00 · Welcome**. Step 01 is Watch → Learn → Act, built from the Step 01 design handoff (no longer kept in the project; its styles and fonts were copied into `assets/step/`). From Step 02, every step opens with a **Check in** on the previous step, built from the Step 02 check-in design handoff (also copied into `assets/step/`). The app changes these things from the handoffs, by agreement:

- the top bar keeps the app's **continuous progress bar** instead of the 3- or 4-part bar: Watch, Learn and Act each fill a third, and the check-in does not move it;
- there is **no sound button**;
- with no commit time saved (steps committed before `committedAt` existed), the check-in says "Last time you promised:";
- the Done text reads "Step 0N is open. It starts by asking how your step went."

Titles come from `assets/steps.js` (block names are not shown yet). A title that is too long for one line at 22px shrinks just enough to fit. At 390px wide, that is Step 04 (20.7px) and Step 06 (20.9px).

**Content so far:** Step 01 and Step 02 have their own lessons (Step 02 from the Step 02 design handoff, likewise copied into `assets/step/step02.css`). Steps 03–18 reuse Step 01's lesson as placeholders, and Steps 19–21 show "Coming soon" on the map. Every step uses Step 01's video until Kevin films the others. `assets/steps.js` decides each step's video (`media`) and lesson (`lesson` / `page`).

| Screen | Page | Notes |
|---|---|---|
| Check in | `html/step-checkin.html?step=N` | Steps 02+. "DID YOU KEEP YOUR PROMISE?" Shows the previous step's exact promise under MY PROMISE ("Earlier today / Yesterday / On Monday / Last time you promised:"). Just YES, I DID IT · PARTLY · NO: no reply line and no note. The answer saves at once and can change until WATCH, which locks it. Watch, Learn and Act send you back here until it is done. |
| Watch | `html/step-watch.html?step=N` | Square edge-to-edge video, opens Apple's full-screen player. LEARN is outlined until the video ends, then gold; the length shown comes from the file. Nothing under the video. |
| Learn | `html/step-learn.html?step=N` | Five moves, pull quote, example rows. YOUR TURN sits at the end of the content. The bar fills as the reader scrolls. |
| Act | `html/step-act.html?step=N` | Rows unlock one by one; answers save as typed. Each box has a grey sentence starter in front ("Right now, I", "I want to be able to", "Today I will"): the user only finishes the sentence, and the saved answer is the whole sentence. TEST's answer shows a gold tick. Row 05 is MY STEP. The commit section shows MY PROMISE: "Today, I will [their step]." filled in live. I'M COMMITTED (1-second press and hold for now) is greyed out until all three boxes are filled; committing locks the answers for good, shows COMMITTED for 1.5 seconds, then returns to the map with the next step open. |
| Step 02 Learn | `html/step02-learn.html?step=2` | "THERE → PROOF → ONCE." with drawn arrows. Three moves; under THERE, your own Step 01 THERE, read-only ("YOURS · FROM STEP 01"). FAILS / PASSES example with the check-in's empty and full circles, and the "IN THE BOX" sample. |
| Step 02 Act | `html/step02-act.html?step=2` | 01 THERE (read-only, from Step 01) → 02 PROOF: MY ACTION after a grey "Today I will", then "COULD YOU PROVE YOU DID IT?" YES / NOT SURE (NOT SURE goes back to the box with a hint) → 03 ONCE: MY PROMISE forms live, I'M COMMITTED (press and hold) once proof is YES. Committing locks the box, shows COMMITTED, then returns to the map. Act fills its third 35 → 60 → 85 → 100%. Saves `responses[2].ACTION` (typed words only) and the promise word for word for Step 03's check-in. |

Opening `step-learn` or `step-act` for Step 02 (or the Step 02 pages for any other step) redirects to the right page, so links can stay generic.
| Welcome | `html/step-watch.html?step=0` | Watch only, no progress bar, button (MY PATH) returns to the map. Never starts an attempt. |

## Course rules (`assets/progress.js`)

- **Today** = the first step not yet committed. Committing a step opens the next one straight away.
- After HOLD TO COMMIT (which saves `committedAt`), the step's map tile is **committed**: plain white, gold number, no ring. The check-in at the start of the next step then gives it the look of the answer's icon: YES full gold, PARTLY half gold, NO gold ring only. Tapping a done tile shows its card with REDO STEP, which reopens it from Watch to rewatch, reread and see the (locked) Act answers. My Mirror rows open the same way. Redoing never changes the step's check-in or the step that is open now.
- The check-in for Step 21 is still to be designed (it would sit at the start of a step that doesn't exist).
- **Points** = YES 1, PARTLY 0.5, NO 0, out of 21. Saved NOT YET answers from the first Step 02 design read as NO. Follow-through = points ÷ check-ins, rounded; 0% before any check-ins.
- **No time limit.** The course runs until all 21 promises are graded. My Path's header card and My Mirror's third ring count **steps to go** (21 minus committed steps; 19 after Step 02), not days.
- **My Mirror** shows STEPS SO FAR, then three rings (FOLLOW-THROUGH, CHECK-INS, TO GO) and the current week and theme ("WEEK 1 · SEE IT", OWN IT in Week 2, CHANGE IT in Week 3). The step-by-step story lives in My Journey.
- **Demo reset:** a small gear at the top right of My Path, My Mirror and My Journey asks "Reset all steps?" and, on yes, clears this device's answers, check-ins and Welcome video, then opens My Path at Step 01.

Progress lives in this browser's local storage under `mirror21-progress`: per step, `steps[N]` (screen, watched, scroll, Act stage, `checkedIn`, `committedAt`), `responses[N]` (HERE, THERE, STEP, and the optional check-in NOTE), `lessons[N]` (committed) and `answers[N]` (check-in on that step). A new browser or device starts at Step 01. Shared URL fragments never import progress.

## Rules to keep

- **Gold on white:** use `--gold` for fills and `--gold-text` / `--gold-ink` (#896a00) for gold text. Plain `#e0b84c` text on white is unreadable.
- **Map steps and gold map buttons use a 3D lip.** Step screens follow the handoff: no shadows except the video play button.
- **The Offer page is kept as it is.**

## My Journey (`html/19-my-journey.html`)

The third tab (book icon) replaces My Tools. The tabs are **MY PATH** (the map), **MY MIRROR** and **MY JOURNEY**.

- The user's steps as one story, in their own words, read-only. Week dividers ("WEEK 1 · SEE IT", "OWN IT", "CHANGE IT") appear only for weeks reached.
- One entry per committed step on the Act-style rail. The circle is the check-in result: YES full gold, PARTLY half gold, NO gold ring; committed but not yet checked in is plain white with a gold number. The line between two graded steps is gold, otherwise grey.
- The header (a button) shows STEP NN · commit date and the step title. Closed: just the promise. Open: the step's own answers as ruled rows (Step 01 lesson: HERE, THERE, TEST, STEP; Step 02: ACTION, PROOF), then MY PROMISE with a lock and the promise word for word. Check-in notes are not shown yet.
- The page opens on the latest graded step, scrolled to it; several entries can be open at once. Today's step comes last, faded, with a dashed circle. The footer counts the steps left to write.
## Map (`assets/prototype.js`)

- Steps follow a wave of x offsets: `[0, 52, 80, 52, 0, -52, -80, -52]`, 104px per row; WEEK 2 and WEEK 3 dividers before Steps 8 and 15.
- Today's step is bigger and black, with a gold ring showing its progress and a bubble (START / CONTINUE). Tapping it opens a black card with the step title and START STEP (or CONTINUE, which reopens the last screen).
- Locked steps are grey; tapping shows "Opens after Step N".
- On open, the map scrolls so today is centred.
- Until Welcome is done (its video watched to the end, or left with its MY PATH button) and while Step 01 hasn't been started, the START bubble sits on 00 Welcome and the map opens at the top. After that it moves to today's step.

## Placeholders to replace

- Videos for Steps 02–21, and lessons for Steps 03–21 (see **Content so far**).
- Captions (.vtt) for the videos.
- Day 8 history on the static screens 17–18 is sample data.
- **Fonts:** Magistral and Neue Haas Display are licensed fonts; confirm webfont licences with Kevin before public launch.

## Tests

- `node --test tests/*.test.js`: course rules, step catalogue, progress bar, routing, device storage and restart.
- `node tests/browser-smoke.cjs`: runs the real flow in Chrome at phone, iPad and desktop sizes (Welcome, Watch with real playback, Learn, every Act state, hold to commit, Step 02 unlock, the check-in in all three answers with its lock and map tile looks, My Mirror, restart) against a local server that simulates Netlify. It writes phone screenshots to `screens/` (`step-watch-mobile.png`, `step-learn-mobile.png`, `step-act-*.png`, `journey-map-mobile.png` …) for comparison with the design handoffs' screenshots. Requires installed Chrome.

## Deploying on Netlify

Publish this folder as the site root, including `index.html`, `html/`, `assets/`, `Audio-Video/` and `_headers`. No build command is needed. `_headers` tells browsers to revalidate site files. Netlify Pretty URLs are supported (`/html/step-watch` and `/html/step-watch.html` are the same page). After deploying, check that `/Audio-Video/Step01-Mirror21.mp4` plays on the published site.

## Restart this device's session

Open `/html/restart-session` on the device you want to reset. It clears only Mirror 21 course state, bar positions, the Welcome watched flag and scroll positions from that browser, keeps reminder preferences, and opens Step 00 Welcome. Deploying an update by itself does not reset anyone's progress.

# Mirror 21 · light app design handoff

Everything you need to build the light iPhone version of the course in VS Code.

```
mirror21-design-handoff/
├── index.html     opens Sign in (the Offer page is hidden for now)
├── html/          the app: Offer, My Path (map), Step screens (check-in, watch, learn, act), My Mirror, My Journey, restart
├── Audio-Video/   Step00-Mirror21.mp4 (Welcome) and Step01-Mirror21.mp4
├── assets/
│   ├── step/             Step screens: tokens.css, step.css, step02.css, checkin.css (copied unchanged from the design handoffs), watch.css (Watch screen handoff), step-app.css, step.js, fonts
│   ├── steps.js          the 21 step titles, each step's Watch content (video, images, button label) and lesson
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

- there is **no sound button**;
- with no commit time saved (steps committed before `committedAt` existed), the check-in says "Last time you promised:";
- the Done text reads "Step 0N is open. It starts by asking how your step went."

**Step bar:** every step screen shows the handoff's part bar. Step 01 has 3 parts (Watch · Learn · Act); from Step 02 there are 4 (Check in · Watch · Learn · Act). Check in fills once answered, Watch once the video is watched, Learn as the reader scrolls and Act stage by stage (`segments` in `assets/progress.js`). Each part has its name underneath: gold once done, black for the screen you're on (white on Watch), grey still to come. The handoffs' section chip (icon square + CHECK IN / LEARN / ACT) is removed on every step: the labels replace it. The map's ring still uses the overall share (`session`).

Titles come from `assets/steps.js` (block names are not shown yet). A title that is too long for one line shrinks just enough to fit. On the Watch screen (21px) at 390px wide, that is Step 04 (20.4px) and Step 06 (20.6px).

**Content so far:** Steps 01–06 have their own lessons (Step 02 from the Step 02 design handoff, likewise copied into `assets/step/step02.css`; Steps 03–06 from Step 03's layout, in the Step 02 components plus `assets/step/step03.css`). Steps 07–18 reuse Step 01's lesson as placeholders, and Steps 19–21 show "Coming soon" on the map. Steps 01–06 play their portrait videos (`Audio-Video/StepNN-Watch.mp4`: 720×1280 H.264/AAC, saved with "faststart" so playback begins before the whole file loads; 1:45, 1:18, 1:18, 1:25, 1:38, 1:13). Each has its first frame as start image and its last frame as finish image (`assets/images/stepNN-start.jpg` / `-finish.jpg`), so nothing jumps; in `steps.js` a filmed step is one line, `filmed(N, 'm:ss')`. Welcome and Steps 07–18 show Step 01's start image and "VIDEO COMING SOON" with an 8-second simulated playback. For each new video: portrait 720×1280 MP4, a URL-safe name (`StepNN-Watch.mp4`), `ffmpeg -i in.mp4 -c copy -movflags +faststart StepNN-Watch.mp4`, a first-second frame as its start image, and its last frame (`ffmpeg -sseof -0.3 -i StepNN-Watch.mp4 -update 1 -q:v 3 stepNN-finish.jpg`) as its finish image. `assets/steps.js` decides each step's Watch content (`watch`: video, start image, finish image, length, button label) and lesson (`lesson` / `page`). To add a video, set its `video` there (for example `'../Audio-Video/Step01-Watch.mp4'`): the placeholder goes away by itself and the length comes from the file.

| Screen | Page | Notes |
|---|---|---|
| Check in | `html/step-checkin.html?step=N` | Steps 02+. "DID YOU KEEP YOUR PROMISE?" Shows the previous step's exact promise under MY PROMISE ("Earlier today / Yesterday / On Monday / Last time you promised:"). Just YES, I DID IT · PARTLY · NO: no reply line and no note. The answer saves at once and can change until WATCH, which locks it. Watch, Learn and Act send you back here until it is done. |
| Watch | `html/step-watch.html?step=N` | From the Watch screen design handoff: full-screen portrait video played in the page (never Apple's full-screen player). **Start:** still image, step bar, "STEP 0N OF 21", one-line title, frosted play button dead centre, "BEST WITH SOUND · 1:45". **Mid:** after 2 seconds only the X and a thin gold line remain; tapping anywhere pauses and brings the title back. **Finish:** the video's last frame (each step's `finish` image), dimmed, so nothing jumps when it ends; "WATCHED ✓", Watch part of the bar gold, WATCH AGAIN and a LEARN button (Welcome: MY PATH) in the app's gold gradient with a black label and no arrow, like YOUR TURN (agreed change from the handoff's deep gold #aa8107 and "LEARN THE 5 MOVES →"). The button only appears at Finish, once 90% has actually been watched; there is no scrubbing. Leaving mid-video offers "RESUME · 0:48"; a watched step opens at Finish (and keeps its button when paused on a rewatch). The button fades to white into Learn. Safari's bar turns black on this screen only. |
| Learn | `html/step-learn.html?step=N` | Five moves, pull quote, example rows. YOUR TURN sits at the end of the content. The bar fills as the reader scrolls. |
| Act | `html/step-act.html?step=N` | Rows unlock one by one; answers save as typed. Each box has a grey sentence starter in front ("Right now, I", "I want to be able to", "Today I will"): the user only finishes the sentence, and the saved answer is the whole sentence. TEST's answer shows a gold tick. Row 05 is MY STEP. The commit section shows MY PROMISE: "Today, I will [their step]." filled in live. I'M COMMITTED (1-second press and hold for now) is greyed out until all three boxes are filled; committing locks the answers for good, shows COMMITTED for 1.5 seconds, then returns to the map with the next step open. |
| Step 02 Learn | `html/step02-learn.html?step=2` | "THERE → PROOF → ONCE." with drawn arrows. Three moves; under THERE, your own Step 01 THERE, read-only ("YOURS · FROM STEP 01"). FAILS / PASSES example with the check-in's empty and full circles, and the "IN THE BOX" sample. |
| Step 02 Act | `html/step02-act.html?step=2` | 01 THERE (read-only, from Step 01) → 02 PROOF: MY ACTION after a grey "Today I will", then "COULD YOU PROVE YOU DID IT?" YES / NOT SURE (NOT SURE goes back to the box with a hint) → 03 ONCE: MY PROMISE forms live, I'M COMMITTED (press and hold) once proof is YES. Committing locks the box, shows COMMITTED, then returns to the map. Act fills its third 35 → 60 → 85 → 100%. Saves `responses[2].ACTION` (typed words only) and the promise word for word for Step 03's check-in. |
| Step 03 Learn | `html/step03-learn.html?step=3` | "Pick one move". Opens straight on the moves (no title): 01 OPTIONS, 02 IMPACT, 03 START, then "Doing more isn't progress. Doing what matters is." EXAMPLE: THERE, OPTIONS (three choices in one box, the picked one in light gold with a tick), IMPACT, START (in the box). Gold YOUR TURN at the end. |
| Step 03 Act | `html/step03-act.html?step=3` | 01 THERE (read-only, from Step 01) → 02 IMPACT: MY MOVE after a grey "The move that matters most is" → 03 START: MY ACTION after "Today I will", then "COULD YOU PROVE YOU DID IT?" YES / NOT SURE → MY PROMISE (lock on the rail), built from MY ACTION only, I'M COMMITTED. Act fills 10 → 35 → 60 → 85 → 100%. Saves `responses[3].MOVE` and `.ACTION` (typed words only); Step 04's check-in grades the promise. A starter too long to leave room for a word puts the answer on the line below it. |
| Steps 04–06 | `html/step0N-learn.html` / `step0N-act.html` | Same layout and logic as Step 03 (one shared Act function, `twoBoxActScreen` in `step.js`, set per step: where the read-only answer comes from, which box NOT SURE returns to, the promise sentence). **04** Focus on what you control: SPOT / SORT / CONTROL; example sorts CONTROL (picked), INFLUENCE, OUT OF MY HANDS (parked); Act shows MY MOVE from Step 03 in the user's own words, then WHAT'S IN THE WAY (`WAY`), MY ACTION (`ACTION`), "IS IT IN YOUR CONTROL?"; promise "Today, I will [action]." **05** Pause before you react: PAUSE / CHOOSE / RESPOND; Act: MY MOMENT after "When" (`MOMENT`), MY RESPONSE after "I will pause and" (`RESPONSE`), "WILL YOU KNOW THE MOMENT WHEN IT COMES?" (NOT SURE returns to MY MOMENT); promise "Today, when [moment], I will pause and [response]. If it doesn't come, I'll run through it once in my head." (the whole sentence is what Step 06's check-in grades). **06** Change your surroundings: SPOT / SHAPE / USE; Act: WHAT MAKES IT EASY (`EASY`), MY CHANGE (`CHANGE`), "COULD YOU PROVE YOU DID IT?"; promise "Today, I will [change]." Saved promises can be up to 600 characters. |

Opening `step-learn` or `step-act` for Steps 02 and 03 (or their pages for any other step) redirects to the right page, so links can stay generic.
| Welcome | `html/step-watch.html?step=0` | The same Watch screen ("STEP 00 OF 21"), no step bar; its Finish button (MY PATH) returns to the map. Never starts an attempt. |

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
- **Into Watch:** when the card's button leads to Watch (Step 01 and Welcome START, CONTINUE on Watch, REDO STEP), the card grows to fill the screen (0.35s). On that black, Watch fades in the X, step bar, "STEP 0N OF 21" and title (0.2s), then Kevin's image once loaded (0.6s), then the play button and hint, or WATCH AGAIN and the button at Finish (0.2s). Nothing but the X can be tapped until then. With reduce motion it's one 0.3s fade. It only plays from the map (a one-time note in session storage, used up by any step page): not on Watch Again, resuming, Back or reload. Buttons leading to Check in, Learn or Act open as before.
- Locked steps are grey; tapping shows "Opens after Step N".
- On open, the map scrolls so today is centred.
- Until Welcome is done (its video watched to the end, or left with its MY PATH button) and while Step 01 hasn't been started, the START bubble sits on 00 Welcome and the map opens at the top. After that it moves to today's step.

## Placeholders to replace

- Portrait videos (720×1280) for Welcome and Steps 02–21, and lessons for Steps 03–21 (see **Content so far**). The square videos in `Audio-Video/` and the square posters in `assets/images/` are no longer used.
- Captions (.vtt) for the videos.
- Day 8 history on the static screens 17–18 is sample data.
- **Fonts:** Magistral and Neue Haas Display are licensed fonts; confirm webfont licences with Kevin before public launch.

## Tests

- `node --test tests/*.test.js`: course rules, step catalogue, progress bar, routing, device storage and restart.
- `node tests/browser-smoke.cjs`: runs the real flow in Chrome at phone, iPad and desktop sizes (Welcome, Watch with real playback, Learn, every Act state, hold to commit, Step 02 unlock, the check-in in all three answers with its lock and map tile looks, My Mirror, restart) against a local server that simulates Netlify. It writes phone screenshots to `screens/` (`step-watch-mobile.png`, `step-learn-mobile.png`, `step-act-*.png`, `journey-map-mobile.png` …) for comparison with the design handoffs' screenshots. Requires installed Chrome.

## Deploying on Netlify

Publish this folder as the site root, including `index.html`, `html/`, `assets/`, `Audio-Video/` and `_headers`. No build command is needed. `_headers` tells browsers to revalidate site files. Netlify Pretty URLs are supported (`/html/step-watch` and `/html/step-watch.html` are the same page). After deploying, check that `/Audio-Video/Step01-Watch.mp4` plays on the published site.

## Restart this device's session

Open `/html/restart-session` on the device you want to reset. It clears only Mirror 21 course state, bar positions, the Welcome watched flag and scroll positions from that browser, keeps reminder preferences, and opens Step 00 Welcome. Deploying an update by itself does not reset anyone's progress.

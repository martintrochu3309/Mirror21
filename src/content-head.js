/* Every step's own content, gathered by tools/build.js from src/steps/stepNN/step.js: edit those files, then run
   node tools/build.js. Never edit this file by hand.
   Each step's fields:
   - title     the step's name (the Watch screen and the map card show it, My Journey too).
   - watch     the video's length, shown before it loads: '1:24' for Audio-Video/StepNN-Watch.mp4 with its first and
               last frames as assets/images/stepNN-start.jpg / -finish.jpg; or { filmed: '1:24', cover: 24 } to set
               how much of the screen the black fade at the bottom covers (30% unless set); Welcome sets its own.
   - skill     the skill the block summary lists for this step: [NAME, line].
   - examples  "See an example" on Act, per answer box (its data-answer, data-field or id, in capitals): the words that
               finish the box's sentence starter. A box without one shows no link.
   - act       Steps 03–21 (assets/screens/act.js): from, the step the read-only answers come from; back, the box NOT
               SURE sends you back to; promise, built from the boxes (numbers are answer boxes, in page order) and
               earlier answers ({ from: step, key }); a function of the answers when it depends on a choice.
   - journal   My Journey and Save my journal as PDF: the step's own answers as [label, sentence] rows. r is the step's
               saved answers; said(label, starter, key) puts a typed answer back after its sentence starter; proof is
               the PROOF row; plainDate reads a saved date in words. Empty rows are left out. */
(function (root) {
  const steps = {};
  const step = (n, content) => { steps[n] = content; };

/* STEPS */
  const api = { steps };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MirrorContent = api;
})(globalThis);

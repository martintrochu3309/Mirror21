const { test } = require('node:test');
const assert = require('node:assert/strict');
const model = require('../assets/progress.js');
const now = Date.UTC(2026, 9, 7, 12);
const DAY = 86400000;
const commit = (state, ...steps) => steps.forEach(step => { state.lessons[step] = true; });

test('committing a step opens the next one before any check-in', () => {
  const state = model.fresh(now);
  assert.equal(model.stats(state, now).today, 1);
  commit(state, 1);
  assert.equal(model.stats(state, now).today, 2);
  assert.equal(model.stats(state, now).checkIns, 0);
  assert.equal(model.session(state, 1).label, 'CHECK IN');
  assert.equal(model.session(state, 1).ratio, 1);
  assert.equal(model.session(state, 2).label, 'START');
});

test('check-ins need a committed step and can change until WATCH locks them', () => {
  const state = model.fresh(now);
  assert.equal(model.record(state, 1, 'yes', now), false, 'Step 01 is not committed yet');
  commit(state, 1, 2, 3);
  assert.equal(model.record(state, 1, 'notyet', now), false, 'NO replaced NOT YET');
  assert.equal(model.record(state, 1, 'no', now), true);
  assert.equal(model.record(state, 1, 'yes', now), true, 'The answer can change before WATCH');
  state.steps[2] = { checkedIn: true };
  assert.equal(model.checkInLocked(state, 1), true);
  assert.equal(model.record(state, 1, 'no', now), false, 'WATCH locks the answer');
  assert.equal(state.answers[1], 'yes');
  assert.equal(model.record(state, 4, 'no', now), false);
  assert.equal(model.record(state, 2, 'partly', now), true);
  assert.equal(model.record(state, 3, 'no', now), true);
  const stats = model.stats(state, now);
  assert.equal(stats.checkIns, 3);
  assert.equal(stats.points, 1.5);
  assert.equal(stats.percent, 50);
  assert.equal(stats.today, 4);
  assert.equal(stats.stepsToGo, 18, 'Three steps committed');
});

test('there is no time limit: check-ins still save long after the start', () => {
  const state = model.fresh(now - 400 * DAY);
  commit(state, 1);
  assert.equal(model.stats(state).active, true);
  assert.equal(model.record(state, 1, 'yes'), true);
  assert.equal(model.stats(state).daysLeft, undefined);
});

test('steps to go count down as steps are committed, and the week follows today', () => {
  const state = model.fresh(now);
  assert.equal(model.stats(state).stepsToGo, 21);
  assert.equal(model.stats(state).week, 1);
  commit(state, 1, 2);
  assert.equal(model.stats(state).stepsToGo, 19, 'After Step 02: 19 steps to go');
  commit(state, 3, 4, 5, 6, 7);
  assert.equal(model.stats(state).week, 2, 'Step 08 is in Week 2');
  for (let step = 8; step <= 14; step++) commit(state, step);
  assert.equal(model.stats(state).week, 3);
});

test('follow-through: YES 100%, PARTLY 50%, NO 0%, averaged over graded promises', () => {
  const state = model.fresh(now);
  commit(state, 1, 2, 3);
  model.record(state, 1, 'partly');
  assert.equal(model.stats(state).percent, 50, 'One PARTLY is 50%');
  model.record(state, 2, 'yes');
  assert.equal(model.stats(state).percent, 75);
  model.record(state, 3, 'no');
  assert.equal(model.stats(state).percent, 50);
});

test('21 check-ins complete the course without creating step 22', () => {
  const state = model.fresh(now);
  for (let step = 1; step <= 21; step++) { commit(state, step); assert.equal(model.record(state, step, 'yes', now), true); }
  const stats = model.stats(state, now);
  assert.equal(stats.today, null);
  assert.equal(stats.complete, true);
  assert.equal(stats.active, false);
  assert.equal(stats.percent, 100);
  assert.equal(stats.stepsToGo, 0);
  assert.equal(model.record(state, 22, 'yes', now), false);
});

test('handoff example is 79 percent with seven check-ins', () => {
  const state = model.fresh(now - 7 * DAY);
  ['yes', 'yes', 'partly', 'yes', 'no', 'yes', 'yes'].forEach((answer, i) => { commit(state, i + 1); model.record(state, i + 1, answer, now); });
  const stats = model.stats(state, now);
  assert.equal(stats.percent, 79);
  assert.equal(stats.checkIns, 7);
});

test('restoring stored progress rejects invalid answers and keeps the start time', () => {
  const state = model.normalize({ version: 1, startedAt: now - DAY, answers: { 1: 'invalid', 2: 'no', 3: 'notyet', 22: 'yes' }, lessons: { 1: true, 2: 'bad' }, change: 'x'.repeat(700) }, now);
  assert.deepEqual(state.answers, { 2: 'no', 3: 'no' }, 'Saved NOT YET answers become NO');
  assert.deepEqual(state.lessons, { 1: true });
  assert.equal(state.change.length, 600);
  assert.equal(state.startedAt, now - DAY);
});

test('the bar fills a third each for Watch, Learn and Act, then completes on commit', () => {
  const state = model.fresh(now);
  assert.equal(model.session(state, 1).ratio, 0);
  state.steps[1] = { screen: 'watch', reached: 0, watch: 0.5, watched: false, learn: 0, stage: 0, notSure: false };
  assert.equal(model.session(state, 1).label, 'CONTINUE');
  assert.equal(model.session(state, 1).ratio, 0.5 / 3);
  Object.assign(state.steps[1], { screen: 'learn', reached: 1, learn: 0.5 });
  assert.equal(model.session(state, 1).ratio, 1.5 / 3);
  assert.equal(model.session(state, 1).screen, 'learn');
  Object.assign(state.steps[1], { screen: 'act', reached: 2 });
  model.ACT_PROGRESS.forEach((pct, stage) => {
    state.steps[1].stage = stage;
    assert.ok(Math.abs(model.session(state, 1).ratio - (2 + pct / 100) / 3) < 1e-9);
  });
  commit(state, 1);
  assert.equal(model.session(state, 1).ratio, 1);
  assert.equal(model.session(state, 2).ratio, 0);
  // Step 02's Act sets its own share: 35 → 60 → 85 → 100%.
  state.steps[2] = { screen: 'act', reached: 2, watch: 1, watched: true, learn: 1, stage: 1, notSure: false, checkedIn: true, act: 0.6 };
  assert.ok(Math.abs(model.session(state, 2).ratio - 2.6 / 3) < 1e-9);
  assert.equal(model.normalize(JSON.parse(JSON.stringify(state)), now).steps[2].act, 0.6);
});

test('the step bar: Watch · Learn · Act, Check in first from Step 02; Watch fills only once watched', () => {
  const state = model.fresh(now);
  assert.deepEqual(model.segments(state, 1), [0, 0, 0]);
  assert.deepEqual(model.segments(state, 2), [0, 0, 0, 0]);
  state.steps[1] = { screen: 'watch', reached: 0, watch: 0.5, watched: false, learn: 0, stage: 0, notSure: false };
  assert.deepEqual(model.segments(state, 1), [0, 0, 0], 'Half-watched leaves Watch empty');
  state.steps[1].watched = true;
  assert.deepEqual(model.segments(state, 1), [1, 0, 0]);
  Object.assign(state.steps[1], { screen: 'learn', reached: 1, learn: 0.5 });
  assert.deepEqual(model.segments(state, 1), [1, 0.5, 0]);
  Object.assign(state.steps[1], { screen: 'act', reached: 2, stage: 2 });
  assert.deepEqual(model.segments(state, 1), [1, 1, model.ACT_PROGRESS[2] / 100]);
  commit(state, 1);
  assert.deepEqual(model.segments(state, 1), [1, 1, 1]);
  // Step 02: answering the check-in fills its part; Watch is the second part.
  model.record(state, 1, 'yes');
  assert.deepEqual(model.segments(state, 2), [1, 0, 0, 0]);
  state.steps[2] = { screen: 'watch', reached: 0, watch: 1, watched: true, learn: 0, stage: 0, notSure: false, checkedIn: true };
  assert.deepEqual(model.segments(state, 2), [1, 1, 0, 0]);
});

test('step progress survives storage and rejects bad values', () => {
  const state = model.fresh(now);
  state.steps[1] = { screen: 'act', reached: 2, watch: 1, watched: true, learn: 1, stage: 3, notSure: true, checkedIn: false, committedAt: '2026-10-07T20:15:00.000Z' };
  state.steps[2] = { screen: 'nowhere', reached: 9, watch: 4, watched: 'yes', learn: -1, stage: 12, checkedIn: 1, committedAt: 'soon' };
  state.responses[1] = { HERE: 'Here one', THERE: 'There one', STEP: 'Step one', NOTE: 'Ran out of time' };
  const restored = model.normalize(JSON.parse(JSON.stringify(state)), now);
  assert.deepEqual(restored.steps[1], state.steps[1]);
  assert.deepEqual(restored.steps[2], { screen: 'checkin', reached: 2, watch: 1, watched: false, learn: 0, stage: 6, notSure: false, checkedIn: false });
  assert.deepEqual(restored.responses[1], state.responses[1]);
});

test('saved check-ins retain each step\'s written change without changing counts on review', () => {
  const state = model.fresh(now);
  commit(state, 1, 2);
  state.change = 'Walk before work.';
  assert.equal(model.record(state, 1, 'yes', now), true);
  state.change = 'Read for ten minutes.';
  assert.equal(model.record(state, 2, 'partly', now), true);
  assert.equal(state.dayChanges[1], 'Walk before work.');
  assert.equal(state.dayChanges[2], 'Read for ten minutes.');
  state.steps[2] = { checkedIn: true }; state.steps[3] = { checkedIn: true };
  const restored = model.normalize(JSON.parse(JSON.stringify(state)), now);
  assert.deepEqual(restored.dayChanges, state.dayChanges);
  assert.equal(model.record(restored, 1, 'no', now), false);
  assert.equal(restored.answers[1], 'yes');
  assert.equal(model.stats(restored, now).checkIns, 2);
  assert.equal(model.stats(restored, now).percent, 75);
});

test('each new step starts blank and returning to a step restores only its own writing', () => {
  const state = model.fresh(now);
  state.change = 'An earlier chosen change';
  state.dayChanges[1] = 'Walk before work.';
  assert.equal(model.writtenChange(state, 1), 'Walk before work.');
  assert.equal(model.writtenChange(state, 2), '');
  state.dayChanges[2] = 'Read ten pages.';
  assert.equal(model.writtenChange(state, 1), 'Walk before work.');
  assert.equal(model.writtenChange(state, 2), 'Read ten pages.');
  assert.equal(model.writtenChange(state, 3), '');
  const restored = model.normalize(JSON.parse(JSON.stringify(state)), now);
  assert.equal(model.writtenChange(restored, 2), 'Read ten pages.');
  assert.equal(model.writtenChange(restored, 3), '');
  restored.answers[4] = 'yes';
  assert.equal(model.writtenChange(restored, 4), 'An earlier chosen change');
});

test('from Step 02 the step opens on its check-in, which does not move the bar', () => {
  const state = model.fresh(now);
  assert.equal(model.session(state, 1).screen, 'watch');
  assert.equal(model.needsCheckIn(state, 1), false, 'Step 01 has no check-in');
  commit(state, 1);
  assert.equal(model.session(state, 2).screen, 'checkin');
  assert.equal(model.needsCheckIn(state, 2), true);
  state.steps[2] = { screen: 'checkin', reached: 0, watch: 0, watched: false, learn: 0, stage: 0, notSure: false, checkedIn: false };
  model.record(state, 1, 'partly', now);
  assert.equal(model.session(state, 2).ratio, 0);
  assert.equal(model.needsCheckIn(state, 2), true, 'Answering alone does not open Watch');
  state.steps[2].checkedIn = true;
  assert.equal(model.needsCheckIn(state, 2), false);
  assert.equal(model.session(state, 2).ratio, 0);
});

test('Step 00 is excluded from course scoring, lessons and completion', () => {
  const state = model.fresh(now);
  assert.equal(model.record(state, 0, 'yes', now), false);
  const restored = model.normalize({ ...state, answers: { 0: 'yes' }, lessons: { 0: true }, steps: { 0: { screen: 'act' } } }, now);
  assert.deepEqual(restored.answers, {}); assert.deepEqual(restored.lessons, {}); assert.deepEqual(restored.steps, {});
  assert.equal(model.stats(restored, now).checkIns, 0); assert.equal(model.stats(restored, now).today, 1);
});

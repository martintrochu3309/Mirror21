/* /dashboard (html/dashboard.html): asks Supabase's dashboard_stats() for the numbers (admins only), then draws them.
   On a computer (file:, localhost) there is no Supabase to ask: it draws made-up sample data, clearly marked, so the
   page can be checked. Needs auth.js (signed in), supabase-js and dashboard-stats.js loaded first. */
(() => {
  const auth = MirrorAuth, stats = MirrorDashboardStats;
  const $ = id => document.getElementById(id);
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
  const pad = n => String(n).padStart(2, '0');
  const onComputer = /^(file:|https?:\/\/(localhost|127\.0\.0\.1)[:/])/.test(location.href);
  let client = null, summary = null, idleDays = 0;
  // Only black, white, grey and the wordmark's gold. The parts of a step, from not opened to Act.
  const PART_COLOURS = { 'Not opened': 'var(--grey-1)', 'Check in': 'var(--grey-2)', Watch: 'var(--grey-3)', Learn: 'var(--gold)', Act: 'var(--ink)' };

  function say(text) { $('message').hidden = !text; $('message').textContent = text || ''; }

  async function load() {
    $('refresh').disabled = true;
    say('');
    try {
      let learners;
      if (onComputer) {
        // preview.html sets how many made-up buyers (and the random mix) per phone, or shows the "not on the team" screen.
        let setting = {};
        try { setting = JSON.parse(localStorage.getItem('mirror21-dashboard-sample')) || {}; } catch {}
        if (setting.denied) { $('content').hidden = true; $('updated').textContent = ''; say('This page is for the Mirror 21 team. Sign in with a team email to see it.'); return; }
        learners = sample(Number.isInteger(setting.buyers) ? setting.buyers : 40, Number(setting.seed) || 7);
      } else {
        client ||= globalThis.supabase.createClient(auth.url, auth.key, { auth: { storageKey: auth.storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
        const { data, error } = await client.rpc('dashboard_stats');
        if (error) {
          $('content').hidden = true; $('updated').textContent = '';
          say(error.code === '42501' ? 'This page is for the Mirror 21 team. Sign in with a team email to see it.' : 'The numbers couldn’t be loaded. Check your connection and tap Refresh.');
          return;
        }
        learners = data?.learners || [];
      }
      summary = stats.summarize(learners);
      draw();
      $('updated').textContent = (onComputer ? 'Sample data (on a computer). ' : '') + 'Updated ' + new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '.';
      $('content').hidden = false;
    } catch {
      say('The numbers couldn’t be loaded. Check your connection and tap Refresh.');
    } finally {
      $('refresh').disabled = false;
      document.documentElement.dataset.mirrorReady = 'true';
    }
  }

  function draw() {
    const t = summary.totals;
    const share = n => t.buyers ? Math.round(n / t.buyers * 100) + '% of buyers' : '';
    $('tiles').replaceChildren(...[
      ['BUYERS', t.buyers, t.test ? t.test + ' test purchase' + (t.test === 1 ? '' : 's') : 'All real purchases'],
      ['SIGNED IN', t.signedIn, share(t.signedIn)],
      ['STARTED', t.started, share(t.started)],
      ['ACTIVE THIS WEEK', t.active7, 'Did something in the last 7 days'],
      ['FINISHED 21', t.finished, share(t.finished)]
    ].map(([label, value, sub]) => { const tile = el('div', 'tile'); tile.append(el('p', 'tile-label', label), el('p', 'tile-value', String(value)), el('p', 'tile-sub', sub)); return tile; }));

    drawDonuts();
    const steps = Array.from({ length: 21 }, (_, i) => i + 1);
    columns($('completedChart'), steps.map(d => ({ tick: pad(d), value: summary.completed[d], tip: 'Step ' + pad(d) + ': <b>' + summary.completed[d] + '</b> committed' })),
      { table: ['Step', 'Committed'], empty: 'Nobody has committed a step yet.' });
    drawStops();
    columns($('dayChart'), steps.map(d => ({ tick: pad(d), value: summary.averageDay[d] || 0, tip: summary.averageDay[d] ? 'Step ' + pad(d) + ': committed on <b>Day ' + summary.averageDay[d] + '</b> on average' : 'Step ' + pad(d) + ': nobody yet' })),
      { title: 'On average, the day each step is committed', table: ['Step', 'Average day'], empty: 'No step committed yet.', guide: 21 });
    columns($('finishChart'), summary.finish.map(b => ({ tick: b.label, value: b.count, tip: b.label + ' days: <b>' + b.count + '</b> ' + (b.count === 1 ? 'person' : 'people') })),
      { title: 'Days to finish all 21 steps' + (summary.finishAverage ? ' (average: Day ' + summary.finishAverage + ')' : ''), table: ['Days', 'People'], empty: 'Nobody has finished yet.', few: true });
    drawKept();
    drawPeople();
  }

  // A column chart: bars from the baseline, the value on hover, focus or tap, and a table under it. A column with
  // segments ([name, count, colour], bottom first) is stacked; keys: the legend above it; tableNode: its own table.
  function columns(box, data, { title, table, tableNode, keys, empty, guide, few } = {}) {
    box.replaceChildren();
    const wrap = el('div', 'chart');
    if (title) wrap.append(el('p', 'chart-title', title));
    if (keys) {
      const list = el('ul', 'keys');
      keys.forEach(([name, colour]) => { const li = el('li'), key = el('i'); key.style.background = colour; li.append(key, name); list.append(li); });
      wrap.append(list);
    }
    const max = Math.max(0, ...data.map(d => d.value));
    if (!max) { wrap.append(el('p', 'empty', empty)); box.append(wrap); return; }
    const top = niceTop(Math.max(max, guide || 0));
    const plot = el('div', 'plot');
    [top, top / 2].forEach(value => { const line = el('div', 'gridline'); line.style.bottom = (value / top * 100) + '%'; line.append(el('span', '', fmt(value))); plot.append(line); });
    const tip = el('div', 'tip'); tip.hidden = true;
    data.forEach(d => {
      const col = el('div', 'col');
      col.tabIndex = 0;
      col.setAttribute('role', 'img');
      col.setAttribute('aria-label', d.tip.replace(/<[^>]+>/g, ''));
      const bar = el('div', 'bar' + (d.segments ? ' stack' : ''));
      bar.style.height = (d.value / top * 100) + '%';
      (d.segments || []).forEach(([, n, colour]) => {
        if (!n) return;
        const part = el('i');
        part.style.background = colour;
        part.style.flex = n + ' 1 0';
        bar.append(part);
      });
      col.append(bar);
      const show = () => {
        plot.querySelectorAll('.col.is-on').forEach(c => c.classList.remove('is-on'));
        col.classList.add('is-on');
        tip.innerHTML = d.tip; tip.hidden = false;
        const p = plot.getBoundingClientRect(), c = col.getBoundingClientRect();
        const x = Math.min(Math.max(c.left + c.width / 2 - p.left, 70), p.width - 70);
        tip.style.left = x + 'px'; tip.style.top = (c.bottom - p.top - c.height * (d.value / top)) + 'px';
      };
      const hide = () => { col.classList.remove('is-on'); tip.hidden = true; };
      col.addEventListener('mouseenter', show); col.addEventListener('focus', show);
      col.addEventListener('mouseleave', hide); col.addEventListener('blur', hide);
      col.addEventListener('click', show);
      plot.append(col);
    });
    plot.append(tip);
    const ticks = el('div', 'ticks' + (few ? '' : ' many'));
    data.forEach(d => ticks.append(el('span', '', d.tick)));
    wrap.append(plot, ticks);
    if (table || tableNode) {
      const details = el('details', 'table'); details.append(el('summary', '', 'Show as a table'));
      const scroll = el('div', 'scroll');
      scroll.append(tableNode || tableOf(table, data.map(d => [d.tick, d.value ? fmt(d.value) : '–'])));
      details.append(scroll);
      wrap.append(details);
    }
    box.append(wrap);
  }
  // AT A GLANCE: where everyone is, and the part of the step people are in.
  function drawDonuts() {
    const t = summary.totals, inProgress = t.started - t.finished;
    const parts = Object.fromEntries(stats.PARTS.map(p => [p, 0]));
    summary.stops.forEach(s => { parts[s.part]++; });
    $('donuts').replaceChildren(
      donut('Where everyone is', 'buyers', [
        ['Not signed in', t.buyers - t.signedIn, 'var(--grey-1)'], ['Signed in, not started', Math.max(0, t.signedIn - t.started), 'var(--grey-2)'],
        ['In progress', inProgress, 'var(--gold)'], ['Finished 21', t.finished, 'var(--ink)']]),
      donut('Where people are in a step', 'in progress', stats.PARTS.map(p => [p, parts[p], PART_COLOURS[p]]))
    );
  }
  // A donut: slices [name, count, colour] in the order given, a 2px white gap between them, the total in the middle,
  // and a legend with every count and share.
  function donut(title, unit, slices, reversed) {
    const card = el('div', 'donut-card');
    card.append(el('h3', '', title));
    const total = slices.reduce((sum, [, n]) => sum + n, 0);
    const colour = i => slices[i][2];
    const pct = n => total ? Math.round(n / total * 100) + '%' : '–';
    const body = el('div', 'donut-body'), ring = el('div', 'donut');
    const NS = 'http://www.w3.org/2000/svg', R = 50, C = 2 * Math.PI * R;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 128 128');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', title + ': ' + slices.map(([name, n]) => name + ' ' + n).join(', '));
    const tip = el('div', 'tip'); tip.hidden = true;
    const base = document.createElementNS(NS, 'circle');
    base.setAttribute('cx', 64); base.setAttribute('cy', 64); base.setAttribute('r', R);
    base.setAttribute('style', 'fill:none;stroke:var(--line);stroke-width:22');
    svg.append(base);
    let offset = 0;
    const gap = slices.filter(([, n]) => n > 0).length > 1 ? 2 : 0;
    slices.forEach(([name, n], i) => {
      if (!n) return;
      const length = n / total * C;
      const arc = document.createElementNS(NS, 'circle');
      arc.setAttribute('class', 'slice');
      arc.setAttribute('cx', 64); arc.setAttribute('cy', 64); arc.setAttribute('r', R);
      arc.setAttribute('stroke-dasharray', Math.max(0.5, length - gap) + ' ' + (C - Math.max(0.5, length - gap)));
      arc.setAttribute('stroke-dashoffset', String(-offset));
      arc.style.stroke = colour(i);
      const mid = (offset + length / 2) / C * 2 * Math.PI;
      arc.addEventListener('mouseenter', () => {
        arc.classList.add('is-on');
        tip.innerHTML = '';
        tip.append(el('b', '', name), ': ' + n + ' (' + pct(n) + ')');
        const box = ring.getBoundingClientRect(), cardBox = card.getBoundingClientRect();
        tip.style.left = (box.left - cardBox.left + box.width / 2 + Math.cos(mid) * box.width * 0.42) + 'px';
        tip.style.top = (box.top - cardBox.top + box.height / 2 + Math.sin(mid) * box.height * 0.42 - 6) + 'px';
        tip.hidden = false;
      });
      arc.addEventListener('mouseleave', () => { arc.classList.remove('is-on'); tip.hidden = true; });
      svg.append(arc);
      offset += length;
    });
    const middle = el('div', 'donut-mid');
    middle.append(el('b', '', String(total)), el('span', '', unit));
    ring.append(svg, middle);
    const legend = el('ul', 'legend');
    const order = slices.map((s, i) => [s, i]);
    (reversed ? order.reverse() : order).forEach(([[name, n], i]) => {
      const li = el('li'), key = el('i');
      key.style.background = colour(i);
      li.append(key, el('span', 'name', name), el('span', 'count', String(n)), el('span', 'pct', pct(n)));
      legend.append(li);
    });
    body.append(ring, legend);
    card.append(body, tip);
    if (!total) card.append(el('p', 'empty', 'Nothing to show yet.'));
    return card;
  }

  // A round top for the axis, just above the tallest bar: 1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40…
  function niceTop(max) {
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(m => m * step).find(n => n >= max && Number.isInteger(n / 2)) || Math.ceil(max);
  }
  const fmt = n => Number.isInteger(n) ? String(n) : n.toFixed(1);

  function tableOf(head, rows, heat) {
    const table = el('table');
    const tr = el('tr'); head.forEach(h => tr.append(el('th', '', h)));
    const thead = el('thead'); thead.append(tr);
    const tbody = el('tbody');
    const max = heat ? Math.max(1, ...rows.flatMap(r => r.slice(1, heat + 1).map(Number).filter(Number.isFinite))) : 0;
    rows.forEach(row => {
      const line = el('tr');
      row.forEach((cell, i) => {
        const td = el('td', '', cell);
        const n = Number(cell);
        if (heat && i >= 1 && i <= heat) {
          if (!n) td.classList.add('zero');
          else { td.classList.add('heat'); td.style.background = 'rgba(var(--cell), ' + (0.1 + 0.45 * n / max).toFixed(2) + ')'; }
        }
        line.append(td);
      });
      tbody.append(line);
    });
    table.append(thead, tbody);
    return table;
  }

  function drawStops() {
    document.querySelectorAll('.switch button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.idle) === idleDays)));
    const rows = stats.stopTable(summary.stops, idleDays);
    const byStep = Object.fromEntries(rows.map(r => [r.step, r]));
    // One column per step: how many are on it, split by the part they got to (not opened at the bottom, Act on top).
    const data = Array.from({ length: 21 }, (_, i) => i + 1).map(step => {
      const r = byStep[step], total = r?.total || 0;
      const lines = r ? stats.PARTS.filter(p => r[p]).map(p => p + ': <b>' + r[p] + '</b>').join('<br>') : '';
      return {
        tick: pad(step), value: total,
        segments: stats.PARTS.map(p => [p, r?.[p] || 0, PART_COLOURS[p]]),
        tip: 'Step ' + pad(step) + ': <b>' + total + '</b> ' + (total === 1 ? 'person' : 'people') + (lines ? '<br>' + lines : '')
      };
    });
    columns($('stopsChart'), data, {
      keys: stats.PARTS.map(p => [p, PART_COLOURS[p]]),
      empty: idleDays ? 'Nobody idle that long.' : 'Nobody is part-way through the steps.',
      tableNode: rows.length ? tableOf(['Step', ...stats.PARTS, 'Total'], rows.map(r => ['Step ' + pad(r.step), ...stats.PARTS.map(p => r[p]), r.total]), stats.PARTS.length) : null
    });
  }

  function drawKept() {
    const rows = Array.from({ length: 21 }, (_, i) => i + 1).map(d => {
      const a = summary.answers[d], checked = a.yes + a.partly + a.no;
      const kept = checked ? Math.round((a.yes + a.partly / 2) / checked * 100) + '%' : '–';
      return ['Step ' + pad(d), summary.completed[d], a.yes, a.partly, a.no, summary.completed[d] - checked, kept];
    });
    $('keptTable').replaceChildren(tableOf(['Step', 'Promised', 'Yes', 'Partly', 'No', 'Not checked yet', 'Kept'], rows));
  }

  // One row per buyer, newest first; the first 20, then SHOW ALL.
  function drawPeople(all = false) {
    const rows = summary.people.slice().reverse().map(p => ['Learner ' + p.n + (p.test ? ' (test)' : ''), p.signedIn ? 'Yes' : 'No', p.done + ' / 21', p.day ? 'Day ' + p.day : '–', p.idle == null ? '–' : p.idle === 0 ? 'Today' : p.idle + ' day' + (p.idle === 1 ? '' : 's') + ' ago', p.where]);
    if (!rows.length) { $('peopleTable').replaceChildren(el('p', 'empty', 'No buyers yet.')); return; }
    const shown = all ? rows : rows.slice(0, 20);
    const parts = [tableOf(['Learner', 'Signed in', 'Steps done', 'On', 'Last active', 'Where'], shown)];
    if (rows.length > shown.length) {
      const more = el('button', 'more', 'Show all ' + rows.length);
      more.type = 'button';
      more.addEventListener('click', () => drawPeople(true));
      parts.push(more);
    }
    $('peopleTable').replaceChildren(...parts);
  }

  // Made-up buyers for checking the page on a computer: random but repeatable (the same seed gives the same data).
  // Most sign in, most start; each step loses a few; some take days off; a few are idle for a week or more.
  function sample(count, seed) {
    const DAY = 86400000, now = Date.now(), out = [];
    let s = seed % 2147483647 || 7; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < count; i++) {
      const paid = now - Math.floor(rand() * 70) * DAY - Math.floor(rand() * DAY);
      const signedIn = rand() < 0.9, started = signedIn && rand() < 0.9;
      if (!started) { out.push({ paid_at: paid, test: i < 2, signed_in: signedIn, saved_at: null, started_at: null, finished_at: null, steps: {} }); continue; }
      const start = paid + Math.floor(rand() * 3) * DAY, steps = {};
      const keepGoing = 0.86 + rand() * 0.12; // how likely this person goes on after each step
      let t = start, d = 1;
      for (; d <= 21; d++) {
        if (d > 1) t += (rand() < 0.7 ? 1 : 2 + Math.floor(rand() * 4)) * DAY;
        if (t > now || (d > 1 && rand() > keepGoing)) break;
        const r = rand();
        steps[d] = { committed: true, committed_at: new Date(t + rand() * DAY / 2).toISOString(), opened: true, checked_in: d >= 2, reached: 2 };
        if (d < 21 || rand() < 0.7) steps[d].answer = r < 0.6 ? 'yes' : r < 0.83 ? 'partly' : 'no';
      }
      const done = d - 1;
      if (done < 21 && rand() < 0.85) {
        const r = rand();
        steps[done + 1] = r < 0.15 ? { opened: false } : { opened: true, checked_in: done + 1 === 1 || r > 0.35, reached: r < 0.55 ? 0 : r < 0.8 ? 1 : 2 };
        if (done && steps[done]) delete steps[done].answer; // not checked in yet: no answer on the last promise
      }
      const last = done ? Date.parse(steps[done].committed_at) : start;
      out.push({ paid_at: paid, test: i < 2, signed_in: true, saved_at: Math.min(now, last + Math.floor(rand() * rand() * 14) * DAY), started_at: start, finished_at: done === 21 && rand() < 0.8 ? now - DAY : null, steps });
    }
    return out;
  }

  $('refresh').addEventListener('click', load);
  document.querySelector('.switch').addEventListener('click', event => {
    const button = event.target.closest('button[data-idle]');
    if (!button || !summary) return;
    idleDays = Number(button.dataset.idle);
    drawStops();
  });
  load();
})();

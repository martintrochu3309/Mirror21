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

  function say(text) { $('message').hidden = !text; $('message').textContent = text || ''; }

  async function load() {
    $('refresh').disabled = true;
    say('');
    try {
      let learners;
      if (onComputer) learners = sample();
      else {
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

  // A column chart, one series: bars from the baseline, the value on hover, focus or tap, and a table under it.
  function columns(box, data, { title, table, empty, guide, few } = {}) {
    box.replaceChildren();
    const wrap = el('div', 'chart');
    if (title) wrap.append(el('p', 'chart-title', title));
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
      const bar = el('div', 'bar');
      bar.style.height = (d.value / top * 100) + '%';
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
    if (table) {
      const details = el('details', 'table'); details.append(el('summary', '', 'Show as a table'));
      details.append(tableOf(table, data.map(d => [d.tick, d.value ? fmt(d.value) : '–'])));
      wrap.append(details);
    }
    box.append(wrap);
  }
  // A round top for the axis: 1, 2, 5, 10, 20, 50…
  function niceTop(max) {
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    return [1, 2, 5, 10].map(m => m * step).find(n => n >= max) || max;
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
    const box = $('stopsTable');
    if (!rows.length) { box.replaceChildren(el('p', 'empty', idleDays ? 'Nobody idle that long.' : 'Nobody is part-way through the steps.')); return; }
    box.replaceChildren(tableOf(['Step', ...stats.PARTS, 'Total'], rows.map(r => ['Step ' + pad(r.step), ...stats.PARTS.map(p => r[p]), r.total]), stats.PARTS.length));
  }

  function drawKept() {
    const rows = Array.from({ length: 21 }, (_, i) => i + 1).map(d => {
      const a = summary.answers[d], checked = a.yes + a.partly + a.no;
      const kept = checked ? Math.round((a.yes + a.partly / 2) / checked * 100) + '%' : '–';
      return ['Step ' + pad(d), summary.completed[d], a.yes, a.partly, a.no, summary.completed[d] - checked, kept];
    });
    $('keptTable').replaceChildren(tableOf(['Step', 'Promised', 'Yes', 'Partly', 'No', 'Not checked yet', 'Kept'], rows));
  }

  function drawPeople() {
    const rows = summary.people.map(p => ['Learner ' + p.n + (p.test ? ' (test)' : ''), p.signedIn ? 'Yes' : 'No', p.done + ' / 21', p.day ? 'Day ' + p.day : '–', p.idle == null ? '–' : p.idle === 0 ? 'Today' : p.idle + ' day' + (p.idle === 1 ? '' : 's') + ' ago', p.where]);
    $('peopleTable').replaceChildren(rows.length ? tableOf(['Learner', 'Signed in', 'Steps done', 'On', 'Last active', 'Where'], rows) : el('p', 'empty', 'No buyers yet.'));
  }

  // Made-up data for checking the page on a computer.
  function sample() {
    const DAY = 86400000, now = Date.now(), out = [];
    let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 40; i++) {
      const start = now - Math.floor(5 + rand() * 50) * DAY, reach = Math.min(21, Math.floor(Math.pow(rand(), 0.8) * 24)), steps = {};
      let t = start;
      for (let d = 1; d <= reach; d++) {
        t += (rand() < 0.75 ? 1 : 2 + Math.floor(rand() * 3)) * DAY * (d === 1 ? 0 : 1);
        if (t > now) break;
        const r = rand();
        steps[d] = { committed: true, committed_at: new Date(t).toISOString(), opened: true, checked_in: d >= 2, reached: 2, answer: d < reach || rand() < 0.5 ? (r < 0.6 ? 'yes' : r < 0.85 ? 'partly' : 'no') : undefined };
      }
      const next = Object.keys(steps).length + 1;
      if (next <= 21 && rand() < 0.8) steps[next] = { opened: true, checked_in: rand() < 0.7, reached: Math.floor(rand() * 3) };
      out.push({ paid_at: start - DAY, test: i < 3, signed_in: rand() < 0.95, saved_at: Math.min(now, t + Math.floor(rand() * 9) * DAY), started_at: rand() < 0.92 ? start : null, finished_at: steps[21] ? t : null, steps });
    }
    return out.map(l => l.started_at ? l : { ...l, steps: {} });
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

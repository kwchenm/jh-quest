/* 瀏覽器端自動試玩（開發用，不會部署）：
   在本機開啟網站後，於主控台執行  await import('/scripts/autoplay.js')  再呼叫  await __autoAll()
   會把每顆星球的完整任務（對話 → 實驗室 → 知識碎片 → 小遊戲 → Boss 戰）實際點過一遍。 */
(() => {
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = t => String(t).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const tx = el => norm(el.textContent);
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
let DATA = null;
async function load() {
  if (DATA) return DATA;
  const man = await (await fetch('data/manifest.json')).json(); DATA = { units: {}, lessons: {}, list: [] };
  for (const s of man.subjects) {
    const bank = await (await fetch('data/' + s.file)).json(), les = await (await fetch('data/' + s.lessons)).json();
    bank.units.forEach(u => { DATA.units[u.id] = u; DATA.list.push(u.id); });
    Object.assign(DATA.lessons, les.lessons);
  }
  return DATA;
}
async function playOne(uid, part = 'all') {
  const D = await load(), U = D.units[uid], L = D.lessons[uid], seen = new Set();
  const have = new Set(U.q.map(q => q[0]));
  const qs = U.q.map(q => ({ q: q[0], right: q[1] })).concat(L.cards.filter(c => c.chk && !have.has(c.chk[0])).map(c => ({ q: c.chk[0], right: c.chk[1] })));
  window.__fast = true;
  const ov = document.querySelector('.ov'); if (ov) ov.remove();
  location.hash = '#/'; await sleep(40); location.hash = `#/play/${uid}/${part}`; await sleep(60);
  for (let step = 0; step < 900; step++) {
    await sleep(35);
    const res = $('.result');
    if (res && $('.result .pl.big')) {
      const stars = ($('.result > div.big')?.textContent || '').replace(/\s/g, '');
      return { uid, ok: stars.startsWith('★★★') || part !== 'all', stars, title: $('.result h1').textContent, seen: [...seen] };
    }
    if ($('#dn')) { seen.add('dialog'); $('#dn').click(); continue; }
    if ($('.lab')) {
      seen.add('lab');
      if ($('#lnext')) { $('#lnext').click(); continue; }
      const h = window.__lab; h.lab.missions[h.mi()].sol(h.s); h.check(); continue;
    }
    if ($('.tiles') || ($('.lcard') && $('#go') && !$('.scan') && !$('.chk'))) {
      seen.add('restore');
      const cur = $('.blank.cur');
      if (cur) { const t = $$('.tile2:not([disabled])').find(b => b.textContent === cur.dataset.a); if (!t) return { uid, err: 'restore tile missing: ' + cur.dataset.a }; t.click(); }
      else if ($('#go')) $('#go').click();
      continue;
    }
    if ($('.chk')) {
      seen.add('quick');
      const card = L.cards.find(c => c.t === tx($('.lcard h2')));
      const go = $('#go'); if (go && !go.disabled) { go.click(); continue; }
      const o = $$('.chk .opt').find(b => tx(b) === norm(card.chk[1])); if (!o) return { uid, err: 'quick option missing' }; o.click(); continue;
    }
    if ($('.scan')) {
      seen.add('scan');
      const card = L.cards.find(c => c.t === tx($('.lcard h2')));
      if ($('#go')) { $('#go').click(); continue; }
      const ask = $('.sinfo.ask');
      if (ask) { const i = card.flip.findIndex(f => norm(f[1]) === tx(ask)); if (i < 0) return { uid, err: 'scan ask not found' }; $(`.orb2[data-i="${i}"]`).click(); continue; }
      const o = $('.orb2:not(.seen)'); if (o) o.click(); continue;
    }
    if ($('.gm')) {
      const g = L.game;
      if ($('.mc')) { seen.add('memory'); const c = $$('.mc:not(.ok)'); if (!c.length) continue; const p = c[0].dataset.p, pair = c.filter(b => b.dataset.p === p); if (pair.some(b => b.classList.contains('on'))) { await sleep(60); continue; } pair[0].click(); pair[1].click(); continue; }
      if ($('.bb')) { seen.add('bubbles'); const i = g.pairs.findIndex(p => norm(p[0]) === tx($('#bt2'))); const b = $(`.bb[data-p="${i}"]:not([disabled])`); if (b) b.click(); continue; }
      if ($('.sky')) { seen.add('meteor'); const m = $('.met:not(.boom)'); if (m) $(`.bk[data-k="${m.dataset.k}"]`).click(); else if ($('#res')) $('#res').click(); continue; }
      if ($('.st2')) { seen.add('stars'); const b = $$('.st2').find(x => +x.dataset.k === $$('.st2.on').length); if (b) b.click(); continue; }
      if ($('.sent')) { seen.add('sentence'); const want = g.items[$$('.w.on').length]; const b = $$('.chip2:not([disabled])').find(x => x.textContent === want); if (b) b.click(); continue; }
      if ($('.tile')) { seen.add('link'); const l = $('.tile[data-s=l]:not([disabled])'); if (l) { l.click(); $(`.tile[data-s=r][data-i="${l.dataset.i}"]`).click(); } continue; }
    }
    if (res && $('#go')) { $('#go').click(); continue; }            // 小遊戲結算
    if ($('.bt')) {
      seen.add('boss');
      if ($('#nx')) { $('#nx').click(); continue; }
      const qb = $('.qbox'); if (!qb || $('.opt:disabled')) continue;
      const q = qs.find(x => x.q.trim() === qb.textContent.trim()); if (!q) return { uid, err: 'boss question not found: ' + qb.textContent.slice(0, 30) };
      const tfc = $('.tfc');
      if (tfc) { seen.add('tf'); const cand = tfc.textContent.replace('👉', '').trim(); $(`.opt[data-tf="${cand === q.right.trim() ? 1 : 0}"]`).click(); }
      else { const o = $$('.opts .opt').find(b => b.children[1].textContent.trim() === q.right.trim()); if (!o) return { uid, err: 'boss right option missing' }; o.click(); }
      continue;
    }
  }
  return { uid, err: 'timeout', at: document.querySelector('#sc')?.textContent.slice(0, 60) };
}
window.__playOne = playOne;
window.__autoAll = async (filter = () => true) => {
  const D = await load(); window.__auto = { done: false, bad: [], n: 0, kinds: {} };
  for (const uid of D.list.filter(filter)) {
    const r = await playOne(uid); window.__auto.n++;
    (r.seen || []).forEach(k => { window.__auto.kinds[k] = (window.__auto.kinds[k] || 0) + 1; });
    if (!r.ok) window.__auto.bad.push(r);
  }
  window.__auto.done = true; return window.__auto;
};
})();

/* 瀏覽器端自動試玩（開發用，不會部署）：
   在本機開啟網站後，於主控台執行  await import('/scripts/autoplay.js')  再呼叫  await __autoAll()
   會把每顆星球的完整任務（對話 → 實驗室 → 知識碎片 → 小遊戲 → Boss 戰）實際點過一遍。
   __autoAll(() => true, {wrong: true})：每個作答關卡都先故意答錯一次，檢查有沒有顯示「為什麼錯」。 */
(() => {
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = t => String(t).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const tx = el => norm(el ? el.textContent : '');
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
// 公布答案後：每個選項都要有說明（判斷題則看下方說明框）
function whyMissing(root) {
  if (root.querySelector('.tfc')) { const t = tx(root.querySelector('#after .exp')); return t.includes('「') && t.length > 12 ? null : '判斷題沒有說明'; }
  const os = [...root.querySelectorAll('.opt')]; if (!os.length) return '找不到選項';
  const bad = os.find(b => !b.querySelector('.why') || tx(b.querySelector('.why')).replace(/^[✔✘]\s*/, '').length < 2);
  return bad ? '選項缺少說明：' + tx(bad).slice(0, 24) : null;
}
const noteOK = () => { const n = $('#sc .exp.err'); return !!n && tx(n).length > 8; };
async function playOne(uid, part = 'all', wrong = false) {
  const D = await load(), U = D.units[uid], L = D.lessons[uid], seen = new Set(), did = new Set();
  const once = k => wrong && !did.has(k) && !!did.add(k);           // 每個關卡只故意答錯一次
  const have = new Set(U.q.map(q => q[0]));
  const qs = U.q.map(q => ({ q: q[0], right: q[1] })).concat(L.cards.filter(c => c.chk && !have.has(c.chk[0])).map(c => ({ q: c.chk[0], right: c.chk[1] })));
  window.__fast = true;
  const ov = document.querySelector('.ov'); if (ov) ov.remove();
  location.hash = '#/'; await sleep(40); location.hash = `#/play/${uid}/${part}`; await sleep(60);
  let checked = 0;
  for (let step = 0; step < 1500; step++) {
    await sleep(35);
    const res = $('.result');
    if (res && $('.result .pl.big')) {
      const stars = ($('.result > div.big')?.textContent || '').replace(/\s/g, '');
      return { uid, ok: stars.startsWith('★★★') || part !== 'all', stars, title: $('.result h1').textContent, seen: [...seen], checked };
    }
    if ($('#dn')) { seen.add('dialog'); $('#dn').click(); continue; }
    if ($('.lab')) {
      seen.add('lab');
      if ($('#lnext')) { $('#lnext').click(); continue; }
      const h = window.__lab; h.lab.missions[h.mi()].sol(h.s); h.check(); continue;
    }
    if ($('.chk')) {                                                // 快問：選 → 確定 → 讀說明 → 收進圖鑑
      seen.add('quick');
      const nx = $('#nx'); if (nx) { if (!nx.disabled) { const e = whyMissing($('.chk')); if (e) return { uid, err: e }; checked++; nx.click(); } continue; }
      const cf = $('#cf'); if ($('.chk .opt.sel') && cf && !cf.disabled) { cf.click(); continue; }
      const card = L.cards.find(c => c.t === tx($('.lcard h2'))), bad = once('q:' + card.t);
      const o = $$('.chk .opt').find(b => (tx(b.querySelector('.ot')) === norm(card.chk[1])) !== bad); if (!o) return { uid, err: 'quick option missing' }; o.click(); continue;
    }
    if ($('.tiles') || ($('.lcard') && $('#go') && !$('.scan'))) {
      seen.add('restore');
      const cur = $('.blank.cur');
      if (cur) {
        const tiles = $$('.tile2:not([disabled])');
        if (!$('.tiles.hold') && once('r:' + tx($('.lcard h2')))) { const w = tiles.find(b => b.textContent !== cur.dataset.a); if (w) { w.click(); if (!noteOK()) return { uid, err: 'restore 答錯沒有說明' }; checked++; continue; } }
        const t = tiles.find(b => b.textContent === cur.dataset.a); if (!t) return { uid, err: 'restore tile missing: ' + cur.dataset.a }; t.click();
      } else if ($('#go')) $('#go').click();
      continue;
    }
    if ($('.scan')) {
      seen.add('scan');
      const card = L.cards.find(c => c.t === tx($('.lcard h2')));
      if ($('#go')) { $('#go').click(); continue; }
      const ask = $('.sinfo.ask');
      if (ask) {
        const i = card.flip.findIndex(f => norm(f[1]) === tx(ask)); if (i < 0) return { uid, err: 'scan ask not found' };
        if (!$('.orbs.hold') && once('s:' + card.t)) { const w = $$('.orb2').find(o => +o.dataset.i !== i); if (w) { w.click(); if (!noteOK()) return { uid, err: 'scan 答錯沒有說明' }; checked++; continue; } }
        $(`.orb2[data-i="${i}"]`).click(); continue;
      }
      const o = $('.orb2:not(.seen)'); if (o) o.click(); continue;
    }
    if ($('.gm')) {
      const g = L.game, bad = () => once('game'), chk = () => { if (!noteOK()) return { uid, err: '小遊戲答錯沒有說明' }; checked++; return null; };
      if ($('.mc')) { seen.add('memory'); const c = $$('.mc:not(.ok)'); if (!c.length) continue; const p = c[0].dataset.p, pair = c.filter(b => b.dataset.p === p); if (pair.some(b => b.classList.contains('on'))) { await sleep(60); continue; } pair[0].click(); pair[1].click(); continue; }
      if ($('.bb')) { seen.add('bubbles'); const i = g.pairs.findIndex(p => norm(p[0]) === tx($('#bt2')));
        if (bad()) { const w = $$('.bb:not([disabled])').find(x => +x.dataset.p !== i); if (w) { w.click(); const e = chk(); if (e) return e; await sleep(40); continue; } }
        const b = $(`.bb[data-p="${i}"]:not([disabled])`); if (b) b.click(); continue; }
      if ($('.sky')) { seen.add('meteor'); const m = $('.met:not(.boom)');
        if (m && m.style.animationPlayState !== 'paused' && bad()) { const w = $$('.bk').find(x => x.dataset.k !== m.dataset.k); if (w) { w.click(); const e = chk(); if (e) return e; continue; } }
        if (m) $(`.bk[data-k="${m.dataset.k}"]`).click(); else if ($('#res')) $('#res').click(); continue; }
      if ($('.st2')) { seen.add('stars'); const n = $$('.st2.on').length;
        if (bad()) { const w = $$('.st2:not(.on)').find(x => +x.dataset.k !== n); if (w) { w.click(); const e = chk(); if (e) return e; await sleep(40); continue; } }
        const b = $$('.st2').find(x => +x.dataset.k === n); if (b) b.click(); continue; }
      if ($('.sent')) { seen.add('sentence'); const want = g.items[$$('.w.on').length];
        if (bad()) { const w = $$('.chip2:not([disabled])').find(x => x.textContent !== want); if (w) { w.click(); const e = chk(); if (e) return e; await sleep(40); continue; } }
        const b = $$('.chip2:not([disabled])').find(x => x.textContent === want); if (b) b.click(); continue; }
      if ($('.tile')) { seen.add('link'); const l = $('.tile[data-s=l]:not([disabled])');
        if (l && bad()) { l.click(); const w = $(`.tile[data-s=r]:not([disabled]):not([data-i="${l.dataset.i}"])`); if (w) { w.click(); const e = chk(); if (e) return e; await sleep(40); continue; } }
        if (l) { l.click(); $(`.tile[data-s=r][data-i="${l.dataset.i}"]`).click(); } continue; }
    }
    if (res && $('#go')) { $('#go').click(); continue; }            // 小遊戲結算
    if ($('.bt')) {                                                 // Boss：選 → 確定 → 讀說明 → 繼續
      seen.add('boss');
      const nx = $('#nx'); if (nx) { if (!nx.disabled) { const e = whyMissing($('#qa')); if (e) return { uid, err: e }; checked++; nx.click(); } continue; }
      const qb = $('.qbox'); if (!qb) continue;
      const cf = $('#cf'); if ($('#qa .opt.sel') && cf && !cf.disabled) { cf.click(); continue; }
      const qt = qb.textContent.trim(), q = qs.find(x => x.q.trim() === qt); if (!q) return { uid, err: 'boss question not found: ' + qt.slice(0, 30) };
      const b = once('boss'), tfc = $('.tfc');
      if (tfc) { seen.add('tf'); const cand = tfc.textContent.replace('👉', '').trim(); $(`.opt[data-tf="${(cand === q.right.trim()) !== b ? 1 : 0}"]`).click(); }
      else { const o = $$('#qa .opts .opt').find(x => (x.querySelector('.ot').textContent.trim() === q.right.trim()) !== b); if (!o) return { uid, err: 'boss option missing' }; o.click(); }
      continue;
    }
  }
  return { uid, err: 'timeout', at: document.querySelector('#sc')?.textContent.slice(0, 80) };
}
window.__playOne = playOne;
window.__autoAll = async (filter = () => true, opt = {}) => {
  const D = await load(); window.__auto = { done: false, bad: [], n: 0, kinds: {}, checked: 0 };
  for (const uid of D.list.filter(filter)) {
    const r = await playOne(uid, 'all', !!opt.wrong); window.__auto.n++; window.__auto.checked += r.checked || 0;
    (r.seen || []).forEach(k => { window.__auto.kinds[k] = (window.__auto.kinds[k] || 0) + 1; });
    if (!r.ok) window.__auto.bad.push(r);
  }
  window.__auto.done = true; return window.__auto;
};
})();

/* 瀏覽器端自動試玩（開發用，不會部署）：
   在本機開啟網站後，於主控台執行  await import('/scripts/autoplay.js')  再呼叫  await __autoAll()
   會把每顆星球的完整任務（對話 → 實驗室 → 知識碎片 → 小遊戲 → Boss 戰）實際點過一遍。
   每次按「確定作答」後，都會檢查畫面有停下來顯示說明、要按「下一題」才會繼續（不會自動跳題）。
   __autoAll(() => true, {wrong: true})：每個關卡都先故意答錯一次，檢查有沒有顯示「為什麼錯」。 */
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
class Stop extends Error {}
async function playOne(uid, part = 'all', wrong = false) {
  const D = await load(), U = D.units[uid], L = D.lessons[uid], seen = new Set(), did = new Set();
  const once = k => wrong && !did.has(k) && !!did.add(k);           // 每個關卡只故意答錯一次
  const qs = U.q.map(q => ({ q: q[0], right: q[1] })).concat(L.cards.filter(c => c.chk).map(c => ({ q: c.chk[0], right: c.chk[1] })));
  let checked = 0, wrongSeen = 0, gw = null;
  const commit = (b, where) => { b.click(); if (!$('#sc #nx')) throw new Stop(where + '：按了確定作答，卻沒有停下來顯示說明'); };
  window.__fast = true;
  const ov = document.querySelector('.ov'); if (ov) ov.remove();
  location.hash = '#/'; await sleep(40); location.hash = `#/play/${uid}/${part}`; await sleep(60);
  try {
    for (let step = 0; step < 3000; step++) {
      await sleep(30);
      const res = $('.result');
      if (res && $('.result .pl.big')) {
        const stars = ($('.result > div.big')?.textContent || '').replace(/\s/g, '');
        return { uid, ok: (stars.startsWith('★★★') || part !== 'all') && (!wrong || wrongSeen >= 3), stars, title: $('.result h1').textContent, seen: [...seen], checked, wrongSeen };
      }
      const nx = $('#sc #nx');                                        // 判定之後：一定要有說明，按「下一題」才繼續
      if (nx) {
        if (nx.disabled) continue;
        const fb = $('#sc .exp.good, #sc .exp.err'); if (!fb) return { uid, err: '判定後沒有說明' };
        if ($('.bt') || $('.chk')) { const e = whyMissing($('.bt') ? $('#qa') : $('.chk')); if (e) return { uid, err: e }; }
        if (fb.classList.contains('err')) wrongSeen++;
        checked++; nx.click(); continue;
      }
      if ($('#dn')) { seen.add('dialog'); $('#dn').click(); continue; }
      if ($('.lab')) {
        seen.add('lab'); const h = window.__lab;
        if (h.judged()) continue;
        if (!once('lab')) h.lab.missions[h.mi()].sol(h.s);            // 答錯模式：第一個任務不照解法做就按確定
        h.act(); h.judge(); if (!$('#sc #nx')) return { uid, err: '實驗室按了確定作答，卻沒有停下來說明' };
        continue;
      }
      if ($('.chk')) {                                                // 快問：選 → 確定
        seen.add('quick');
        const cf = $('#cf'); if ($('.chk .opt.sel') && cf && !cf.disabled) { commit(cf, '快問'); continue; }
        const card = L.cards.find(c => c.t === tx($('.lcard h2'))), bad = once('q:' + card.t);
        const o = $$('.chk .opt').find(b => (tx(b.querySelector('.ot')) === norm(card.chk[1])) !== bad); if (!o) return { uid, err: 'quick option missing' }; o.click(); continue;
      }
      if ($('.tiles')) {                                              // 修復關鍵字：全部填好 → 確定
        seen.add('restore');
        const cf = $('#cf'); if (cf && !cf.disabled) { commit(cf, '修復關鍵字'); continue; }
        const cur = $('.blank.cur') || $('.blank[data-b]:not(.full)'); if (!cur) continue;
        const tiles = $$('.tile2:not([disabled])'), answers = $$('.blank[data-a]').map(b => b.dataset.a);
        let t = once('r:' + tx($('.lcard h2'))) ? (tiles.find(b => !answers.includes(b.textContent)) || tiles.find(b => b.textContent !== cur.dataset.a)) : null;
        if (!t) t = tiles.find(b => b.textContent === cur.dataset.a) || tiles[0];
        if (!t) return { uid, err: 'restore 沒有字卡' };
        t.click(); continue;
      }
      if ($('.scan')) {
        seen.add('scan');
        const card = L.cards.find(c => c.t === tx($('.lcard h2')));
        if ($('#go')) { $('#go').click(); continue; }
        const ask = $('.sinfo.ask');
        if (ask) {
          const cf = $('#cf'); if ($('.orb2.sel') && cf && !cf.disabled) { commit(cf, '掃描辨識'); continue; }
          const i = card.flip.findIndex(f => norm(f[1]) === tx(ask)); if (i < 0) return { uid, err: 'scan ask not found' };
          const bad = once('s:' + card.t), o = $$('.orb2').find(x => (+x.dataset.i === i) !== bad); o.click(); continue;
        }
        const o = $('.orb2:not(.seen)'); if (o) o.click(); continue;
      }
      if ($('.lcard') && $('#go')) { $('#go').click(); continue; }  // 「記住了」或收進圖鑑
      if (res && $('#go')) { $('#go').click(); continue; }            // 小遊戲結算
      if ($('.gm')) {
        const g = L.game, cf = $('#cf'), ready = cf && !cf.disabled && !cf.closest('[hidden]');
        if ($('#cover')) { seen.add('memory'); $('#cover').click(); continue; }
        if ($('.mc')) { seen.add('memory');
          if ($('.mc.sel') && ready) { commit(cf, '記憶翻牌'); continue; }
          const p = g.pairs.find(p => norm(p[0]) === tx($('.btarget b'))); if (!p) return { uid, err: 'memory target' };
          const bad = once('game'), c = $$('.mc:not([disabled])').find(b => (tx(b.querySelector('.mb')) === norm(p[1])) !== bad); if (!c) return { uid, err: 'memory card' }; c.click(); continue; }
        if ($('.bb')) { seen.add('bubbles');
          if ($('.bb.sel') && ready) { commit(cf, '泡泡射擊'); continue; }
          const p = g.pairs.find(p => norm(p[0]) === tx($('.btarget b'))); if (!p) return { uid, err: 'bubble target' };
          const bad = once('game'), b = $$('.bb:not([disabled])').find(x => (tx(x) === norm(p[1])) !== bad); if (!b) return { uid, err: 'bubble missing' }; b.click(); continue; }
        if ($('.sky')) { seen.add('meteor');
          if ($('.bk.sel') && ready) { commit(cf, '隕石攔截'); continue; }
          const m = $('.met span'); if (!m) continue;
          const it = g.items.find(x => norm(x[0]) === tx(m)); if (!it) return { uid, err: 'meteor item' };
          const bad = once('game'), b = $$('.bk:not([disabled])').find(x => (+x.dataset.k === it[1]) !== bad); if (b) b.click(); continue; }
        if ($('.st2')) { seen.add('stars');
          if (ready) { commit(cf, '連星座'); continue; }
          if (gw === null) gw = once('game');
          const ord = g.items.map((_, k) => k); if (gw && ord.length > 1) [ord[0], ord[1]] = [ord[1], ord[0]];
          const b = $(`.st2[data-k="${ord[$$('.st2.on').length]}"]`); if (b) b.click(); continue; }
        if ($('.sent')) { seen.add('sentence');
          if (ready) { commit(cf, '拼句子'); continue; }
          if (gw === null) gw = once('game');
          const want = g.items.slice(); if (gw && want.length > 1 && want[0] !== want[1]) [want[0], want[1]] = [want[1], want[0]];
          const b = $$('.chip2:not([disabled])').find(x => x.textContent === want[$$('.sent .w.full').length]); if (b) b.click(); continue; }
        if ($('.tile')) { seen.add('link');
          if (ready) { commit(cf, '連連看'); continue; }
          if (gw === null) gw = once('game');
          const ls = $$('.tile[data-s=l]'), k = +((cf && cf.textContent.match(/已配對 (\d+)/)) || [0, 0])[1];
          const l = ls[k]; if (!l) continue; const partner = gw && k < 2 && ls.length > 1 ? ls[1 - k].dataset.i : l.dataset.i;
          l.click(); const r = $(`.tile[data-s=r][data-i="${partner}"]`); if (r) r.click(); continue; }
      }
      if ($('.bt')) {                                                 // Boss：選 → 確定
        seen.add('boss');
        const qb = $('.qbox'); if (!qb) continue;
        const cf = $('#cf'); if ($('#qa .opt.sel') && cf && !cf.disabled) { commit(cf, 'Boss 戰'); continue; }
        const qt = qb.textContent.trim(), q = qs.find(x => x.q.trim() === qt); if (!q) return { uid, err: 'boss question not found: ' + qt.slice(0, 30) };
        const b = once('boss'), tfc = $('.tfc');
        if (tfc) { seen.add('tf'); const cand = tfc.textContent.replace('👉', '').trim(); $(`.opt[data-tf="${(cand === q.right.trim()) !== b ? 1 : 0}"]`).click(); }
        else { const o = $$('#qa .opts .opt').find(x => (x.querySelector('.ot').textContent.trim() === q.right.trim()) !== b); if (!o) return { uid, err: 'boss option missing' }; o.click(); }
        continue;
      }
    }
  } catch (e) { if (e instanceof Stop) return { uid, err: e.message }; throw e; }
  return { uid, err: 'timeout', at: document.querySelector('#sc')?.textContent.slice(0, 80) };
}
window.__playOne = playOne;
window.__autoAll = async (filter = () => true, opt = {}) => {
  const D = await load(); window.__auto = { done: false, bad: [], n: 0, kinds: {}, checked: 0, wrongSeen: 0 };
  for (const uid of D.list.filter(filter)) {
    const r = await playOne(uid, 'all', !!opt.wrong); window.__auto.n++; window.__auto.checked += r.checked || 0; window.__auto.wrongSeen += r.wrongSeen || 0;
    (r.seen || []).forEach(k => { window.__auto.kinds[k] = (window.__auto.kinds[k] || 0) + 1; });
    if (!r.ok) window.__auto.bad.push(r);
  }
  window.__auto.done = true; return window.__auto;
};
})();

/* 國中知識星航 — 遊戲主程式（純前端，無需建置）
   世界：星圖 → 星系 → 星球。每顆星球有三個能量核心：
     📡 探索（任務對話 → 動手實驗室 → 掃描／修復知識碎片）
     🎮 試煉（翻牌、泡泡、隕石攔截、連星座、拼句子）
     👾 Boss 戰（用學到的知識打敗迷霧獸）
   另有雙人對戰、星系守護者、迷霧突襲、錯題復仇戰、圖鑑與機庫。 */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const esc = t => String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
const today = () => new Date().toLocaleDateString('sv');
const CN = {7: '七', 8: '八', 9: '九'};
const GRADES = [[0, '全部年級'], [7, '七年級'], [8, '八年級'], [9, '九年級']];
const LABS = window.LABS || {};
let RUN = 0;                                             // 換頁時遞增，讓上一頁的計時器失效
const tm = ms => window.__fast ? Math.min(ms, 25) : ms;   // 自動測試時加速
const later = (fn, ms) => { const my = RUN; setTimeout(() => { if (my === RUN) fn(); }, tm(ms)); };

/* ---------- 題庫與課程 ---------- */
let SUBJECTS = [], UNITS = {}, QS = {}, LESSONS = {}, META = {};
async function loadBank() {
  const get = u => fetch('data/' + u, {cache: 'no-cache'}).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
  const man = await get('manifest.json');
  META = man;
  const banks = await Promise.all(man.subjects.map(s => get(s.file)));
  const lessons = await Promise.all(man.subjects.map(s => s.lessons ? get(s.lessons).catch(() => ({lessons: {}})) : {lessons: {}}));
  lessons.forEach(l => Object.assign(LESSONS, l.lessons || {}));
  SUBJECTS = man.subjects.map((s, i) => {
    const units = banks[i].units.map(u => {
      const unit = {id: u.id, sid: s.id, g: u.g, s: u.s, t: u.t, k: u.k || '', qs: []};
      u.q.forEach(raw => {
        const q = {id: u.id + ':' + hash(raw[0]), uid: u.id, sid: s.id, q: raw[0], right: raw[1], wrongs: raw.slice(2, 5), exp: raw[5] || '', whys: raw.slice(6, 9)};
        QS[q.id] = q; unit.qs.push(q);
      });
      unit.cq = ((LESSONS[u.id] || {}).cards || []).filter(c => c.chk)                   // 知識碎片的快問也算進題庫（和題庫重複的不算）
        .map(c => ({...chkQ(c), id: u.id + '#' + hash(c.chk[0]), uid: u.id, sid: s.id})).filter(q => !unit.qs.some(o => sameQ(o, q)));
      unit.cq.forEach(q => { QS[q.id] = q; });
      unit.all = [...unit.qs, ...unit.cq];
      UNITS[u.id] = unit;
      return unit;
    });
    return {...s, units};
  });
}
const subj = id => SUBJECTS.find(s => s.id === id);

/* ---------- 存檔（localStorage，多人） ---------- */
const KEY = 'jhq-v1';
let DB = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })();
if (!DB.profiles) DB = {cur: '同學', grade: 0, profiles: {}};
const blank = () => ({xp: 0, coins: 0, streak: 0, lastDay: '', core: {}, wrong: {}, best: {}, at: {}, done: 0, right: 0, ship: '🚀', ships: ['🚀'], daily: {d: ''}});
function P() {
  let p = DB.profiles[DB.cur]; if (!p) p = DB.profiles[DB.cur] = blank();
  if (!p.core) {                                         // 舊版存檔轉換
    p.core = {};
    Object.keys(p.stars || {}).forEach(u => { if (p.stars[u] > 0) p.core[u] = {b: 1}; });
    Object.keys(p.learned || {}).forEach(u => { (p.core[u] = p.core[u] || {}).e = 1; });
  }
  ['wrong', 'best', 'at', 'ust'].forEach(k => { p[k] = p[k] || {}; });
  p.rv = p.rv || {sel: [], n: 10, note: true};            // 章節複習：選了哪些章節、題數、要不要先複習重點
  p.coins = p.coins || 0; p.ship = p.ship || '🚀'; p.ships = p.ships || ['🚀']; p.daily = p.daily || {d: ''};
  return p;
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} };
const level = xp => Math.floor(Math.sqrt(xp / 50)) + 1;
const levelFloor = lv => (lv - 1) * (lv - 1) * 50;
const stars = uid => { const c = P().core[uid] || {}; return (c.e ? 1 : 0) + (c.g ? 1 : 0) + (c.b ? 1 : 0); };
function setCore(uid, k) { const c = P().core[uid] = P().core[uid] || {}; const first = !c[k]; c[k] = 1; save(); return first; }
function touchStreak() {
  const p = P(), t = today();
  if (p.lastDay === t) return;
  const y = new Date(Date.now() - 864e5).toLocaleDateString('sv');
  p.streak = p.lastDay === y ? p.streak + 1 : 1; p.lastDay = t;
}
function tally(uid, ok) {                        // 每一章最近 20 次作答的對錯，用來找出比較弱的章節
  if (!uid || !UNITS[uid]) return;
  const p = P(), t = p.ust[uid] = p.ust[uid] || {n: 0, r: 0, h: ''};
  t.n++; if (ok) t.r++; t.h = (t.h + (ok ? 1 : 0)).slice(-20); save();
}
function record(q, ok) {
  const p = P(); p.done++; if (ok) p.right++;
  if (!ok) p.wrong[q.id] = 2;
  else if (p.wrong[q.id]) { if (--p.wrong[q.id] <= 0) delete p.wrong[q.id]; }
  tally(q.uid, ok);
}
const WK = [['w0', '⚪ 還沒練習'], ['w1', '🟢 很穩'], ['w2', '🟡 還不穩'], ['w3', '🔴 待加強']];
function weak(uid) {                             // 章節掌握度：lv 3 待加強、2 還不穩、1 很穩、0 還沒練習（或練習太少）
  const p = P(), h = (p.ust[uid] || {}).h || '', n = h.length, r = h.split('1').length - 1, acc = n ? r / n : 0;
  const wr = Object.keys(p.wrong).filter(id => QS[id] && QS[id].uid === uid).length;
  const lv = (n >= 3 && acc < .6) || wr >= 3 ? 3 : (n >= 3 && acc < .8) || wr >= 1 ? 2 : n >= 3 ? 1 : 0;
  return {n, r, acc, wr, lv, cls: WK[lv][0], label: lv || !n ? WK[lv][1] : '⚪ 練習還太少'};
}
const pct = w => Math.round(w.acc * 100);
function earn(x, xp, coins = 0) {
  const p = P(); p.xp += xp; p.coins += coins;
  if (x) { x.gain.xp += xp; x.gain.coins += coins; }
  save(); toast('+' + xp + ' 經驗' + (coins ? '　+' + coins + ' ✨' : ''));
}
const QUESTS = [['boss', '打敗 1 隻迷霧獸', 1], ['game', '完成 2 個實驗或試煉', 2], ['right', '在戰鬥中答對 10 題', 10]];
function daily() { const p = P(); if (p.daily.d !== today()) p.daily = {d: today(), boss: 0, game: 0, right: 0, got: {}}; return p.daily; }
function bump(k, n = 1) {
  const d = daily(); d[k] = (d[k] || 0) + n;
  QUESTS.forEach(([q, name, need]) => { if (q === k && d[k] >= need && !d.got[q]) { d.got[q] = 1; P().coins += 30; later(() => toast('🎁 每日任務完成：' + name + '　+30 ✨'), 1000); } });
  save();
}

/* ---------- 音效與特效 ---------- */
let AC = null;
const tone = (f, d, type = 'sine', v = .07, t0 = 0) => {
  if (DB.mute) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + t0;
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d);
  } catch (e) {}
};
window.jhTone = (f, d, v) => tone(f, d, 'sine', v);
const sfx = {
  ok() { tone(660, .12); tone(990, .18, 'sine', .07, .09); },
  no() { tone(160, .28, 'sawtooth', .045); },
  tap() { tone(500, .04, 'sine', .04); },
  zap() { tone(900, .08, 'square', .04); tone(400, .12, 'square', .04, .06); },
  boom() { tone(120, .5, 'sawtooth', .07); tone(70, .6, 'square', .05, .05); },
  fly() { tone(300, .25, 'triangle', .03); tone(520, .25, 'triangle', .03, .15); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .22, 'triangle', .07, i * .11)); }
};
function confetti() {
  const box = document.createElement('div'); box.className = 'confetti';
  const em = ['🎉', '⭐', '✨', '🎊', '💫', '🌟'];
  for (let i = 0; i < 36; i++) {
    const s = document.createElement('span'); s.textContent = em[i % em.length];
    s.style.cssText = `left:${Math.random() * 100}%;animation-delay:${Math.random() * .6}s;font-size:${16 + Math.random() * 18}px`;
    box.appendChild(s);
  }
  document.body.appendChild(box); setTimeout(() => box.remove(), 2800);
}
function toast(t) {
  if (!t) return;
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = t;
  const base = innerWidth <= 640 && !document.body.classList.contains('playing') ? 88 : 70;
  d.style.bottom = (base + $$('.toast').length * 40) + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 1500);
}
const bad = b => { b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 450); };

/* ---------- 共用畫面元件 ---------- */
const inGrade = u => !DB.grade || u.g === DB.grade;
const say = (s, text) => `<div class="say"><div class="mas">${s.mascot}</div><div class="bub"><small>${esc(s.guide)}</small>${md(text)}</div></div>`;
const starRow = n => `<span>${'★'.repeat(n)}</span><span class="off">${'★'.repeat(3 - n)}</span>`;
const planet = (u, big) => { const s = subj(u.sid), L = LESSONS[u.id];
  return `<span class="pl p${stars(u.id)}${big ? ' big' : ''}" style="--c:${s.color}"><i class="ring"></i><b>${L && L.ic ? L.ic : s.icon}</b><i class="fog"></i><i class="moon">🌙</i><i class="flag">🚩</i></span>`; };
const coreDots = uid => { const c = P().core[uid] || {}; return `<span class="cd ${c.e ? 'on' : ''}">📡</span><span class="cd ${c.g ? 'on' : ''}">🎮</span><span class="cd ${c.b ? 'on' : ''}">👾</span>`; };
function heroHTML() {
  const p = P(), lv = level(p.xp), a = levelFloor(lv), b = levelFloor(lv + 1);
  const lit = Object.keys(p.core).filter(id => UNITS[id] && stars(id) === 3).length;
  return `<section class="hero"><div><div class="who">${p.ship} ${esc(DB.cur)}　Lv.${lv}</div>
    <div class="xpbar"><i style="width:${Math.round((p.xp - a) / (b - a) * 100)}%"></i></div></div>
    <div class="stat"><span>星塵 <b>${p.coins} ✨</b></span><span>連續 <b>${p.streak}</b> 天</span>
    <span>點亮星球 <b>${lit}</b></span><span>能量核心 <b>${Object.keys(p.core).reduce((n, id) => n + (UNITS[id] ? stars(id) : 0), 0)}</b></span></div></section>`;
}
function questHTML() {
  const d = daily();
  return `<div class="quests"><b>今日任務</b>${QUESTS.map(([k, name, need]) => `<span class="qst ${d.got[k] ? 'ok' : ''}">${d.got[k] ? '✅' : '🎯'} ${name}（${Math.min(d[k] || 0, need)}/${need}）</span>`).join('')}</div>`;
}
const gradeChips = () => '<div class="chips">' + GRADES.map(([g, n]) => `<button class="chip ${DB.grade === g ? 'on' : ''}" data-grade="${g}">${n}</button>`).join('') + '</div>';
function fly(box, target, cb) {
  const ship = $('.ship', box); if (!ship || !target) return cb && cb();
  const b = box.getBoundingClientRect(), t = target.getBoundingClientRect();
  ship.style.left = (t.left - b.left + t.width / 2) + 'px'; ship.style.top = (t.top - b.top - 6) + 'px';
  if (cb) { sfx.fly(); ship.classList.add('go'); later(cb, 620); }
}
function park(box, target) { const ship = $('.ship', box); if (!ship || !target) return; ship.classList.add('noani'); fly(box, target); void ship.offsetWidth; ship.classList.remove('noani'); }
function nextUnit(u) { const l = subj(u.sid).units.filter(inGrade), i = l.findIndex(x => x.id === u.id); return i >= 0 ? l[i + 1] || null : null; }

/* ---------- 星際航圖（首頁） ---------- */
function nextPick() {
  for (const s of [subj(DB.last), ...SUBJECTS].filter(Boolean)) { const u = s.units.filter(inGrade).find(v => stars(v.id) < 3); if (u) return u; }
  return null;
}
function viewHome() {
  const p = P(), nx = nextPick(), d = daily(), qd = QUESTS.filter(q => d.got[q[0]]).length;
  const nodes = SUBJECTS.map(s => {
    const us = s.units.filter(inGrade); if (!us.length) return '';
    const got = us.reduce((x, u) => x + stars(u.id), 0), max = us.length * 3;
    return `<a class="gnode" href="#/s/${s.id}" data-sid="${s.id}" style="--c:${s.color}"><span class="gorb ${got ? 'lit' : ''}">${s.icon}<i>${s.mascot}</i></span><b>${esc(s.name)}星系</b><small>★ ${got} / ${max}</small><span class="gbar"><i style="width:${max ? got / max * 100 : 0}%"></i></span></a>`;
  }).join('');
  app.innerHTML = heroHTML() +
    (nx ? `<a class="cont" href="#/u/${nx.id}" style="--c:${subj(nx.sid).color}">${planet(nx)}<span class="ct2"><small>${stars(nx.id) ? '繼續點亮' : '下一站'}・${esc(subj(nx.sid).name)}星系</small><b>${esc(nx.t)}</b></span><span class="go">▶</span></a>` : '') +
    `<details class="quests"><summary>🎯 今日任務 <b>${qd} / ${QUESTS.length}</b><span class="mute sm">　每完成一項 +30 ✨</span></summary><div class="qlist">${QUESTS.map(([k, name, need]) => `<span class="qst ${d.got[k] ? 'ok' : ''}">${d.got[k] ? '✅' : '◻️'} ${name}（${Math.min(d[k] || 0, need)}/${need}）</span>`).join('')}</div></details>
    <h1>星際航圖</h1>` + gradeChips() + `<div class="space gal" id="sp">${nodes}<div class="ship">${p.ship}</div></div>
    <div class="row c"><a class="btn ghost" href="#/review">🎯 章節複習</a><a class="btn ghost" href="#/sprint">⏱ 迷霧突襲</a><a class="btn ghost" href="#/duel">⚔️ 雙人對戰</a></div>`;
  const sp = $('#sp'), at = () => $(`[data-sid="${DB.last || ''}"] .gorb`, sp) || $('.gorb', sp);
  park(sp, at()); window.__repark = () => park(sp, at());
  sp.onclick = e => { const a = e.target.closest('.gnode'); if (!a) return; e.preventDefault(); DB.last = a.dataset.sid; save(); fly(sp, $('.gorb', a), () => { location.hash = a.getAttribute('href'); }); };
}

/* ---------- 星系：星球航線 ---------- */
function viewSubject(sid) {
  const s = subj(sid); if (!s) return viewHome();
  const p = P(), us = s.units.filter(inGrade), groups = {};
  us.forEach(u => (groups[u.g + u.s] = groups[u.g + u.s] || []).push(u));
  const next = us.find(u => stars(u.id) < 3);
  const html = Object.keys(groups).sort().map(k => {
    const list = groups[k];
    return `<h2>${CN[list[0].g]}年級${list[0].s}學期</h2><div class="path">` + list.map(u => { const w = weak(u.id);
      return `<a class="node ${next && next.id === u.id ? 'next' : ''}" href="#/u/${u.id}" data-uid="${u.id}">${planet(u)}<span class="nlab"><b>${esc(u.t)}</b><small>${esc(u.k)}</small><em>${coreDots(u.id)}${LABS[u.id] ? '<span class="labtag">🧪 實驗</span>' : ''}${w.lv >= 2 ? `<span class="wtag ${w.cls}">${w.lv === 3 ? '待加強' : '還不穩'}</span>` : ''}</em></span></a>`; }).join('') + '</div>';
  }).join('');
  app.innerHTML = `<a class="back" href="#/">← 回星際航圖</a><h1>${s.icon} ${esc(s.name)}星系</h1>` +
    say(s, next ? `我是${s.guide}！點一顆星球，太空船就會飛過去。每顆星球有 **📡 探索、🎮 試煉、👾 Boss** 三個能量核心，全部拿到星球就會完全點亮。下一站建議：**${next.t}**。` : `這個年級的星球全部點亮了，太厲害了！去挑戰星系守護者吧。`) +
    gradeChips() + `<div class="row"><a class="btn" href="#/mix/${s.id}">👑 挑戰星系守護者</a><a class="btn ghost" href="#/review/${s.id}">🎯 章節複習${(() => { const n = us.filter(u => weak(u.id).lv >= 2).length; return n ? `<i class="wn">${n}</i>` : ''; })()}</a></div>
    <div class="space" id="sp">${html || '<p class="mute">這個年級沒有此科目的星球。</p>'}<div class="ship">${p.ship}</div></div>`;
  const sp = $('#sp'), at = () => $(`[data-uid="${p.at[sid] || (next && next.id) || ''}"] .pl`, sp) || $('.node .pl', sp);
  park(sp, at()); window.__repark = () => park(sp, at());
  sp.onclick = e => { const a = e.target.closest('.node'); if (!a) return; e.preventDefault(); p.at[sid] = a.dataset.uid; save(); fly(sp, $('.pl', a), () => { location.hash = a.getAttribute('href'); }); };
}

/* ---------- 星球頁 ---------- */
const BOSSES = [['👾', '迷霧獸'], ['🐙', '遺忘章魚'], ['👹', '粗心鬼'], ['🤖', '亂碼機兵'], ['🦑', '墨汁怪'], ['🐲', '瞌睡龍'], ['👻', '恍神幽靈'], ['🦂', '陷阱蠍'], ['🕷️', '混淆蛛'], ['🦇', '夜盲蝠']];
const bossOf = uid => { const b = BOSSES[parseInt(hash(uid), 36) % BOSSES.length]; return {e: b[0], n: b[1]}; };
const isWords = g => g.items.every(t => /^[\x20-\x7e]+$/.test(t));
function gameKind(u, g) {
  if (g.type === 'sort') return 'meteor';
  if (g.type === 'order') return isWords(g) ? 'sentence' : 'stars';
  return g.pairs.length > 5 ? 'link' : (parseInt(hash(u.id), 36) % 2 ? 'memory' : 'bubbles');
}
const GK = {
  meteor: {ic: '☄️', name: '隕石攔截', ask: g => (g.ask || '') + ' 點下面的類別瞄準，再按「發射」擊碎隕石。每顆只有一次機會！', run: gMeteor},
  stars: {ic: '✨', name: '連星座', ask: g => (g.ask || '依正確順序點亮星星。') + ' 連成一個星座，排好再按「確定作答」。', run: gStars},
  sentence: {ic: '🧩', name: '拼句子', ask: g => (g.ask || '依正確順序點選。') + ' 排好再按「確定作答」。', run: gSentence},
  memory: {ic: '🃏', name: '記憶翻牌', ask: () => '先記住每張說明牌的位置，蓋牌後依照題目找出對的那一張，選好再按「翻開它」。每張只有一次機會！', run: gMemory},
  bubbles: {ic: '🫧', name: '泡泡射擊', ask: () => '看上方的目標，點和它相配的泡泡瞄準，再按「發射」。每個目標只有一次機會！', run: gBubbles},
  link: {ic: '🔗', name: '連連看', ask: () => '先點左邊，再點右邊相配的卡片，全部配好再按「確定作答」。', run: gLink}
};
function viewUnit(uid) {
  const u = UNITS[uid]; if (!u) return viewHome();
  const s = subj(u.sid), L = LESSONS[uid], c = P().core[uid] || {}, n = stars(uid), lab = LABS[uid], boss = bossOf(uid);
  const g = L && L.game ? GK[gameKind(u, L.game)] : null, w = weak(uid);
  const row = (k, ic, name, desc, done) => `<a class="corerow ${done ? 'ok' : ''}" href="#/play/${uid}/${k}"><span class="ci">${ic}</span><span class="ct"><b>${name}</b><small>${esc(desc)}</small></span><span class="cs">${done ? '⭐' : '▶'}</span></a>`;
  app.innerHTML = `<a class="back" href="#/s/${s.id}">← 回${esc(s.name)}星系</a>
  <section class="mission" style="--c:${s.color}">
    <div class="mhead">${planet(u, true)}<div><div class="mtag">${CN[u.g]}年級${u.s}學期・${esc(s.name)}</div><h1>${esc(u.t)}</h1>
      <div class="mst">${starRow(n)} <small>${n === 3 ? '完全點亮！' : n ? '正在甦醒…' : '被迷霧籠罩中'}</small></div></div></div>
    ${L ? say(s, L.hook) : ''}
    <a class="btn wide" href="#/play/${uid}/all">${n ? '重新完整探險' : '降落！開始任務'} 🚀</a>
    <div class="cores">
      ${row('e', '📡', '探索', (lab ? '🧪 ' + lab.name + '＋' : '') + (L ? L.cards.length : 0) + ' 個知識碎片', c.e)}
      ${g ? row('g', g.ic, '試煉：' + g.name, L.game.title || '', c.g) : ''}
      ${row('b', boss.e, 'Boss 戰：' + boss.n, '用學到的知識打敗牠', c.b)}
    </div>
    <div class="ust"><em class="wk ${w.cls}">${w.label}</em><span class="mute sm">${w.n ? `最近 ${w.n} 次作答答對 ${pct(w)}%` : '還沒有作答紀錄'}${w.wr ? `・錯題 ${w.wr} 題` : ''}</span></div>
    <div class="row">${n ? `<a class="btn ghost" href="#/codex/${uid}">📔 這顆星球的圖鑑筆記</a>` : ''}<a class="btn ghost" href="#/train/${uid}">🎯 這一章弱點特訓</a></div>
  </section>`;
}

/* ---------- 任務流程 ---------- */
function play(uid, part) {
  const u = UNITS[uid]; if (!u) return viewHome();
  const s = subj(u.sid), L = LESSONS[uid] || {cards: [], hook: ''}, all = part === 'all';
  const terms = [...new Set(L.cards.flatMap(c => (c.b.match(/\*\*(.+?)\*\*/g) || []).map(t => t.slice(2, -2))))];
  const x = {u, s, L, terms, gain: {xp: 0, coins: 0}, got: [], lost: false};
  const steps = [];
  if (all || part === 'e') {
    steps.push({f: stepDialog}); if (LABS[uid]) steps.push({f: stepLab});
    L.cards.forEach(c => steps.push({f: c.flip ? stepScan : stepRestore, c}));
    steps[steps.length - 1].end = 'e';
  }
  if ((all || part === 'g') && L.game) steps.push({f: stepGame, end: 'g'});
  if (all || part === 'b') steps.push({f: stepBoss, end: 'b'});
  if (!steps.length) return viewUnit(uid);
  touchStreak(); save();
  app.innerHTML = `<div class="stage" style="--c:${s.color}"><div class="hud"><a href="#/u/${uid}" class="hx">✕</a><b>${esc(u.t)}</b><span class="dots" id="dots"></span></div><div id="sc"></div></div>`;
  const box = $('#sc'); let i = 0;
  $('.hx', app).onclick = e => { if (i > 0 && !window.__fast && !confirm('確定要離開嗎？這一關還沒完成的部分不會保存。')) e.preventDefault(); };
  const run = () => {
    if (i >= steps.length) return finish(x);
    $('#dots').innerHTML = steps.map((_, k) => `<i class="${k < i ? 'd' : k === i ? 'c' : ''}"></i>`).join('');
    box.onclick = box.oninput = null; box.innerHTML = ''; window.scrollTo(0, 0);
    const st = steps[i];
    st.f(box, x, res => {
      if (st.end === 'b' && !(res && res.win)) { x.lost = true; return finish(x); }
      if (st.end && setCore(uid, st.end)) x.got.push(st.end);
      i++; run();
    }, st.c);
  };
  run();
}
function finish(x) {
  const u = x.u, n = stars(u.id), c = P().core[u.id] || {};
  const np = !c.e ? 'e' : !c.g && x.L.game ? 'g' : !c.b ? 'b' : null, nx = nextUnit(u);
  const NAME = {e: '📡 探索', g: '🎮 試煉', b: '👾 Boss 戰'};
  if (!x.lost) { sfx.win(); if (n === 3 && x.got.length) confetti(); }
  app.innerHTML = `<div class="quiz"><div class="panel result" style="--c:${x.s.color}">
    ${planet(u, true)}
    <h1>${x.lost ? '迷霧獸逃走了…' : n === 3 && x.got.length ? '星球完全點亮了！🎉' : x.got.length ? '取得能量核心！' : '任務完成！'}</h1>
    <div class="big">${starRow(n)}</div>
    ${x.got.length ? `<p>新取得：${x.got.map(k => NAME[k] + '核心').join('、')}</p>` : ''}
    <p>本次獲得　經驗 <b>+${x.gain.xp}</b>　星塵 <b>+${x.gain.coins} ✨</b></p>
    ${x.lost ? say(x.s, '別灰心！先去探索一下知識碎片，或看看圖鑑筆記，再回來一定打得贏。') : ''}
    <div class="row c">${x.lost ? `<a class="btn" href="#/play/${u.id}/b">再戰一次 👾</a><a class="btn ghost" href="#/play/${u.id}/e">先去探索 📡</a>`
      : np ? `<a class="btn" href="#/play/${u.id}/${np}">下一關：${NAME[np]}</a>`
      : nx ? `<a class="btn" href="#/u/${nx.id}">前往下一顆星球 →</a>` : ''}
      <a class="btn ghost" href="#/u/${u.id}">回星球</a><a class="btn ghost" href="#/codex/${u.id}">📔 筆記</a></div></div></div>`;
}

/* --- 步驟：任務對話 --- */
function stepDialog(box, x, done) {
  const parts = (x.L.hook || `歡迎來到「${x.u.t}」！`).match(/[^。！？]+[。！？」』）]*/g).map(t => t.trim()).filter(Boolean);
  let i = 0;
  const draw = () => {
    box.innerHTML = `<div class="dlg"><div class="dmas">${x.s.mascot}</div><div class="dname">${esc(x.s.guide)}</div>
      <div class="dbub">${parts.slice(0, i + 1).map((t, k) => `<p class="${k === i ? 'new' : ''}">${md(t)}</p>`).join('')}</div>
      <div class="row c"><button class="btn" id="dn">${i + 1 < parts.length ? '▶ 繼續' : '出發！🚀'}</button>${i + 1 < parts.length ? '<button class="btn ghost" id="ds">跳過</button>' : ''}</div></div>`;
    $('#dn', box).onclick = () => { sfx.tap(); ++i < parts.length ? draw() : done(); };
    const sk = $('#ds', box); if (sk) sk.onclick = () => done();
  };
  draw();
}

/* --- 步驟：實驗室（動手做 → 按「確定作答」才判定，每個任務只有一次機會） --- */
function stepLab(box, x, done) {
  const lab = LABS[x.u.id], s = lab.init(); let mi = 0, acts = 0, judged = false, missed = 0;
  const cur = () => lab.missions[mi];
  const txt = v => typeof v === 'function' ? v(s) : v;
  const ctrls = () => typeof lab.ctrl === 'function' ? lab.ctrl(s) : (lab.ctrl || []);
  const fv = c => c.fmt ? c.fmt(s[c.k]) : s[c.k];
  const enter = () => { acts = 0; judged = false; s.judged = false; s.right = false; s.mi = mi; if (cur().set) cur().set(s); };
  const ctrlHTML = () => ctrls().map((c, i) => {
    if (c.type === 'btn') return `<button class="lbtn" data-b="${i}">${esc(c.label)}</button>`;
    if (c.type === 'toggle') return `<button class="lbtn tog ${s[c.k] ? 'on' : ''}" data-t="${i}" aria-pressed="${!!s[c.k]}">${s[c.k] ? '✅' : '⬜'} ${esc(c.label)}</button>`;
    if (c.type === 'choice') return `<div class="lch"><span>${esc(c.label)}</span>${c.opts.map((o, j) => `<button class="lbtn ${s[c.k] === o[0] ? 'on' : ''}" data-c="${i}" data-j="${j}">${esc(o[1])}</button>`).join('')}</div>`;
    return `<div class="lsl"><span>${esc(c.label)}：<b data-val="${i}">${fv(c)}</b>${c.unit || ''}</span><div class="slrow"><button class="nud" data-n="${i}" data-d="-1" aria-label="減少">−</button><input type="range" data-s="${i}" min="${c.min}" max="${c.max}" step="${c.step || 1}" value="${s[c.k]}" aria-label="${esc(c.label)}"><button class="nud" data-n="${i}" data-d="1" aria-label="增加">＋</button></div></div>`;
  }).join('');
  const readHTML = () => (lab.read ? lab.read(s) : []).map(r => `<div class="rd"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
  const draw = () => {
    box.innerHTML = `<div class="lab"><div class="labtop"><span class="tag">🧪 實驗室</span><b>${esc(lab.name)}</b><span class="mute sm">任務 ${mi + 1} / ${lab.missions.length}</span></div>
      ${mi === 0 ? say(x.s, lab.intro) : ''}
      <div class="mis" id="lm">🎯 ${md(cur().t)}</div>
      <div class="labview" id="lv">${lab.view(s)}</div><div class="reads" id="lr">${readHTML()}</div><div class="ctrls" id="lc">${ctrlHTML()}</div>
      <div id="lf" aria-live="polite"></div>
      <div class="row c" id="la"><button class="btn ghost" id="lhint">💡 給我提示</button><button class="btn" id="lok" disabled>先動手做，再按確定</button></div>
      <p class="mute sm c" id="lrule">做好之後按「確定作答」才會判定，每個任務只有一次機會。</p></div>`;
  };
  const refresh = full => { $('#lv', box).innerHTML = lab.view(s); $('#lr', box).innerHTML = readHTML(); if (full) $('#lc', box).innerHTML = ctrlHTML(); };
  const acted = () => { acts++; const b = $('#lok', box); if (b && b.disabled) { b.disabled = false; b.textContent = '確定作答 ✔'; } };
  const mine = () => {                             // 孩子的答案（答錯時拿來對照）
    const c = ctrls().filter(c => c.type !== 'btn').map(c => c.type === 'toggle' ? (s[c.k] ? '✅' + c.label : '')
      : c.type === 'choice' ? `${c.label}：${(c.opts.find(o => o[0] === s[c.k]) || ['', s[c.k]])[1]}` : `${c.label}：${fv(c)}${c.unit || ''}`).filter(Boolean);
    return c.length ? c.join('　') : (lab.read ? lab.read(s) : []).slice(0, 2).map(r => `${r[0]}：${r[1]}`).join('　');
  };
  const judge = () => {
    if (judged || !acts) return;
    const m = cur(), ok = !!m.ok(s);
    let html;
    if (ok) { sfx.ok(); html = `<b class="ok">✔ 答對了！</b><br>${md(txt(m.say))}`; }
    else {
      sfx.no(); missed++;
      const my = mine(), why = m.why ? txt(m.why) : m.hint ? txt(m.hint) : '';
      if (m.set) m.set(s); m.sol(s);              // 公布正確答案：畫面換成正確的樣子
      html = `<b class="no">✘ 這樣還不對。</b>${my ? `<br>你的答案：${my}` : ''}${why ? `<br>${m.why ? '原因' : '怎麼想'}：${md(why)}` : ''}<br><b>正確答案</b>（畫面已經換成正確的樣子）：${md(txt(m.say))}`;
    }
    judged = true; s.judged = true; s.right = ok; tally(x.u.id, ok);
    refresh(true);
    $('.lab', box).classList.add('judged'); $('#lm', box).classList.add(ok ? 'done' : 'miss');
    $('#lf', box).innerHTML = note(html, ok);
    $('#la', box).innerHTML = ''; const r = $('#lrule', box); if (r) r.remove();
    nextBtn($('#la', box), mi + 1 < lab.missions.length ? '下一個任務 →' : '完成實驗 🎉', !ok, next);
    const n = $('#nx', box); if (n && n.scrollIntoView && !window.__fast) n.scrollIntoView({behavior: 'smooth', block: 'center'});
  };
  const next = () => { if (++mi >= lab.missions.length) { earn(x, 15, missed ? 5 : 10); bump('game'); return done(); } enter(); draw(); window.scrollTo(0, 0); };
  const hint = () => { if (judged) return; const h = cur().hint; $('#lf', box).innerHTML = `<div class="exp pop">💡 ${h ? md(txt(h)) : '仔細看上面的讀數，想想任務要你做到什麼。'}</div>`; };
  const setVal = (c, i, v) => { s[c.k] = v; const el = $(`[data-val="${i}"]`, box); if (el) el.textContent = fv(c); };
  box.oninput = e => { if (judged) return; const i = e.target.dataset.s; if (i === undefined) return; setVal(ctrls()[+i], i, +e.target.value); refresh(false); };
  box.onchange = e => { if (!judged && e.target.dataset.s !== undefined) acted(); };
  box.onclick = e => {
    const t = e.target;
    if (t.closest('#lhint')) return hint();
    if (t.closest('#lok')) return judge();
    if (judged) return;
    const tap = t.closest('[data-tap]');
    if (tap && lab.tap) { lab.tap(s, tap.dataset.tap); sfx.tap(); refresh(false); return acted(); }
    const nb = t.closest('.nud');
    if (nb) { const i = +nb.dataset.n, c = ctrls()[i], st = c.step || 1;
      const v = Math.min(c.max, Math.max(c.min, Math.round((s[c.k] + st * nb.dataset.d) / st) * st));
      setVal(c, i, +v.toFixed(4)); const r = $(`[data-s="${i}"]`, box); if (r) r.value = s[c.k]; sfx.tap(); refresh(false); return acted(); }
    const b = t.closest('.lbtn'); if (!b) return;
    const cs = ctrls();
    if (b.dataset.b !== undefined) cs[+b.dataset.b].run(s);
    else if (b.dataset.t !== undefined) { const c = cs[+b.dataset.t]; s[c.k] = !s[c.k]; if (c.run) c.run(s); }
    else if (b.dataset.c !== undefined) { const c = cs[+b.dataset.c]; s[c.k] = c.opts[+b.dataset.j][0]; }
    sfx.tap(); refresh(true); acted();
  };
  if (window.__fast) window.__lab = {s, lab, mi: () => mi, act: acted, judge, judged: () => judged};
  enter(); draw();
}

/* ---------- 作答共用：先選、再按「確定作答」，公布後每個選項都寫出對錯原因 ---------- */
const chkQ = c => ({q: c.chk[0], right: c.chk[1], wrongs: c.chk.slice(2, 4), exp: c.chk[4] || '', whys: c.chk.slice(5, 7)});
const whyOf = (q, o) => o === q.right ? q.exp || '' : (q.whys || [])[q.wrongs.indexOf(o)] || '';
const optsHTML = (opts, keys = 'ABCD') => `<div class="opts">${opts.map((o, i) => `<button class="opt" data-i="${i}" aria-pressed="false"><span class="k">${keys[i]}</span><span class="ot">${esc(o)}</span></button>`).join('')}</div>`;
const CONFIRM = '<div class="row c cfrow"><button class="btn" id="cf" disabled>先選一個答案</button></div>';
const note = (html, good) => html ? `<div class="exp ${good ? 'good' : 'err'} pop">${html}</div>` : '';
function pickOpt(root, b) {                     // 第一步：選擇（還可以改選）
  $$('.opt', root).forEach(o => { const on = o === b; o.classList.toggle('sel', on); o.setAttribute('aria-pressed', on); });
  const cf = $('#cf', root); if (cf) { cf.disabled = false; cf.textContent = '確定作答 ✔'; }
  sfx.tap();
}
function revealOpts(root, q, opts, pick) {      // 第二步：公布，每個選項都附上為什麼對／為什麼錯
  $$('.opt', root).forEach(b => {
    const i = +b.dataset.i, o = opts[i], ok = o === q.right, why = whyOf(q, o);
    b.disabled = true; b.classList.remove('sel', 'gone');
    b.classList.add(ok ? 'right' : i === pick ? 'wrong' : 'dim');
    if (i === pick) b.classList.add('mine');
    if (why && !$('.why', b)) b.insertAdjacentHTML('beforeend', `<span class="why">${ok ? '✔ ' : '✘ '}${esc(why)}</span>`);
  });
  const cf = $('.cfrow', root); if (cf) cf.remove();
}
function nextBtn(el, label, wait, fn) {         // 答錯時按鈕先鎖 1.5 秒，讓孩子讀完說明
  el.insertAdjacentHTML('beforeend', `<div class="row c"><button class="btn ${wait ? '' : 'pulse'}" id="nx" ${wait ? 'disabled' : ''}>${wait ? '⏳ 先讀一下說明…' : label}</button></div>`);
  const b = $('#nx', el); b.onclick = () => { if (b.dataset.used) return; b.dataset.used = 1; fn(); };
  if (wait) later(() => { b.disabled = false; b.textContent = label; b.classList.add('pulse'); }, 1500);
}
const gsay = (box, html, good) => { const f = $('#gf', box); if (f) f.innerHTML = note(html, good); if (html && box.__tal) box.__tal(!!good); };   // 小遊戲每次判定都記進章節紀錄

/* --- 步驟：修復知識碎片（關鍵字被迷霧偷走：全部填好再按「確定作答」，只有一次機會） --- */
function stepRestore(box, x, done, c) {
  const segs = c.b.split(/(\*\*.+?\*\*)/).filter(Boolean).map(t => t.startsWith('**') ? {k: t.slice(2, -2)} : {t});
  const uniq = [...new Set(segs.filter(g => g.k && g.k.length <= 14).map(g => g.k))];
  if (uniq.length < 2) return stepQuick(box, x, done, c);
  const pick = shuffle(uniq).slice(0, Math.min(4, uniq.length)), used = new Set(), blanks = [];
  segs.forEach(g => { if (g.k && pick.includes(g.k) && !used.has(g.k)) { used.add(g.k); g.blank = blanks.length; blanks.push(g.k); } });
  const tiles = shuffle([...blanks, ...shuffle(x.terms.filter(t => !pick.includes(t) && t.length <= 14)).slice(0, 2)]).map(t => ({t}));
  const fill = blanks.map(() => -1);              // 每一格放了哪一張字卡
  let cb = 0, judged = false;
  const br = t => esc(t).replace(/\n/g, '<br>');
  const head = `<div class="le">${c.e || '📘'}</div><h2>${esc(c.t)}</h2>`;
  const put = k => (tiles[fill[k]] || {t: '？'}).t;
  const text = fog => segs.map(g => g.t !== undefined ? br(g.t)
    : g.blank === undefined || !fog ? `<b>${esc(g.k)}</b>`
    : judged ? (put(g.blank) === g.k ? `<b class="got">${esc(g.k)}</b>` : `<span class="blank no" data-n="${g.blank + 1}"><s>${esc(put(g.blank))}</s> <b>${esc(g.k)}</b></span>`)
    : `<span class="blank ${g.blank === cb ? 'cur' : ''} ${fill[g.blank] >= 0 ? 'full' : ''}" data-b="${g.blank}" data-n="${g.blank + 1}" data-a="${esc(g.k)}">${fill[g.blank] >= 0 ? esc(put(g.blank)) : '？'}</span>`).join('');
  const learn = () => {
    box.innerHTML = `<div class="lcard"><span class="tag">💎 知識碎片</span>${head}<div class="lb">${text(false)}</div></div>
      <div class="row c"><button class="btn" id="go">記住了！🌫️</button></div><p class="mute sm c">按下後，迷霧怪會偷走幾個關鍵字，看你能不能放回去</p>`;
    $('#go', box).onclick = () => { sfx.tap(); fog(); };
  };
  const fog = () => {
    const full = fill.every(f => f >= 0);
    box.innerHTML = (judged ? `<div class="lcard"><span class="tag">🔍 檢查結果：綠色是填對的，紅色是填錯的</span>` : `<div class="lcard fogged"><span class="tag">🌫️ 迷霧來襲！把關鍵字放回去</span>`) + `${head}<div class="lb">${text(true)}</div></div>` + (judged ? '' :
      `<div class="tiles">${tiles.map((t, k) => `<button class="tile2" data-k="${k}" ${fill.includes(k) ? 'disabled' : ''}>${esc(t.t)}</button>`).join('')}</div>
      <p class="mute sm c">點字卡放進發亮的空格；點已經填好的空格可以把字卡拿回來。全部填好再按「確定作答」，只有一次機會。</p>
      <div class="row c cfrow"><button class="btn" id="cf" ${full ? '' : 'disabled'}>${full ? '確定作答 ✔' : '先把空格填滿'}</button></div>`) + '<div id="rf" aria-live="polite"></div>';
  };
  const whyNot = t => {                          // 這張字卡為什麼不是這一格
    const j = blanks.indexOf(t);
    if (j >= 0) return `「${esc(t)}」是第 ${j + 1} 格的答案。`;
    if (c.b.includes('**' + t + '**')) return `「${esc(t)}」已經出現在這段文字裡了（看看粗體字）。`;
    const home = x.L.cards.find(o => o !== c && o.b.includes('**' + t + '**'));
    return home ? `「${esc(t)}」屬於〈${esc(home.t)}〉那一段，跟這句話無關。` : `「${esc(t)}」不屬於這一段。`;
  };
  const judge = () => {
    judged = true;
    const bad = blanks.map((a, k) => put(k) === a ? '' : `第 ${k + 1} 格你填了「${esc(put(k))}」：${whyNot(put(k))}這一格應該是「<b>${esc(a)}</b>」。`).filter(Boolean);
    bad.length ? sfx.no() : sfx.ok(); tally(x.u.id, !bad.length); fog();
    $('#rf', box).innerHTML = note(bad.length ? `<b class="no">✘ 有 ${bad.length} 格填錯了</b><br>${bad.join('<br>')}` : '<b class="ok">✔ 全部填對了！</b>每個關鍵字都回到正確的位置。', !bad.length);
    earn(x, 8, bad.length ? 3 : 6);
    nextBtn($('#rf', box), '收進圖鑑 →', bad.length > 0, () => done());
  };
  box.onclick = e => {
    if (judged) return;
    if (e.target.closest('#cf')) { if (fill.every(f => f >= 0)) judge(); return; }
    const bl = e.target.closest('.blank[data-b]');
    if (bl) { const k = +bl.dataset.b; fill[k] = -1; cb = k; sfx.tap(); return fog(); }
    const b = e.target.closest('.tile2'); if (!b || b.disabled) return;
    if (cb < 0 || fill[cb] >= 0) cb = fill.indexOf(-1); if (cb < 0) return;
    fill[cb] = +b.dataset.k; sfx.tap();
    const nx = fill.findIndex((f, k) => f < 0 && k > cb); cb = nx >= 0 ? nx : fill.indexOf(-1);
    fog();
  };
  learn();
}
function stepQuick(box, x, done, c) {            // 關鍵字太少的卡片：直接用一題快問（只有一次機會）
  const head = `<div class="lcard"><span class="tag">💎 知識碎片</span><div class="le">${c.e || '📘'}</div><h2>${esc(c.t)}</h2><div class="lb">${md(c.b)}</div></div>`;
  if (!c.chk) { box.innerHTML = head + '<div class="row c"><button class="btn" id="go">收進圖鑑 →</button></div>'; $('#go', box).onclick = () => { earn(x, 8, 6); done(); }; return; }
  const q = chkQ(c), opts = shuffle([q.right, ...q.wrongs]); let pick = -1;
  (x.seen = x.seen || []).push(q);                 // 記下來：Boss 戰會把相同的題目排到最後
  box.innerHTML = head + `<div class="chk"><div class="chkt">⚡ 快速確認：選好後按「確定作答」，只有一次機會</div><div class="qq">${esc(q.q)}</div>${optsHTML(opts, 'ABC')}${CONFIRM}<div id="qf" aria-live="polite"></div></div>`;
  box.onclick = e => {
    const b = e.target.closest('.opt');
    if (b && !b.disabled) { pick = +b.dataset.i; return pickOpt(box, b); }
    if (!e.target.closest('#cf') || pick < 0) return;
    const ok = opts[pick] === q.right, rq = x.u.all.find(o => sameQ(o, q)); revealOpts(box, q, opts, pick); ok ? sfx.ok() : sfx.no();
    if (rq) record(rq, ok);                        // 答錯也會記進錯題本
    $('#qf', box).innerHTML = note(ok ? '<b class="ok">✔ 答對了！</b>每個選項為什麼對、為什麼錯，都寫在選項下面。'
      : `<b class="no">✘ 答錯了</b>　正確答案是「<b>${esc(q.right)}</b>」。看看選項下面的說明，弄懂為什麼。`, ok);
    nextBtn($('#qf', box), '收進圖鑑 →', !ok, () => { earn(x, 8, ok ? 6 : 3); done(); });
  };
}

/* --- 步驟：掃描（點光點收集資料 → 辨識測試：選好再按「確定作答」） --- */
function stepScan(box, x, done, c) {
  const items = c.flip, seen = new Set(); let phase = 0, tests = [], ti = 0, miss = 0, lastInfo = '', pick = -1, judged = false;
  const order = shuffle(items.map((_, i) => i));
  const draw = () => {
    const q = phase === 1 ? items[tests[ti]] : null, ans = tests[ti];
    box.innerHTML = `<div class="lcard"><span class="tag">📡 掃描任務</span><div class="le">${c.e || '📡'}</div><h2>${esc(c.t)}</h2><div class="lb">${md(c.b)}</div></div>
      <div class="scan"><div class="scanh">${phase === 0 ? `點擊每個訊號源，收集資料（${seen.size} / ${items.length}）` : `🔎 辨識測試 ${ti + 1} / ${tests.length}：下面這段資料屬於哪一個訊號源？選好再按「確定作答」`}</div>
      ${q ? `<div class="sinfo ask">${md(q[1])}</div>` : ''}
      <div class="orbs">${order.map((i, k) => `<button class="orb2 ${phase === 0 && seen.has(i) ? 'seen' : ''} ${phase === 1 && !judged && i === pick ? 'sel' : ''} ${judged ? (i === ans ? 'right' : i === pick ? 'wrong' : 'dim') : ''}" data-i="${i}" ${judged ? 'disabled' : ''} style="--d:${-k * 0.7}s">${md(items[i][0])}</button>`).join('')}</div>
      ${phase === 0 ? `<div class="sinfo">${lastInfo || '👆 點上面發亮的訊號源'}</div>` : ''}
      ${phase === 0 && seen.size === items.length ? '<div class="row c"><button class="btn pulse" id="go">資料收集完成，開始辨識 🔎</button></div>' : ''}
      ${phase === 1 && !judged ? `<div class="row c cfrow"><button class="btn" id="cf" ${pick < 0 ? 'disabled' : ''}>${pick < 0 ? '先選一個訊號源' : '確定作答 ✔'}</button></div>` : ''}
      <div id="sf" aria-live="polite"></div></div>`;
    const go = $('#go', box); if (go) go.onclick = () => { phase = 1; tests = shuffle(items.map((_, i) => i)).slice(0, Math.min(3, items.length)); ti = 0; pick = -1; sfx.tap(); draw(); };
  };
  box.onclick = e => {
    if (phase === 1 && !judged && e.target.closest('#cf')) {
      if (pick < 0) return;
      judged = true; const ans = tests[ti], ok = pick === ans; if (!ok) miss++; ok ? sfx.ok() : sfx.no(); tally(x.u.id, ok); draw();
      $('#sf', box).innerHTML = note(ok ? `<b class="ok">✔ 答對了！</b>這段資料說的就是「${md(items[ans][0])}」。`
        : `<b class="no">✘ 不是「${md(items[pick][0])}」。</b>它的資料是：${md(items[pick][1])}<br>這段資料說的是「<b>${md(items[ans][0])}</b>」（綠色那個）。`, ok);
      const last = ti + 1 >= tests.length;
      return nextBtn($('#sf', box), last ? '完成辨識 →' : '下一題 →', !ok, () => { if (last) { earn(x, 8, miss ? 3 : 6); return done(); } ti++; pick = -1; judged = false; draw(); });
    }
    const b = e.target.closest('.orb2'); if (!b || b.disabled) return; const i = +b.dataset.i;
    if (phase === 0) { seen.add(i); sfx.tap(); lastInfo = `<b>${md(items[i][0])}</b><br>${md(items[i][1])}`; return draw(); }
    if (judged) return;
    pick = i; sfx.tap(); $$('.orb2', box).forEach(o => o.classList.toggle('sel', o === b));
    const cf = $('#cf', box); if (cf) { cf.disabled = false; cf.textContent = '確定作答 ✔'; }
  };
  draw();
}

/* --- 步驟：試煉小遊戲 --- */
function stepGame(box, x, done) {
  const g = x.L.game, meta = GK[gameKind(x.u, g)];
  box.innerHTML = `<div class="gm"><div class="gmt">${meta.ic} ${esc(meta.name)}<small>${esc(g.title || '')}</small></div><p class="mute">${esc(meta.ask(g))}</p><div id="gb"></div></div>`;
  if (window.__fast) window.__GK = GK;
  const gb = $('#gb', box); gb.__tal = ok => tally(x.u.id, ok);
  meta.run(gb, g, miss => {
    earn(x, 15, miss ? 10 : 20); bump('game'); sfx.win(); if (!miss) confetti();
    box.innerHTML = `<div class="panel result"><div class="big">${miss ? '🎮' : '💯'}</div><h1>${miss ? '試煉通過！' : '完美過關，零失誤！'}</h1><p>失誤 ${miss} 次</p>
      ${g.recap ? `<div class="exp good">🧠 記起來：${md(g.recap)}</div>` : ''}<div class="row c" style="margin-top:14px"><button class="btn pulse" id="go">繼續 →</button></div></div>`;
    $('#go', box).onclick = () => done({miss});
  });
}
function gMemory(box, g, fin) {                  // 記憶翻牌：先記住說明牌的位置，蓋牌後依照題目找出對的那一張
  const cards = shuffle(g.pairs.map((p, i) => ({i, t: p[1]}))), order = shuffle(g.pairs.map((_, i) => i)), solved = new Set();
  let phase = 0, qi = 0, pick = -1, judged = false, miss = 0;
  const draw = () => {
    const want = order[qi];
    box.innerHTML = (phase === 0 ? '<p class="mute c">先記住每張說明牌的位置，記好了就按「蓋牌」。</p>' : `<div class="btarget">🎯 找出「<b>${md(g.pairs[want][0])}</b>」的說明牌 <small>（${qi + 1} / ${order.length}）</small></div>`) +
      `<div class="mem">${cards.map((c, k) => { const up = phase === 0 || solved.has(c.i) || (judged && (k === pick || c.i === want));
        const cls = !up ? (k === pick ? 'sel' : '') : 'on' + (solved.has(c.i) || (judged && c.i === want) ? ' ok' : '') + (judged && k === pick && c.i !== want ? ' no' : '');
        return `<button class="mc ${cls}" data-k="${k}" ${up || judged ? 'disabled' : ''}><span class="mf">✦</span><span class="mb">${md(c.t)}</span></button>`; }).join('')}</div>` +
      (phase === 0 ? '<div class="row c"><button class="btn pulse" id="cover">記好了，蓋牌！🃏</button></div>' : judged ? '' : `<div class="row c cfrow"><button class="btn" id="cf" ${pick < 0 ? 'disabled' : ''}>${pick < 0 ? '先選一張牌' : '翻開它 ✔'}</button></div>`) +
      `<div id="gf" aria-live="polite"></div><p class="mute sm" id="gi">失誤 ${miss}</p>`;
  };
  box.onclick = e => {
    if (e.target.closest('#cover')) { phase = 1; sfx.tap(); return draw(); }
    if (phase === 0 || judged) return;
    if (e.target.closest('#cf')) {
      if (pick < 0) return;
      judged = true; const want = order[qi], c = cards[pick], ok = c.i === want; if (!ok) miss++;
      ok ? sfx.ok() : sfx.no(); draw();
      gsay(box, ok ? `<b class="ok">✔ 找到了！</b>「${md(g.pairs[want][0])}」── ${md(g.pairs[want][1])}`
        : `<b class="no">✘ 翻錯了。</b>這張是「${md(c.t)}」，那是「${md(g.pairs[c.i][0])}」的說明。<br>「${md(g.pairs[want][0])}」的說明是綠色那張：${md(g.pairs[want][1])}`, ok);
      return nextBtn($('#gf', box), qi + 1 < order.length ? '下一張 →' : '完成 →', !ok, () => { solved.add(want); qi++; pick = -1; judged = false; if (qi >= order.length) return fin(miss); draw(); });
    }
    const b = e.target.closest('.mc'); if (!b || b.disabled) return;
    pick = +b.dataset.k; sfx.tap(); $$('.mc', box).forEach(o => o.classList.toggle('sel', o === b));
    const cf = $('#cf', box); if (cf) { cf.disabled = false; cf.textContent = '翻開它 ✔'; }
  };
  draw();
}
function gBubbles(box, g, fin) {
  const order = shuffle(g.pairs.map((_, i) => i)), bubbles = shuffle(g.pairs.map((p, i) => ({i, t: p[1]}))), gone = new Set();
  let qi = 0, miss = 0, pick = -1, judged = false;
  const draw = () => {
    const want = order[qi];
    box.innerHTML = `<div class="btarget">🎯 <b>${md(g.pairs[want][0])}</b> <small>（${qi + 1} / ${order.length}）</small></div><div class="arena">${bubbles.map((b, k) => gone.has(b.i) ? '' :
      `<button class="bb ${!judged && k === pick ? 'sel' : ''} ${judged ? (b.i === want ? 'right' : k === pick ? 'wrong' : '') : ''}" data-k="${k}" ${judged ? 'disabled' : ''} style="--t:${4 + k % 3}s;--d:${-k * 1.1}s">${md(b.t)}</button>`).join('')}</div>` +
      (judged ? '' : `<div class="row c cfrow"><button class="btn" id="cf" ${pick < 0 ? 'disabled' : ''}>${pick < 0 ? '先瞄準一顆泡泡' : '發射 ✔'}</button></div>`) +
      `<div id="gf" aria-live="polite"></div><p class="mute sm" id="gi">失誤 ${miss}</p>`;
  };
  box.onclick = e => {
    if (judged) return;
    if (e.target.closest('#cf')) {
      if (pick < 0) return;
      judged = true; const want = order[qi], p = bubbles[pick].i, ok = p === want; if (!ok) miss++;
      ok ? sfx.zap() : sfx.no(); draw();
      gsay(box, ok ? `<b class="ok">✔ 命中！</b>「${md(g.pairs[want][0])}」── ${md(g.pairs[want][1])}`
        : `<b class="no">✘ 打錯泡泡了。</b>這顆泡泡說的是「${md(g.pairs[p][0])}」，不是「${md(g.pairs[want][0])}」。<br>「${md(g.pairs[want][0])}」是綠色那顆：${md(g.pairs[want][1])}`, ok);
      return nextBtn($('#gf', box), qi + 1 < order.length ? '下一個目標 →' : '完成 →', !ok, () => { gone.add(want); qi++; pick = -1; judged = false; if (qi >= order.length) return fin(miss); draw(); });
    }
    const b = e.target.closest('.bb'); if (!b || b.disabled) return;
    pick = +b.dataset.k; sfx.tap(); $$('.bb', box).forEach(o => o.classList.toggle('sel', o === b));
    const cf = $('#cf', box); if (cf) { cf.disabled = false; cf.textContent = '發射 ✔'; }
  };
  draw();
}
function gMeteor(box, g, fin) {
  const items = shuffle(g.items), B = k => md(g.buckets[k]); let i = 0, miss = 0, pick = -1, judged = false;
  box.innerHTML = `<div class="sky" id="sky"></div><div class="bks n${g.buckets.length}">${g.buckets.map((b, k) => `<button class="bk" data-k="${k}">${md(b)}</button>`).join('')}</div>
    <div class="row c cfrow"><button class="btn" id="cf" disabled>先選一個類別</button></div><div id="gf" aria-live="polite"></div><p class="mute sm" id="gi"></p>`;
  const sky = $('#sky', box);
  const info = () => { $('#gi', box).textContent = `第 ${i + 1} / ${items.length} 顆　失誤 ${miss}`; };
  const spawn = () => {
    pick = -1; judged = false; gsay(box, '');
    $$('.bk', box).forEach(b => { b.classList.remove('sel', 'good', 'no'); b.disabled = false; });
    const cf = $('#cf', box); cf.disabled = true; cf.textContent = '先選一個類別'; cf.parentNode.hidden = false;
    sky.innerHTML = `<div class="met" style="animation-duration:${window.__fast ? 600 : Math.max(6, 10 - i * 0.4)}s"><i>☄️</i><span>${md(items[i][0])}</span></div>`;
    sky.firstChild.onanimationend = () => { const m = $('.met', sky); if (m && !judged) m.classList.add('wait'); };   // 落到底就停住等你作答，不會自動跳過
    info();
  };
  box.onclick = e => {
    if (judged) return;
    const b = e.target.closest('.bk');
    if (b) { pick = +b.dataset.k; sfx.tap(); $$('.bk', box).forEach(o => o.classList.toggle('sel', o === b)); const cf = $('#cf', box); cf.disabled = false; cf.textContent = '發射 ✔'; return; }
    if (!e.target.closest('#cf') || pick < 0) return;
    judged = true; const it = items[i], ok = pick === it[1], m = $('.met', sky);
    if (m) { m.style.top = getComputedStyle(m).top; m.style.animationPlayState = 'paused'; m.classList.remove('wait'); }
    $$('.bk', box).forEach(o => { o.disabled = true; o.classList.remove('sel'); });
    $(`.bk[data-k="${it[1]}"]`, box).classList.add('good'); $('#cf', box).parentNode.hidden = true;
    if (ok) { sfx.zap(); if (m) m.classList.add('boom'); } else { miss++; sfx.no(); $(`.bk[data-k="${pick}"]`, box).classList.add('no'); }
    info();
    gsay(box, ok ? `<b class="ok">✔ 擊碎！</b>「${md(it[0])}」屬於「${B(it[1])}」。` : `<b class="no">✘ 分錯類了。</b>「${md(it[0])}」屬於「${B(it[1])}」，不是「${B(pick)}」。`, ok);
    nextBtn($('#gf', box), i + 1 < items.length ? '下一顆 →' : '完成 →', !ok, () => { if (++i >= items.length) return fin(miss); spawn(); });
  };
  spawn();
}
function gStars(box, g, fin) {
  const want = g.items, n = want.length, cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), slot = shuffle([...Array(n).keys()]);
  let seq = [], judged = false;
  const lines = ord => {                          // 依照順序把星星連起來
    const wrap = $('.cons', box), cl = $('.cl', box); if (!wrap || ord.length < 2) return; const w = wrap.getBoundingClientRect();
    const pt = k => { const r = $(`.st2[data-k="${k}"]`, box).getBoundingClientRect(); return [r.left - w.left + r.width / 2, r.top - w.top + 16]; };
    cl.innerHTML = ord.slice(1).map((k, j) => { const a = pt(ord[j]), b = pt(k); return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`; }).join('');
  };
  const draw = () => {
    box.innerHTML = `<div class="cons" style="height:${rows * 108 + 40}px"><svg class="cl"></svg>${want.map((t, k) => { const r = Math.floor(slot[k] / cols), c = slot[k] % cols, at = seq.indexOf(k);
      const cls = judged ? (seq[k] === k ? 'on' : 'on no') : at >= 0 ? 'on' : '';
      return `<button class="st2 ${cls}" data-k="${k}" ${judged ? 'disabled' : ''} style="left:${(c + 0.5) / cols * 100}%;top:${r * 108 + 8 + (c % 2 ? 24 : 0)}px"><i>${judged ? k + 1 : at >= 0 ? at + 1 : '✦'}</i><span>${md(t)}</span>${judged && seq[k] !== k ? `<em>你排第 ${at + 1}</em>` : ''}</button>`; }).join('')}</div>` +
      (judged ? '' : `<p class="mute sm c">依照順序點星星；點最後一顆可以取消。全部排好再按「確定作答」。</p><div class="row c cfrow"><button class="btn" id="cf" ${seq.length === n ? '' : 'disabled'}>${seq.length === n ? '確定作答 ✔' : `還有 ${n - seq.length} 顆`}</button></div>`) +
      '<div id="gf" aria-live="polite"></div>';
    lines(judged ? want.map((_, k) => k) : seq);
  };
  const judge = () => {
    judged = true; const bad = want.map((t, j) => seq[j] === j ? '' : `第 ${j + 1} 個應該是「${md(t)}」，你放了「${md(want[seq[j]])}」。`).filter(Boolean);
    bad.length ? sfx.no() : sfx.ok(); draw();
    gsay(box, bad.length ? `<b class="no">✘ 有 ${bad.length} 個位置排錯了</b><br>${bad.join('<br>')}<br>星座已經換成正確的順序。` : '<b class="ok">✔ 順序完全正確！</b>星座連起來了。', !bad.length);
    nextBtn($('#gf', box), '完成 →', bad.length > 0, () => fin(bad.length));
  };
  box.onclick = e => {
    if (judged) return;
    if (e.target.closest('#cf')) { if (seq.length === n) judge(); return; }
    const b = e.target.closest('.st2'); if (!b) return; const k = +b.dataset.k, at = seq.indexOf(k);
    if (at >= 0) { if (at === seq.length - 1) { seq.pop(); sfx.tap(); draw(); } return; }
    seq.push(k); sfx.tap(); draw();
  };
  draw();
}
function gSentence(box, g, fin) {
  const want = g.items, pool = shuffle(want.map(t => ({t}))); let seq = [], judged = false;
  const draw = () => {
    const allOk = judged && want.every((t, j) => pool[seq[j]].t === t);
    box.innerHTML = `<div class="sent">${want.map((t, j) => j < seq.length ? `<span class="w ${judged ? (pool[seq[j]].t === t ? 'on' : 'no') : 'full'}" ${judged ? '' : `data-j="${j}"`}>${esc(pool[seq[j]].t)}</span>` : '<span class="w">＿</span>').join('')}</div>` +
      (judged ? (allOk ? '' : `<div class="sent ans">${want.map(t => `<span class="w on">${esc(t)}</span>`).join('')}</div>`)
        : `<div class="chips">${pool.map((p, k) => `<button class="chip2" data-k="${k}" ${seq.includes(k) ? 'disabled' : ''}>${esc(p.t)}</button>`).join('')}</div>
        <p class="mute sm c">點字詞依序放進句子；點句子裡的字可以拿回來。排好再按「確定作答」。</p>
        <div class="row c cfrow"><button class="btn" id="cf" ${seq.length === want.length ? '' : 'disabled'}>${seq.length === want.length ? '確定作答 ✔' : '先把句子排完'}</button></div>`) +
      '<div id="gf" aria-live="polite"></div>';
  };
  const judge = () => {
    judged = true; const bad = want.map((t, j) => pool[seq[j]].t === t ? '' : `第 ${j + 1} 個應該是「${esc(t)}」，你放了「${esc(pool[seq[j]].t)}」。`).filter(Boolean);
    bad.length ? sfx.no() : sfx.ok(); draw();
    gsay(box, bad.length ? `<b class="no">✘ 有 ${bad.length} 個位置放錯了</b><br>${bad.join('<br>')}<br>正確的句子在第二行。` : '<b class="ok">✔ 句子完全正確！</b>', !bad.length);
    nextBtn($('#gf', box), '完成 →', bad.length > 0, () => fin(bad.length));
  };
  box.onclick = e => {
    if (judged) return;
    if (e.target.closest('#cf')) { if (seq.length === want.length) judge(); return; }
    const w = e.target.closest('.w[data-j]'); if (w) { seq.splice(+w.dataset.j, 1); sfx.tap(); return draw(); }
    const b = e.target.closest('.chip2'); if (!b || b.disabled) return; seq.push(+b.dataset.k); sfx.tap(); draw();
  };
  draw();
}
function gLink(box, g, fin) {
  const n = g.pairs.length, Ls = shuffle(g.pairs.map((p, i) => ({i, t: p[0]}))), Rs = shuffle(g.pairs.map((p, i) => ({i, t: p[1]})));
  const tag = i => 'ABCDEFGH'[Ls.findIndex(p => p.i === i)];
  let sel = -1, pair = {}, judged = false;          // pair[左邊 i] = 右邊 i
  const owner = r => { const k = Object.keys(pair).find(l => pair[l] === r); return k === undefined ? -1 : +k; };
  const draw = () => {
    const cnt = Object.keys(pair).length;
    box.innerHTML = `<div class="mcols"><div class="mcol">${Ls.map(p => `<button class="tile ${sel === p.i ? 'sel' : ''} ${judged ? (pair[p.i] === p.i ? 'okk' : 'no') : ''}" data-s="l" data-i="${p.i}" ${judged ? 'disabled' : ''}><span class="tb">${tag(p.i)}</span>${md(p.t)}</button>`).join('')}</div>
      <div class="mcol">${Rs.map(p => { const o = judged ? p.i : owner(p.i); return `<button class="tile r ${judged ? (owner(p.i) === p.i ? 'okk' : 'no') : ''}" data-s="r" data-i="${p.i}" ${judged ? 'disabled' : ''}>${o >= 0 ? `<span class="tb">${tag(o)}</span>` : ''}${md(p.t)}</button>`; }).join('')}</div></div>` +
      (judged ? '' : `<p class="mute sm c">先點左邊，再點右邊相配的卡片（配錯可以重新配）。全部配好再按「確定作答」。</p><div class="row c cfrow"><button class="btn" id="cf" ${cnt === n ? '' : 'disabled'}>${cnt === n ? '確定作答 ✔' : `已配對 ${cnt} / ${n}`}</button></div>`) +
      '<div id="gf" aria-live="polite"></div>';
  };
  const judge = () => {
    judged = true; const bad = Ls.filter(p => pair[p.i] !== p.i).map(p => `「${md(p.t)}」應該配「${md(g.pairs[p.i][1])}」；你配的「${md(g.pairs[pair[p.i]][1])}」其實是在說「${md(g.pairs[pair[p.i]][0])}」。`);
    bad.length ? sfx.no() : sfx.ok(); draw();
    gsay(box, bad.length ? `<b class="no">✘ 有 ${bad.length} 組配錯了</b><br>${bad.join('<br>')}<br>右邊卡片的代號已經換成正確的配對。` : '<b class="ok">✔ 全部配對正確！</b>', !bad.length);
    nextBtn($('#gf', box), '完成 →', bad.length > 0, () => fin(bad.length));
  };
  box.onclick = e => {
    if (judged) return;
    if (e.target.closest('#cf')) { if (Object.keys(pair).length === n) judge(); return; }
    const b = e.target.closest('.tile'); if (!b) return; const i = +b.dataset.i;
    if (b.dataset.s === 'l') { sel = sel === i ? -1 : i; sfx.tap(); return draw(); }
    if (sel < 0) return toast('先點左邊的卡片喔');
    const o = owner(i); if (o >= 0) delete pair[o];
    pair[sel] = i; sel = -1; sfx.tap(); draw();
  };
  draw();
}

/* ---------- 戰鬥引擎（Boss／守護者／突襲／錯題） ---------- */
let timerId = null;
const stopTimer = () => { if (timerId) { clearInterval(timerId); timerId = null; } };
const FOES = ['👾', '🐙', '👹', '🤖', '🦑', '👻', '🦂', '🕷️'];
function battle(box, cfg, done) {
  const H = cfg.hearts || 3, TR = !!cfg.train, pool = cfg.order ? cfg.qs.slice() : shuffle(cfg.qs);   // TR：弱點特訓（不會輸，題目全部做完）
  const total = cfg.timer || TR ? pool.length : Math.min(pool.length, (cfg.n || 8) + H - 1);  // 每題只問一次
  const K = cfg.timer || TR ? Infinity : Math.max(1, total - (H - 1)), dmg = 100 / K;            // 打倒迷霧獸需要命中 K 次
  let queue = pool.slice(0, total), cur = null, locked = true, over = false, paused = false;
  const st = {hp: 100, dealt: 0, hearts: H, combo: 0, maxCombo: 0, right: 0, total: 0, asked: 0, log: [], scan: cfg.timer || TR ? 0 : 1, shield: cfg.timer || TR ? 0 : 1, shieldOn: false, kills: 0, left: cfg.timer || 0};
  const CH = TR ? (cfg.chapters || []).map(uid => ({uid, n: queue.filter(q => q.uid === uid).length, r: 0})).filter(c => c.n) : [];
  const Q = s => box.querySelector(s);
  const top = TR ? `<div class="foe fogs" id="foe">${CH.map(c => `<div class="fogc" data-u="${c.uid}" style="--f:1">${planet(UNITS[c.uid])}<small>${esc(UNITS[c.uid].t)}</small><em>0 / ${c.n}</em></div>`).join('')}</div>`
    : `<div class="foe" id="foe"><div class="fe" id="fe">${cfg.e}</div><div class="finfo"><div class="fname">${esc(cfg.name)}</div>${cfg.timer ? `<div class="timer" id="tm">${st.left}</div>` : '<div class="hpb"><i id="hp"></i></div>'}</div></div>`;
  box.innerHTML = `<div class="bt${TR ? ' train' : ''}" id="bt">${top}
    <div class="beam" id="beam"></div>
    <div class="mebar"><span class="me">${P().ship}</span><span id="hearts"></span><span class="combo" id="combo"></span><span class="skills">${cfg.timer ? '<b id="kills"></b>' : TR ? '' : '<button class="skb" id="sk1"></button><button class="skb" id="sk2"></button>'}</span></div>
    <div id="qa"></div></div>`;
  const hud = () => {
    if (cfg.timer) Q('#kills').textContent = '擊退 ' + st.kills + ' 隻';
    else if (TR) {                                 // 每一章答對越多，迷霧散得越開
      Q('#hearts').textContent = `第 ${Math.max(1, st.asked)} / ${total} 題　答對 ${st.right}`;
      CH.forEach(c => { const el = Q(`.fogc[data-u="${c.uid}"]`); el.style.setProperty('--f', (1 - c.r / c.n).toFixed(2)); $('em', el).textContent = c.r + ' / ' + c.n; });
    } else {
      st.hp = Math.max(0, 100 * (1 - st.dealt / K)); Q('#hp').style.width = st.hp + '%';
      Q('#hearts').textContent = '❤️'.repeat(Math.max(0, st.hearts)) + '🖤'.repeat(H - Math.max(0, st.hearts));
      Q('#sk1').textContent = '🔍 掃描 ×' + st.scan; Q('#sk1').disabled = !st.scan || locked;
      Q('#sk2').textContent = st.shieldOn ? '🛡️ 護盾啟動中' : '🛡️ 護盾 ×' + st.shield; Q('#sk2').disabled = !st.shield || st.shieldOn;
    }
    Q('#combo').textContent = st.combo > 1 ? '🔥 連擊 ×' + st.combo : '';
  };
  const fxe = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const fx = (id, cls) => fxe(Q('#' + id), cls);
  const pop = t => { const d = document.createElement('span'); d.className = 'dmg'; d.textContent = t; Q('#foe').appendChild(d); setTimeout(() => d.remove(), 900); };
  const end = () => {
    if (over) return; over = true; locked = true; stopTimer(); document.onkeydown = null;
    const win = cfg.timer || TR ? true : st.dealt >= K - 1e-9, boom = win && !cfg.timer && !TR;
    if (boom) { Q('#foe').classList.add('dead'); sfx.boom(); }
    later(() => done({win, hearts: Math.max(0, st.hearts), right: st.right, total: st.total, maxCombo: st.maxCombo, kills: st.kills, log: st.log}), boom ? 950 : 350);
  };
  const ask = () => {
    if (over) return;
    paused = false;
    if (cfg.timer ? st.left <= 0 : (st.dealt >= K - 1e-9 || st.hearts <= 0)) return end();
    if (!queue.length) return end();                // 題目都問過了：不會重複出題
    const q = queue.shift(), tf = !cfg.timer && q.wrongs.length >= 2 && Math.random() < 0.3; st.asked++;
    cur = {q, tf, pick: null}; locked = false;
    const u = cfg.tag && q.uid && UNITS[q.uid];
    let h = `<div class="qbox">${u ? `<span class="qtag">${esc(subj(q.sid).name)}・${esc(u.t)}</span>\n` : ''}${esc(q.q)}</div>`;
    if (tf) { cur.cand = Math.random() < 0.5 ? q.right : shuffle(q.wrongs)[0];
      h += `<div class="tfc">👉 ${esc(cur.cand)}</div><p class="mute sm c">判斷：這個答案對嗎？</p><div class="tfb"><button class="opt tf" data-tf="1" aria-pressed="false">⭕ 對</button><button class="opt tf" data-tf="0" aria-pressed="false">❌ 不對</button></div>`; }
    else { cur.opts = shuffle([q.right, ...q.wrongs]); h += optsHTML(cur.opts); }
    Q('#qa').innerHTML = h + CONFIRM + '<div id="after" aria-live="polite"></div>'; hud();
  };
  const answer = () => {                         // 按下「確定作答」後才判定，每題只有一次機會
    const b = cur && cur.pick; if (locked || !b) return;
    locked = true; paused = true; st.total++;
    const q = cur.q; let ok, why;
    if (cur.tf) {
      const truth = cur.cand === q.right; ok = (b.dataset.tf === '1') === truth;
      $$('.opt', Q('#qa')).forEach(o => { o.disabled = true; o.classList.remove('sel'); });
      b.classList.add(ok ? 'right' : 'wrong', 'mine'); if (!ok) Q(`.opt[data-tf="${truth ? 1 : 0}"]`).classList.add('right');
      const cf = Q('.cfrow'); if (cf) cf.remove();
      why = truth ? `<br>「${esc(cur.cand)}」是正確答案：${esc(q.exp)}`
        : `<br>「${esc(cur.cand)}」不對：${esc(whyOf(q, cur.cand))}<br>正確答案是「<b>${esc(q.right)}</b>」：${esc(q.exp)}`;
    } else {
      const i = +b.dataset.i; ok = cur.opts[i] === q.right; revealOpts(Q('#qa'), q, cur.opts, i);
      why = `<br><span class="sm">${ok ? '' : `正確答案是「<b>${esc(q.right)}</b>」。`}每個選項為什麼對、為什麼錯，都寫在選項下面。</span>`;
    }
    if (q.id) record(q, ok);
    st.log.push({q, ok});
    const ch = TR && CH.find(c => c.uid === q.uid); if (ch && ok) ch.r++;
    let head;
    if (ok) {
      st.right++; st.combo++; st.maxCombo = Math.max(st.maxCombo, st.combo); st.kills++; bump('right');
      const crit = st.combo >= 3, d = Math.round(dmg * (crit ? 1.5 : 1)); st.dealt += crit ? 1.5 : 1;
      sfx.zap(); fx('beam', 'fire');
      if (TR) { fxe(Q(`.fogc[data-u="${q.uid}"]`), 'clr'); pop(st.combo >= 3 ? '🔥 連擊 ×' + st.combo : '✨ 迷霧散開'); }
      else { fx('foe', 'hit'); pop(cfg.timer ? '💥' : crit ? '爆擊 −' + d : '−' + d); }
      if (cfg.timer) Q('#fe').textContent = FOES[st.kills % FOES.length];
      head = `<b class="ok">✔ 答對了！${TR ? '「' + esc(UNITS[q.uid] ? UNITS[q.uid].t : '') + '」的迷霧散開一些' : cfg.timer ? '擊退一隻迷霧怪' : crit ? '連擊爆擊！' : '命中！'}</b>`;
    } else {
      st.combo = 0; sfx.no(); fx('bt', 'shake');
      if (st.shieldOn) { st.shieldOn = false; st.dealt += 1; fx('foe', 'hit'); pop('🛡️ 反彈'); toast('🛡️ 護盾擋下攻擊，還把它反彈回去！'); } else if (!cfg.timer && !TR) st.hearts--;
      head = TR ? '<b class="no">✘ 答錯了，這題已經記進錯題本。</b>' : '<b class="no">✘ 答錯了，被反擊！</b>';
    }
    save(); hud();
    const fin = cfg.timer ? st.left <= 0 || !queue.length : TR ? !queue.length : st.dealt >= K - 1e-9 || st.hearts <= 0 || !queue.length;
    Q('#after').innerHTML = note(head + why, ok);
    nextBtn(Q('#after'), fin ? '查看結果 →' : cfg.timer ? '下一隻 →' : TR ? '下一題 →' : '繼續戰鬥 →', !ok, ask);
  };
  box.onclick = e => {
    const t = e.target.closest('button'); if (!t || over) return;
    if (t.id === 'cf') return answer();
    if (t.id === 'sk1') { if (locked || !st.scan) return; if (cur.tf) return toast('判斷題不能用掃描'); st.scan--; let n = 0;
      shuffle($$('.opt', Q('#qa'))).forEach(b => { if (n < 2 && cur.opts[+b.dataset.i] !== cur.q.right) { n++; b.disabled = true; b.classList.add('gone');
        if (cur.pick === b) { cur.pick = null; b.classList.remove('sel'); const cf = Q('#cf'); cf.disabled = true; cf.textContent = '先選一個答案'; } } });
      sfx.tap(); return hud(); }
    if (t.id === 'sk2') { if (!st.shield || st.shieldOn) return; st.shield--; st.shieldOn = true; sfx.tap(); return hud(); }
    if (t.classList.contains('opt') && !locked && !t.disabled) { cur.pick = t; pickOpt(Q('#qa'), t); }
  };
  document.onkeydown = e => {
    if (!cur || over) return;
    if (e.key === 'Enter') { const b = locked ? Q('#nx') : Q('#cf'); if (b && !b.disabled) { e.preventDefault(); b.click(); } return; }
    if (locked) return;
    const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
    const b = e.key.length === 1 && i >= 0 && $$('.opt', Q('#qa'))[i]; if (b && !b.disabled) b.click();
  };
  if (cfg.timer) timerId = setInterval(() => { if (paused) return; st.left--; const t = Q('#tm'); if (t) { t.textContent = Math.max(0, st.left); t.classList.toggle('low', st.left <= 10); } if (st.left <= 0 && !locked) end(); }, 1000);
  hud(); ask();
}
const nq = t => String(t).replace(/[\s　，。、？！：；「」『』（）()…_—\-]+/g, '');
const bigram = t => { t = nq(t); const b = new Set(); for (let i = 0; i < t.length - 1; i++) b.add(t.slice(i, i + 2)); return b; };
const sameQ = (a, b) => {                        // 兩題是不是在問同一件事（題目很像、答案一樣）
  if (nq(a.q) === nq(b.q)) return true;
  if (nq(a.right) !== nq(b.right)) return false;
  const A = bigram(a.q), B = bigram(b.q); let n = 0; A.forEach(t => { if (B.has(t)) n++; });
  return n / ((A.size + B.size - n) || 1) >= 0.25;
};
function stepBoss(box, x, done) {
  const boss = bossOf(x.u.id), seen = x.seen || [], fresh = [], again = [];
  x.u.all.forEach(q => (seen.some(o => sameQ(o, q)) ? again : fresh).push(q));     // 題庫＋知識碎片的快問（已去除重複）
  battle(box, {name: boss.n, e: boss.e, qs: [...shuffle(fresh), ...shuffle(again)], order: true, n: 8, hearts: 3}, res => {
    if (res.win) { earn(x, 20 + res.right * 3, 20 + res.hearts * 10); bump('boss'); }
    done(res);
  });
}
function arena(cfg) {                           // 不屬於單一星球的戰鬥
  if (!cfg.qs.length) { app.innerHTML = `<a class="back" href="${cfg.back}">← 返回</a><p class="mute">目前沒有題目。</p>`; return; }
  touchStreak(); save(); document.body.classList.add('playing');
  app.innerHTML = `<div class="stage"><div class="hud"><a href="${cfg.back}" class="hx">✕</a><b>${esc(cfg.title)}</b><span></span></div><div id="sc"></div></div>`;
  battle($('#sc'), cfg, res => {
    const p = P(), xp = res.right * 5, coins = res.win ? 10 + res.right : 0; let extra = '';
    if (cfg.timer) { const k = 'sprint' + DB.grade; if (res.kills > (p.best[k] || 0)) { p.best[k] = res.kills; extra = '🎉 刷新個人紀錄！'; } else extra = `個人最佳：${p.best[k] || 0} 隻`; }
    else if (res.win) bump('boss');
    p.xp += xp; p.coins += coins; save();
    if (res.win) { sfx.win(); if (res.total && res.right / res.total >= .9) confetti(); }
    app.innerHTML = `<div class="quiz"><div class="panel result"><div class="big">${cfg.timer ? '⏱' : res.win ? '🏆' : '💫'}</div>
      <h1>${cfg.timer ? `擊退 ${res.kills} 隻迷霧怪！` : res.win ? '勝利！' : '撤退…再接再厲！'}</h1>
      <p>答對 ${res.right} / ${res.total}　最高連擊 ${res.maxCombo}</p><p>經驗 <b>+${xp}</b>　星塵 <b>+${coins} ✨</b></p><p class="mute">${extra}</p>
      <div class="row c"><button class="btn" id="again">再來一次</button><a class="btn ghost" href="${cfg.back}">返回</a><a class="btn ghost" href="#/wrong">錯題本</a></div></div></div>`;
    $('#again').onclick = () => arena(cfg);
  });
}
function viewMix(sid) {
  const s = subj(sid); if (!s) return viewHome();
  arena({title: s.name + '・星系守護者', back: '#/s/' + sid, name: '星系守護者', e: '🐉', qs: s.units.filter(inGrade).flatMap(u => u.all), n: 15, hearts: 4, tag: true});
}
/* 迷霧突襲／雙人對戰的出題範圍：選年級 → 選科目 →（可以只出指定章節） */
function pickerHTML() {
  return `<div class="chips" id="sp">${SUBJECTS.filter(s => s.units.some(inGrade)).map(s => `<button class="chip on" data-s="${s.id}">${s.icon} ${esc(s.name)}</button>`).join('')}</div>
    <details class="chf" id="chf"><summary>📑 出題章節：<b id="chn">全部章節</b></summary><p class="mute sm">不選＝上面科目的全部章節。點章節可以選或取消；🔴 待加強、🟡 還不穩是比較弱的章節。</p><div id="chl"></div></details>`;
}
function bindPicker() {
  const sel = new Set(), on = () => $$('#sp .on').map(b => b.dataset.s);
  const draw = () => {
    $('#chl').innerHTML = on().map(sid => { const s = subj(sid);
      return `<div class="chg"><b>${s.icon} ${esc(s.name)}</b><div class="chips">${s.units.filter(inGrade).map(u => { const w = weak(u.id);
        return `<button class="chip ${sel.has(u.id) ? 'on' : ''}" data-u="${u.id}" aria-pressed="${sel.has(u.id)}">${w.lv === 3 ? '🔴 ' : w.lv === 2 ? '🟡 ' : ''}${CN[u.g]}${u.s}・${esc(u.t)}</button>`; }).join('')}</div></div>`; }).join('') || '<p class="mute sm">先在上面選科目。</p>';
    $('#chn').textContent = sel.size ? `只出 ${sel.size} 個章節` : '全部章節';
  };
  $('#sp').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; b.classList.toggle('on'); const o = on(); [...sel].forEach(id => { if (!o.includes(UNITS[id].sid)) sel.delete(id); }); draw(); };
  $('#chl').onclick = e => { const b = e.target.closest('[data-u]'); if (!b) return; const id = b.dataset.u; sel.has(id) ? sel.delete(id) : sel.add(id); sfx.tap(); draw(); };
  draw();
  return () => sel.size ? [...sel].flatMap(id => UNITS[id].all) : SUBJECTS.filter(s => on().includes(s.id)).flatMap(s => s.units.filter(inGrade).flatMap(u => u.all));
}
function viewSprint() {
  const p = P();
  app.innerHTML = heroHTML() + `<h1>⏱ 迷霧突襲</h1><p class="mute">60 秒內，迷霧怪一隻接一隻衝過來！選好答案按「確定」，答對就能擊退一隻。每題只出現一次，都會說明對錯原因，看說明的時候計時會暫停。（個人最佳：${p.best['sprint' + DB.grade] || 0} 隻）</p>` +
    gradeChips() + pickerHTML() + `<button class="btn" id="go">開始突襲 🚀</button>`;
  const pool = bindPicker();
  $('#go').onclick = () => { const qs = pool(); if (!qs.length) return toast('先選至少一個科目');
    arena({title: '迷霧突襲', back: '#/sprint', name: '迷霧怪群', e: '👾', timer: 60, tag: true, n: 999, qs}); };
}
function viewWrong() {
  const p = P();
  Object.keys(p.wrong).forEach(id => { if (!QS[id]) delete p.wrong[id]; });
  const list = Object.keys(p.wrong).map(id => QS[id]), by = {};
  list.forEach(q => (by[q.sid] = by[q.sid] || []).push(q));
  app.innerHTML = `<h1>📒 錯題本</h1><p class="mute">答錯的題目會變成「迷霧殘黨」躲在這裡。之後再答對 2 次，牠就會消失。</p>` +
    (list.length ? `<div class="row"><button class="btn" id="redo">👻 錯題復仇戰（${list.length} 題）</button></div>` : '<div class="panel">目前沒有錯題，太厲害了！🎉</div>') +
    Object.keys(by).map(sid => { const s = subj(sid);
      return `<h2>${s.icon} ${esc(s.name)}（${by[sid].length}）</h2><div class="panel"><ul class="wl">` + by[sid].map(q =>
        `<li><div>${esc(q.q)}</div><div class="a">✔ ${esc(q.right)}</div>${q.exp ? `<div class="mute sm">💡 ${esc(q.exp)}</div>` : ''}${(q.whys || []).some(Boolean) ? `<details class="sm why2"><summary>其他選項為什麼錯？</summary><ul>${q.wrongs.map((w, i) => `<li>✘ <b>${esc(w)}</b>：${esc(q.whys[i] || '')}</li>`).join('')}</ul></details>` : ''}<a class="sm" href="#/u/${q.uid}">🪐 回到「${esc(UNITS[q.uid].t)}」</a></li>`).join('') + '</ul></div>';
    }).join('');
  if (list.length) $('#redo').onclick = () => arena({title: '錯題復仇戰', back: '#/wrong', name: '迷霧殘黨', e: '👻', qs: list, n: Math.min(10, list.length), hearts: 3, tag: true});
}

/* ---------- 章節複習：選年級 → 選科目 → 選章節，針對比較弱的章節特訓 ---------- */
const keyTerms = L => [...new Set(L.cards.flatMap(c => (c.b.match(/\*\*(.+?)\*\*/g) || []).map(t => t.slice(2, -2))))];
const weakFirst = (a, b) => { const A = weak(a.id), B = weak(b.id); return B.lv - A.lv || A.acc - B.acc || B.wr - A.wr; };
function viewReview(sid) {
  const p = P(), rv = p.rv, subs = SUBJECTS.filter(s => s.units.some(inGrade));
  const s = subs.find(x => x.id === sid) || subs.find(x => x.id === DB.last) || subs[0]; if (!s) return viewHome();
  rv.sel = rv.sel.filter(id => UNITS[id]);
  const us = s.units.filter(inGrade), groups = {};
  us.forEach(u => (groups[u.g + u.s] = groups[u.g + u.s] || []).push(u));
  app.innerHTML = `<h1>🎯 章節複習</h1>
    <p class="mute">選年級、選科目，再點選想加強的章節（可以跨科目一起選）。每一章都會顯示最近的答對率和錯題數：<span class="wk w3">🔴 待加強</span> <span class="wk w2">🟡 還不穩</span> <span class="wk w1">🟢 很穩</span></p>
    <div class="rvs"><b class="rvn">① 選年級</b>${gradeChips()}</div>
    <div class="rvs"><b class="rvn">② 選科目</b><div class="chips">${subs.map(x => { const n = x.units.filter(inGrade).filter(u => weak(u.id).lv >= 2).length;
      return `<a class="chip ${x.id === s.id ? 'on' : ''}" href="#/review/${x.id}">${x.icon} ${esc(x.name)}${n ? `<i class="wn" title="${n} 個比較弱的章節">${n}</i>` : ''}</a>`; }).join('')}</div></div>
    <div class="rvs"><b class="rvn">③ 選章節 <small class="mute">${esc(s.name)}</small></b>
      <div class="row"><button class="btn ghost sm" id="rauto">🎯 自動選出弱點</button><button class="btn ghost sm" id="rall">這一科全選</button><button class="btn ghost sm" id="rnone">清除這一科</button></div>
      <div id="rlist"></div></div>
    <div class="rvs" id="rgo"></div>`;
  const draw = () => {
    $('#rlist').innerHTML = Object.keys(groups).sort().map(k => `<h3 class="rvh">${CN[groups[k][0].g]}年級${groups[k][0].s}學期</h3>` + groups[k].map(u => { const w = weak(u.id), on = rv.sel.includes(u.id);
      return `<button class="chrow ${on ? 'on' : ''}" data-u="${u.id}" aria-pressed="${on}"><span class="ck">${on ? '✔' : ''}</span>${planet(u)}<span class="cht"><b>${esc(u.t)}</b><small>${esc(u.k)}</small>
        <span class="chs"><em class="wk ${w.cls}">${w.label}</em><small>${w.n ? `最近 ${w.n} 次作答答對 ${pct(w)}%` : '還沒有作答紀錄'}${w.wr ? `・錯題 ${w.wr} 題` : ''}</small></span>${w.n ? `<i class="accb ${w.cls}"><i style="width:${pct(w)}%"></i></i>` : ''}</span></button>`; }).join('')).join('')
      || '<p class="mute">這個年級沒有這個科目的章節。</p>';
    const sel = rv.sel.map(id => UNITS[id]), N = sel.reduce((n, u) => n + u.all.length, 0);
    const opts = [10, 20].filter(k => k < N).concat(0), n = opts.includes(rv.n) ? rv.n : 0, cards = rv.note ? Math.min(4, sel.length) : 0;
    $('#rgo').innerHTML = `<b class="rvn">④ 開始複習</b>` + (sel.length
      ? `<div class="chips">${sel.map(u => `<button class="chip on sm2" data-x="${u.id}" aria-label="取消 ${esc(u.t)}">${subj(u.sid).icon} ${esc(u.t)} ✕</button>`).join('')}</div>
        <div class="row"><span class="mute sm">題數</span>${opts.map(k => `<button class="chip ${k === n ? 'on' : ''}" data-n="${k}">${k ? k + ' 題' : `全部 ${N} 題`}</button>`).join('')}</div>
        <div class="row"><button class="chip ${rv.note ? 'on' : ''}" id="rnote" aria-pressed="${!!rv.note}">${rv.note ? '☑' : '☐'} 先複習重點（每章一張知識碎片）</button></div>
        <button class="btn wide" id="rstart">🚀 開始弱點特訓（${sel.length} 章・${n || N} 題）</button>
        <p class="mute sm">流程：${cards ? `先複習 ${cards} 張重點卡（讀完再把關鍵字填回去）→ ` : ''}${n || N} 題特訓（錯題本裡的題目優先出）→ 看每一章的進步。每題都要按「確定作答」，只有一次機會，對錯都會說明原因。</p>`
      : '<p class="mute">還沒選章節：在上面點章節就能選，也可以按「🎯 自動選出弱點」。</p>');
  };
  const add = list => list.forEach(u => { if (!rv.sel.includes(u.id)) rv.sel.push(u.id); });
  $('#rlist').onclick = e => { const b = e.target.closest('[data-u]'); if (!b) return; const id = b.dataset.u, i = rv.sel.indexOf(id); if (i >= 0) rv.sel.splice(i, 1); else rv.sel.push(id); sfx.tap(); save(); draw(); };
  $('#rgo').onclick = e => {
    const x = e.target.closest('[data-x]'); if (x) { rv.sel = rv.sel.filter(id => id !== x.dataset.x); sfx.tap(); save(); return draw(); }
    const k = e.target.closest('[data-n]'); if (k) { rv.n = +k.dataset.n; sfx.tap(); save(); return draw(); }
    if (e.target.closest('#rnote')) { rv.note = !rv.note; sfx.tap(); save(); return draw(); }
    if (e.target.closest('#rstart') && rv.sel.length) location.hash = '#/train/' + rv.sel.join(',');
  };
  $('#rauto').onclick = () => { const w = us.filter(u => weak(u.id).lv >= 2).sort(weakFirst);
    if (!w.length) return toast(`${s.name}目前沒有偵測到比較弱的章節 👍 可以自己點選想複習的章節`);
    add(w); sfx.tap(); save(); draw(); toast(`選出 ${w.length} 個比較弱的章節`); };
  $('#rall').onclick = () => { add(us); sfx.tap(); save(); draw(); };
  $('#rnone').onclick = () => { rv.sel = rv.sel.filter(id => !us.some(u => u.id === id)); sfx.tap(); save(); draw(); };
  draw();
}
function viewTrain(ids) {
  const p = P(), rv = p.rv, us = [...new Set(ids)].map(id => UNITS[id]).filter(Boolean).sort(weakFirst);
  if (!us.length) { location.hash = '#/review'; return; }
  const before = {}; us.forEach(u => { before[u.id] = weak(u.id); });
  const lists = us.map(u => [...shuffle(u.all.filter(q => p.wrong[q.id])), ...shuffle(u.all.filter(q => !p.wrong[q.id]))]);   // 錯題本裡的題目優先
  const qs = []; for (let k = 0; lists.some(l => l.length); k = (k + 1) % lists.length) if (lists[k].length) qs.push(lists[k].shift());   // 各章輪流出題
  runTrain(us, qs.slice(0, rv.n && rv.n < qs.length ? rv.n : qs.length), rv.note, before);
}
function runTrain(us, qs, notes, before) {
  const back = '#/review/' + us[0].sid, gain = {xp: 0, coins: 0}, steps = [];
  if (notes) us.slice(0, 4).forEach(u => {            // 先複習重點：每章一張知識碎片（讀完再把關鍵字填回去）
    const L = LESSONS[u.id]; if (!L) return;
    const fit = L.cards.filter(c => !c.flip && new Set((c.b.match(/\*\*(.+?)\*\*/g) || []).map(t => t.slice(2, -2)).filter(t => t.length <= 14)).size >= 2);
    const c = shuffle(fit.length ? fit : L.cards.filter(c => c.flip))[0]; if (!c) return;
    steps.push({u, c, f: c.flip ? stepScan : stepRestore, x: {u, s: subj(u.sid), L, terms: keyTerms(L), gain, got: [], lost: false}});
  });
  steps.push({f: null});
  touchStreak(); save(); document.body.classList.add('playing');
  app.innerHTML = `<div class="stage"><div class="hud"><a href="${back}" class="hx">✕</a><b>🎯 弱點特訓</b><span class="dots" id="dots"></span></div><div id="sc"></div></div>`;
  const box = $('#sc'); let i = 0;
  $('.hx', app).onclick = e => { if (!window.__fast && !confirm('確定要離開嗎？這次特訓還沒做完。')) e.preventDefault(); };
  const run = () => {
    $('#dots').innerHTML = steps.map((_, k) => `<i class="${k < i ? 'd' : k === i ? 'c' : ''}"></i>`).join('');
    box.onclick = box.oninput = null; box.innerHTML = ''; window.scrollTo(0, 0);
    const st = steps[i];
    if (st.f) { box.style.setProperty('--c', subj(st.u.sid).color); return st.f(box, st.x, () => { i++; run(); }, st.c); }
    box.style.removeProperty('--c');
    battle(box, {train: true, name: '弱點特訓', qs, order: true, tag: true, chapters: us.map(u => u.id)}, res => trainReport(us, res, gain, back, before));
  };
  run();
}
function trainReport(us, res, gain, back, before) {
  const log = res.log || [], miss = log.filter(l => !l.ok).map(l => l.q), all = res.total && res.right === res.total;
  earn({gain}, 10 + res.right * 5, 10 + res.right * 2);
  sfx.win(); if (all) confetti();
  const rows = us.map(u => { const mine = log.filter(l => l.q.uid === u.id); if (!mine.length) return '';
    const a = before[u.id] || weak(u.id), b = weak(u.id), r = mine.filter(l => l.ok).length;
    return `<div class="rr">${planet(u)}<div class="rrt"><b>${esc(u.t)}</b><small>${esc(subj(u.sid).name)}・這次答對 ${r} / ${mine.length}</small>
      <span class="rrl"><em class="wk ${a.cls}">${a.label}</em> → <em class="wk ${b.cls}">${b.label}</em></span>${b.n ? `<small>最近 ${b.n} 次作答答對 ${pct(b)}%${b.wr ? `・錯題 ${b.wr} 題` : ''}</small>` : ''}</div>
      <a class="btn ghost sm" href="#/codex/${u.id}" title="看這一章的重點筆記">📔<span class="t"> 筆記</span></a></div>`; }).join('');
  app.innerHTML = `<div class="quiz"><div class="panel result rvrep">
    <div class="big">${all ? '🏆' : '🎯'}</div><h1>${all ? '全部答對，太厲害了！' : '特訓完成！'}</h1>
    <p>答對 <b>${res.right} / ${res.total}</b>　最高連擊 ${res.maxCombo}</p><p>本次獲得　經驗 <b>+${gain.xp}</b>　星塵 <b>+${gain.coins} ✨</b></p>
    <h2>各章節的變化</h2><div class="rrs">${rows}</div>
    ${miss.length ? `<h2>這次答錯的 ${miss.length} 題（已經記進錯題本）</h2><div class="panel"><ul class="wl">${miss.map(q => `<li><div>${esc(q.q)}</div><div class="a">✔ ${esc(q.right)}</div>${q.exp ? `<div class="mute sm">💡 ${esc(q.exp)}</div>` : ''}<span class="sm mute">${esc(subj(q.sid).name)}・${esc(UNITS[q.uid].t)}</span></li>`).join('')}</ul></div>` : '<p class="c">這次沒有答錯的題目 🎉</p>'}
    <div class="row c"><button class="btn" id="again">再特訓一次</button>${miss.length ? `<button class="btn ghost" id="redo">👻 只練這次答錯的 ${miss.length} 題</button>` : ''}<a class="btn ghost" href="${back}">回章節複習</a></div></div></div>`;
  $('#again').onclick = () => viewTrain(us.map(u => u.id));
  const rd = $('#redo'); if (rd) rd.onclick = () => { const v = us.filter(u => miss.some(q => q.uid === u.id)), b = {}; v.forEach(u => { b[u.id] = weak(u.id); }); runTrain(v, shuffle(miss), false, b); };
}

/* ---------- 雙人對戰：能量球推擠 ---------- */
function viewDuel() {
  app.innerHTML = `<h1>⚔️ 雙人對戰</h1><p class="mute">兩個人用同一台裝置，兩邊看到同一題。先點選答案，再按自己那邊的「確定」。<b>先答對的人</b>把能量球推向對手。<b>每題每人只能答一次</b>：答錯就失去這題的作答權，並看到為什麼錯；每題結束後，兩邊都會看到每個選項的說明。把球推到對方底線就贏了！<br>鍵盤：左邊玩家用 1 2 3 4 選、5 確定；右邊玩家用 7 8 9 0 選、－ 確定；Enter 進入下一題。手機請面對面坐。</p>` +
    gradeChips() + pickerHTML() + `<button class="btn" id="go">開始對戰 ⚔️</button>`;
  const pool = bindPicker();
  $('#go').onclick = () => { const qs = pool(); if (!qs.length) return toast('先選至少一個科目'); duel(qs); };
}
function duel(qs) {
  const GOAL = 5, list = shuffle(qs), KEYS = ['1234', '7890'], OKK = ['5', '-'];
  let pos = 0, qi = 0, over = false, left = 120, opts = [[], []], out = [false, false], picks = [-1, -1], sel = [-1, -1], solved = false;
  document.body.classList.add('playing');
  app.innerHTML = `<div class="duel"><div class="dbar"><a href="#/duel" class="hx">✕</a><span>🟥</span><div class="track"><i id="orb">⚡</i></div><span>🟦</span><b class="timer" id="dt">${left}</b></div>
    <div class="dsides"><div class="dside a" id="d0"></div><div class="dmid" id="dmid" hidden><button class="btn pulse" id="dnx">下一題 →</button></div><div class="dside b" id="d1"></div></div></div>`;
  const cq = () => list[qi];                       // 每題只出一次；題目出完就比誰的球推得遠
  const side = k => { const q = cq(); opts[k] = shuffle([q.right, ...q.wrongs]);
    $('#d' + k).innerHTML = `<div class="dq">${esc(q.q)}</div>${opts[k].map((o, i) => `<button class="opt" data-k="${k}" data-i="${i}"><span class="k">${KEYS[k][i]}</span><span class="ot">${esc(o)}</span></button>`).join('')}<button class="btn dcf" data-k="${k}" disabled>先選答案</button><div class="dmsg" id="m${k}" aria-live="polite"></div>`; };
  const orb = () => { $('#orb').style.left = (50 + pos * 45 / GOAL) + '%'; };
  const draw = () => { out = [false, false]; picks = [-1, -1]; sel = [-1, -1]; solved = false; side(0); side(1); orb(); $('#dmid').hidden = true; $$('.dside').forEach(d => d.classList.remove('out', 'won')); };
  const end = w => { over = true; stopTimer(); document.onkeydown = null; sfx.win(); confetti();
    app.innerHTML = `<div class="quiz"><div class="panel result"><div class="big">${w === 0 ? '🟥' : w === 1 ? '🟦' : '🤝'}</div><h1>${w === 0 ? '左邊（紅隊）獲勝！' : w === 1 ? '右邊（藍隊）獲勝！' : '平手！'}</h1>
      <div class="row c"><button class="btn" id="again">再比一場</button><a class="btn ghost" href="#/duel">重新設定</a><a class="btn ghost" href="#/">回星圖</a></div></div></div>`;
    $('#again').onclick = () => duel(qs); };
  const solve = w => {                           // 這一題結束：兩邊都公布每個選項的對錯原因
    solved = true;
    [0, 1].forEach(k => {
      const d = $('#d' + k); d.classList.remove('out'); revealOpts(d, cq(), opts[k], picks[k]); const cf = $('.dcf', d); if (cf) cf.remove();
      $('#m' + k).innerHTML = w === k ? '<b class="ok">✔ 答對了！能量球往前推一格。</b>看看其他選項為什麼錯。'
        : w === -1 ? '<b class="no">兩邊都答錯了。</b>看看每個選項的說明。'
        : picks[k] >= 0 ? '<b class="no">✘ 你答錯了，對手答對了。</b>看看每個選項的說明。'
        : '對手先答對了。看看每個選項的說明。';
    });
    $('#dnx').textContent = Math.abs(pos) >= GOAL || qi + 1 >= list.length ? '查看結果 →' : '下一題 →'; $('#dmid').hidden = false;
  };
  const choose = (k, i) => {                     // 第一步：點選答案（還可以改）
    if (over || solved || out[k] || i < 0 || i >= opts[k].length) return;
    sel[k] = i; const d = $('#d' + k); $$('.opt', d).forEach(b => b.classList.toggle('sel', +b.dataset.i === i));
    const cf = $('.dcf', d); cf.disabled = false; cf.textContent = `確定 ✔（${OKK[k] === '-' ? '－' : OKK[k]}）`; sfx.tap();
  };
  const hit = k => {                               // 第二步：按「確定」才判定
    const i = sel[k]; if (over || solved || out[k] || i < 0) return;
    const q = cq(), o = opts[k][i]; picks[k] = i;
    if (o === q.right) { pos += k === 0 ? 1 : -1; sfx.zap(); orb(); $('#d' + k).classList.add('won'); return solve(k); }
    out[k] = true; sfx.no();
    const d = $('#d' + k); d.classList.add('out'); $$('.opt', d).forEach(b => { b.disabled = true; b.classList.remove('sel'); }); $(`.opt[data-i="${i}"]`, d).classList.add('wrong', 'mine'); $('.dcf', d).disabled = true;
    $('#m' + k).innerHTML = `<b class="no">✘ 「${esc(o)}」不對</b>：${esc(whyOf(q, o))}<br><span class="mute">這題你不能再答了，換對手作答。</span>`;
    if (out[0] && out[1]) solve(-1);
  };
  $('#dnx').onclick = () => { if (over || !solved) return; if (Math.abs(pos) >= GOAL) return end(pos > 0 ? 0 : 1); if (++qi >= list.length) return end(pos > 0 ? 0 : pos < 0 ? 1 : 2); draw(); };
  $('.dsides').onclick = e => { const c = e.target.closest('.dcf'); if (c) return hit(+c.dataset.k); const b = e.target.closest('.opt'); if (b) choose(+b.dataset.k, +b.dataset.i); };
  document.onkeydown = e => {
    if (e.key === 'Enter') { if (solved) { e.preventDefault(); $('#dnx').click(); } return; }
    if (e.key.length !== 1) return;
    const k = OKK.indexOf(e.key); if (k >= 0) return hit(k);
    const a = KEYS[0].indexOf(e.key), b = KEYS[1].indexOf(e.key); if (a >= 0) choose(0, a); else if (b >= 0) choose(1, b);
  };
  timerId = setInterval(() => { if (solved || over) return; left--; const t = $('#dt'); if (t) t.textContent = left; if (left <= 0) end(pos > 0 ? 0 : pos < 0 ? 1 : 2); }, 1000);
  draw();
}

/* ---------- 圖鑑 ---------- */
function viewCodex(uid) {
  const u = uid && UNITS[uid];
  if (u) {
    const s = subj(u.sid), L = LESSONS[uid] || {cards: []};
    app.innerHTML = `<a class="back" href="#/codex">← 回圖鑑</a><section class="mission" style="--c:${s.color}"><div class="mhead">${planet(u, true)}<div><div class="mtag">${CN[u.g]}年級${u.s}學期・${esc(s.name)}</div><h1>${esc(u.t)}</h1><div class="mst">${starRow(stars(uid))}</div></div></div>
      ${L.cards.map(c => `<div class="note"><h3>${c.e || ''} ${esc(c.t)}</h3><div class="lb">${md(c.b)}</div>${c.flip ? '<ul>' + c.flip.map(f => `<li><b>${md(f[0])}</b>：${md(f[1])}</li>`).join('') + '</ul>' : ''}</div>`).join('')}
      ${L.game && L.game.recap ? `<div class="exp good">🧠 ${md(L.game.recap)}</div>` : ''}
      <div class="row c" style="margin-top:12px"><a class="btn" href="#/u/${uid}">前往這顆星球 🚀</a></div></section>`;
    return;
  }
  app.innerHTML = `<h1>📔 星球圖鑑</h1><p class="mute sm">探索過的星球會留下重點筆記，考前可以回來翻。</p>` + gradeChips() + SUBJECTS.map(s => {
    const us = s.units.filter(inGrade); if (!us.length) return '';
    return `<h2>${s.icon} ${esc(s.name)}</h2><div class="cdx">` + us.map(v => { const n = stars(v.id);
      return `<a class="cx ${n ? '' : 'lock'}" href="#/${n ? 'codex' : 'u'}/${v.id}">${planet(v)}<b>${esc(v.t)}</b><small>${n ? starRow(n) : '尚未探索'}</small></a>`; }).join('') + '</div>'; }).join('');
}

/* ---------- 我的（進度、機庫、備份） ---------- */
const SHIPS = [['🚀', 0], ['🛸', 60], ['🛰️', 120], ['✈️', 200], ['🚁', 300], ['🦄', 450], ['🐉', 700], ['🧙', 1000]];
function viewMe() {
  const p = P();
  const rows = SUBJECTS.map(s => {
    const got = s.units.reduce((n, u) => n + stars(u.id), 0), lit = s.units.filter(u => stars(u.id) === 3).length;
    const wr = Object.keys(p.wrong).filter(id => QS[id] && QS[id].sid === s.id).length, wk = s.units.filter(u => weak(u.id).lv === 3).length;
    return `<tr><td>${s.icon} ${esc(s.name)}</td><td>${lit} / ${s.units.length}</td><td>★ ${got} / ${s.units.length * 3}</td><td>${wr}</td><td>${wk ? `<a href="#/review/${s.id}">🔴 ${wk} 章</a>` : '—'}</td></tr>`;
  }).join('');
  app.innerHTML = heroHTML() + `<h1>我的進度</h1>
    <div class="panel tscroll"><table><tr><th>星系</th><th>點亮星球</th><th>能量核心</th><th>錯題</th><th>待加強</th></tr>${rows}</table></div>
    <h2>🛠 機庫（用星塵換太空船）</h2><div class="panel hangar">${SHIPS.map(([e, cost]) => { const own = p.ships.includes(e);
      return `<button class="shipb ${p.ship === e ? 'on' : ''}" data-ship="${e}" data-cost="${cost}"><span>${e}</span><small>${p.ship === e ? '使用中' : own ? '點擊使用' : cost + ' ✨'}</small></button>`; }).join('')}</div>
    <h2>切換／新增使用者</h2><div class="panel row">
      <select id="who">${Object.keys(DB.profiles).map(n => `<option ${n === DB.cur ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <input type="text" id="nn" placeholder="新名字" maxlength="12"><button class="btn ghost" id="add">新增並切換</button></div>
    <h2>備份與還原</h2><div class="panel"><p class="mute sm">紀錄只存在這台裝置的瀏覽器裡。換裝置或清除瀏覽資料前，請先匯出備份。</p>
      <div class="row"><button class="btn ghost" id="exp">匯出備份檔</button><label class="btn ghost">匯入備份檔<input type="file" id="imp" accept=".json" hidden></label>
      <button class="btn danger" id="clr">清除「${esc(DB.cur)}」的紀錄</button></div></div>
    <p class="mute sm">資料版本：${esc(META.updated || '')}・${Object.keys(UNITS).length} 顆星球・${Object.keys(LABS).length} 個實驗室・${Object.keys(QS).length} 題</p>`;
  $('.hangar').onclick = e => { const b = e.target.closest('.shipb'); if (!b) return; const s = b.dataset.ship, cost = +b.dataset.cost;
    if (!p.ships.includes(s)) { if (p.coins < cost) return toast('星塵不夠，再多點亮幾顆星球吧！'); p.coins -= cost; p.ships.push(s); sfx.win(); }
    p.ship = s; save(); viewMe(); };
  $('#who').onchange = e => { DB.cur = e.target.value; save(); viewMe(); };
  $('#add').onclick = () => { const n = $('#nn').value.trim(); if (!n) return; DB.cur = n; P(); save(); viewMe(); };
  $('#exp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(DB)], {type: 'application/json'})); a.download = '知識星航備份-' + today() + '.json'; a.click(); };
  $('#imp').onchange = async e => {
    try { const d = JSON.parse(await e.target.files[0].text()); if (!d.profiles) throw 0; DB.profiles = {...DB.profiles, ...d.profiles}; if (d.cur) DB.cur = d.cur; save(); alert('匯入完成'); viewMe(); }
    catch (err) { alert('這不是有效的備份檔'); }
  };
  $('#clr').onclick = () => { if (confirm('確定清除「' + DB.cur + '」的所有紀錄？此動作無法復原。')) { DB.profiles[DB.cur] = blank(); save(); viewMe(); } };
}

/* ---------- 路由 ---------- */
function route() {
  RUN++; stopTimer(); document.onkeydown = null;
  const [, r, a, b] = location.hash.split('/');
  const nav = ['s', 'u', 'play', 'mix', 'learn', 'quiz', 'sprint'].includes(r) ? 'home' : r === 'train' ? 'review' : (r || 'home');
  $$('[data-nav]').forEach(n => { const on = n.dataset.nav === nav; n.classList.toggle('on', on); if (on) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current'); });
  document.body.classList.toggle('playing', ['play', 'learn', 'quiz', 'mix', 'train'].includes(r));
  window.__repark = null;
  const wn = Object.keys(P().wrong).filter(id => QS[id]).length, wb = $('#wbadge'); if (wb) { wb.textContent = wn > 99 ? '99+' : wn; wb.hidden = !wn; }
  if (r === 's') viewSubject(a); else if (r === 'u') viewUnit(a); else if (r === 'play') play(a, b || 'all');
  else if (r === 'learn') play(a, 'all'); else if (r === 'quiz') play(a, 'b');
  else if (r === 'mix') viewMix(a); else if (r === 'sprint') viewSprint(); else if (r === 'duel') viewDuel();
  else if (r === 'review') viewReview(a); else if (r === 'train') viewTrain(decodeURIComponent(a || '').split(','));
  else if (r === 'codex') viewCodex(a); else if (r === 'wrong') viewWrong(); else if (r === 'me') viewMe(); else viewHome();
  window.scrollTo(0, 0);
}
app.addEventListener('click', e => {
  const g = e.target.closest('[data-grade]');
  if (g) { DB.grade = +g.dataset.grade; save(); return route(); }
  const a = e.target.closest('a[href^="#/"]');                    // 點到「目前這一頁」的連結也要重新開始
  if (a && a.getAttribute('href') === location.hash && !e.defaultPrevented) { e.preventDefault(); route(); }
});
const sndBtn = $('#snd');
const sndSync = () => { sndBtn.textContent = DB.mute ? '🔇' : '🔊'; };
sndBtn.onclick = () => { DB.mute = !DB.mute; save(); sndSync(); if (!DB.mute) sfx.tap(); };
sndSync();
window.addEventListener('hashchange', route);
let rz = null, lastW = innerWidth;
window.addEventListener('resize', () => { if (Math.abs(innerWidth - lastW) < 2) return; lastW = innerWidth; clearTimeout(rz); rz = setTimeout(() => { if (window.__repark) window.__repark(); }, 200); });

/* ---------- 第一次登艦：取名字、選年級、看懂玩法 ---------- */
function onboard() {
  const ov = document.createElement('div'); ov.className = 'ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = `<div class="ovbox"><div class="dmas">🚀</div><h1>歡迎登艦，新任艦長！</h1>
    <p class="mute">知識星系被「遺忘迷霧」籠罩了。駕駛太空船降落每顆星球，完成三個關卡把它點亮：</p>
    <div class="how"><div><b>📡</b>探索<small>動手做實驗<br>收集知識碎片</small></div><div><b>🎮</b>試煉<small>小遊戲<br>加深印象</small></div><div><b>👾</b>Boss<small>用學到的知識<br>打敗迷霧獸</small></div></div>
    <label class="fld">艦長的名字<input type="text" id="obn" maxlength="12" autocomplete="off" value="${esc(DB.cur === '同學' ? '' : DB.cur)}" placeholder="例如：小美"></label>
    <div class="fld">你現在是<div class="chips" id="obg">${GRADES.slice(1).map(([g, n]) => `<button class="chip ${DB.grade === g ? 'on' : ''}" data-g="${g}">${n}</button>`).join('')}<button class="chip ${!DB.grade ? 'on' : ''}" data-g="0">全部都想看</button></div></div>
    <button class="btn wide" id="obgo">出發！🚀</button><p class="mute sm">之後可以在「我的」頁面修改，或新增其他使用者。</p></div>`;
  document.body.appendChild(ov);
  $('#obg', ov).onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; DB.grade = +b.dataset.g; $$('#obg .chip', ov).forEach(c => c.classList.toggle('on', c === b)); sfx.tap(); };
  $('#obgo', ov).onclick = () => {
    const n = $('#obn', ov).value.trim();
    if (n && n !== DB.cur) {
      if (!DB.profiles[n]) { DB.profiles[n] = DB.profiles[DB.cur] || blank(); const rest = {}; Object.keys(DB.profiles).forEach(k => { if (k !== DB.cur) rest[k] = DB.profiles[k]; }); DB.profiles = rest; }
      DB.cur = n;
    }
    DB.seen = 1; save(); ov.remove(); sfx.win(); route();
  };
  setTimeout(() => { const i = $('#obn', ov); if (i && innerWidth > 640) i.focus(); }, 50);
}
loadBank().then(() => {
  $('#bankInfo').textContent = `${Object.keys(UNITS).length} 顆星球・${Object.keys(LABS).length} 個互動實驗室・${Object.keys(QS).length} 題・最後更新 ${META.updated || ''}`;
  P(); save(); route();
  if (!DB.seen) onboard();
}).catch(err => { app.innerHTML = '<p class="loading">載入失敗，請重新整理頁面。<br><span class="sm">' + esc(err.message) + '</span></p>'; });
})();

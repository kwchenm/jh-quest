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
  ['wrong', 'best', 'at'].forEach(k => { p[k] = p[k] || {}; });
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
function record(q, ok) {
  const p = P(); p.done++; if (ok) p.right++;
  if (!ok) p.wrong[q.id] = 2;
  else if (p.wrong[q.id]) { if (--p.wrong[q.id] <= 0) delete p.wrong[q.id]; }
}
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
    <div class="row c"><a class="btn ghost" href="#/sprint">⏱ 迷霧突襲</a><a class="btn ghost" href="#/duel">⚔️ 雙人對戰</a></div>`;
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
    return `<h2>${CN[list[0].g]}年級${list[0].s}學期</h2><div class="path">` + list.map(u =>
      `<a class="node ${next && next.id === u.id ? 'next' : ''}" href="#/u/${u.id}" data-uid="${u.id}">${planet(u)}<span class="nlab"><b>${esc(u.t)}</b><small>${esc(u.k)}</small><em>${coreDots(u.id)}${LABS[u.id] ? '<span class="labtag">🧪 實驗</span>' : ''}</em></span></a>`).join('') + '</div>';
  }).join('');
  app.innerHTML = `<a class="back" href="#/">← 回星際航圖</a><h1>${s.icon} ${esc(s.name)}星系</h1>` +
    say(s, next ? `我是${s.guide}！點一顆星球，太空船就會飛過去。每顆星球有 **📡 探索、🎮 試煉、👾 Boss** 三個能量核心，全部拿到星球就會完全點亮。下一站建議：**${next.t}**。` : `這個年級的星球全部點亮了，太厲害了！去挑戰星系守護者吧。`) +
    gradeChips() + `<div class="row"><a class="btn" href="#/mix/${s.id}">👑 挑戰星系守護者</a></div>
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
  meteor: {ic: '☄️', name: '隕石攔截', ask: g => (g.ask || '') + ' 隕石落地前，點下面正確的類別把它擊碎！', run: gMeteor},
  stars: {ic: '✨', name: '連星座', ask: g => (g.ask || '依正確順序點亮星星。') + ' 連成一個星座！', run: gStars},
  sentence: {ic: '🧩', name: '拼句子', ask: g => g.ask || '依正確順序點選。', run: gSentence},
  memory: {ic: '🃏', name: '記憶翻牌', ask: () => '一次翻兩張牌，把「名詞」和「它的說明」配成一對。記住牌的位置！', run: gMemory},
  bubbles: {ic: '🫧', name: '泡泡射擊', ask: () => '看上方的目標，戳破和它相配的泡泡！', run: gBubbles},
  link: {ic: '🔗', name: '連連看', ask: () => '先點左邊，再點右邊相配的卡片。', run: gLink}
};
function viewUnit(uid) {
  const u = UNITS[uid]; if (!u) return viewHome();
  const s = subj(u.sid), L = LESSONS[uid], c = P().core[uid] || {}, n = stars(uid), lab = LABS[uid], boss = bossOf(uid);
  const g = L && L.game ? GK[gameKind(u, L.game)] : null;
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
    ${n ? `<a class="btn ghost" href="#/codex/${uid}">📔 這顆星球的圖鑑筆記</a>` : ''}
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

/* --- 步驟：實驗室（動手調整，達成任務就自動過關） --- */
function stepLab(box, x, done) {
  const lab = LABS[x.u.id], s = lab.init(); let mi = 0, acts = 0, solved = false;
  const cur = () => lab.missions[mi];
  const txt = v => typeof v === 'function' ? v(s) : v;
  const ctrls = () => typeof lab.ctrl === 'function' ? lab.ctrl(s) : (lab.ctrl || []);
  const fv = c => c.fmt ? c.fmt(s[c.k]) : s[c.k];
  const enter = () => { acts = 0; solved = false; s.mi = mi; if (cur().set) cur().set(s); };
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
      <div id="lf" aria-live="polite"></div><div class="row c" id="la"><button class="btn ghost" id="lhint">💡 給我提示</button></div></div>`;
  };
  const refresh = full => { $('#lv', box).innerHTML = lab.view(s); $('#lr', box).innerHTML = readHTML(); if (full) $('#lc', box).innerHTML = ctrlHTML(); };
  const check = () => {
    if (solved) return;
    const m = cur();
    if (!m.ok(s)) { if (++acts === 5) { const h = $('#lhint', box); if (h) h.classList.add('pulse'); } return; }
    solved = true; sfx.ok();
    $('#lm', box).classList.add('done');
    $('#lf', box).innerHTML = `<div class="exp good pop"><b class="ok">✔ 任務完成！</b><br>${md(txt(m.say))}</div>`;
    $('#la', box).innerHTML = `<button class="btn pulse" id="lnext">${mi + 1 < lab.missions.length ? '下一個任務 →' : '完成實驗 🎉'}</button>`;
    const n = $('#lnext', box); if (n && n.scrollIntoView && !window.__fast) n.scrollIntoView({behavior: 'smooth', block: 'center'});
  };
  const hint = () => { const h = cur().hint; $('#lf', box).innerHTML = `<div class="exp pop">💡 ${h ? md(txt(h)) : '仔細看上面的讀數，想想任務要你做到什麼。'}</div>`; const b = $('#lhint', box); if (b) b.classList.remove('pulse'); };
  const setVal = (c, i, v) => { s[c.k] = v; const el = $(`[data-val="${i}"]`, box); if (el) el.textContent = fv(c); };
  box.oninput = e => { const i = e.target.dataset.s; if (i === undefined) return; setVal(ctrls()[+i], i, +e.target.value); refresh(false); };
  box.onchange = e => { if (e.target.dataset.s !== undefined) check(); };
  box.onclick = e => {
    const t = e.target;
    if (t.closest('#lhint')) return hint();
    if (t.closest('#lnext')) { if (++mi >= lab.missions.length) { earn(x, 15, 10); bump('game'); return done(); } enter(); draw(); return window.scrollTo(0, 0); }
    const tap = t.closest('[data-tap]');
    if (tap && lab.tap) { lab.tap(s, tap.dataset.tap); sfx.tap(); refresh(false); return check(); }
    const nb = t.closest('.nud');
    if (nb) { const i = +nb.dataset.n, c = ctrls()[i], st = c.step || 1;
      const v = Math.min(c.max, Math.max(c.min, Math.round((s[c.k] + st * nb.dataset.d) / st) * st));
      setVal(c, i, +v.toFixed(4)); const r = $(`[data-s="${i}"]`, box); if (r) r.value = s[c.k]; sfx.tap(); refresh(false); return check(); }
    const b = t.closest('.lbtn'); if (!b) return;
    const cs = ctrls();
    if (b.dataset.b !== undefined) cs[+b.dataset.b].run(s);
    else if (b.dataset.t !== undefined) { const c = cs[+b.dataset.t]; s[c.k] = !s[c.k]; if (c.run) c.run(s); }
    else if (b.dataset.c !== undefined) { const c = cs[+b.dataset.c]; s[c.k] = c.opts[+b.dataset.j][0]; }
    sfx.tap(); refresh(true); check();
  };
  if (window.__fast) window.__lab = {s, lab, mi: () => mi, check};
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
const gsay = (box, html, good) => { const f = $('#gf', box); if (f) f.innerHTML = note(html, good); };

/* --- 步驟：修復知識碎片（關鍵字被迷霧偷走） --- */
function stepRestore(box, x, done, c) {
  const segs = c.b.split(/(\*\*.+?\*\*)/).filter(Boolean).map(t => t.startsWith('**') ? {k: t.slice(2, -2)} : {t});
  const uniq = [...new Set(segs.filter(g => g.k && g.k.length <= 14).map(g => g.k))];
  if (uniq.length < 2) return stepQuick(box, x, done, c);
  const pick = shuffle(uniq).slice(0, Math.min(4, uniq.length)), used = new Set(), blanks = [];
  segs.forEach(g => { if (g.k && pick.includes(g.k) && !used.has(g.k)) { used.add(g.k); g.blank = blanks.length; blanks.push(g.k); } });
  const tiles = shuffle([...blanks, ...shuffle(x.terms.filter(t => !pick.includes(t) && t.length <= 14)).slice(0, 2)]).map(t => ({t, used: false}));
  let bi = 0, miss = 0, wrongHere = 0, hold = false, msg = '';
  const br = t => esc(t).replace(/\n/g, '<br>');
  const text = fog => segs.map(g => g.t !== undefined ? br(g.t)
    : g.blank === undefined || !fog ? `<b>${esc(g.k)}</b>`
    : g.blank < bi ? `<b class="got">${esc(g.k)}</b>`
    : `<span class="blank ${g.blank === bi ? 'cur' : ''}" data-a="${esc(g.k)}">${g.blank === bi && wrongHere >= 2 ? esc(g.k[0]) + '…' : '？'}</span>`).join('');
  const head = `<div class="le">${c.e || '📘'}</div><h2>${esc(c.t)}</h2>`;
  const learn = () => {
    box.innerHTML = `<div class="lcard"><span class="tag">💎 知識碎片</span>${head}<div class="lb">${text(false)}</div></div>
      <div class="row c"><button class="btn" id="go">記住了！🌫️</button></div><p class="mute sm c">按下後，迷霧怪會偷走幾個關鍵字，看你能不能放回去</p>`;
    $('#go', box).onclick = () => { sfx.tap(); fog(); };
  };
  const fog = () => {
    box.innerHTML = `<div class="lcard fogged"><span class="tag">🌫️ 迷霧來襲！把關鍵字放回去</span>${head}<div class="lb">${text(true)}</div></div>
      <div class="tiles ${hold ? 'hold' : ''}">${tiles.map((t, k) => `<button class="tile2" data-k="${k}" ${t.used ? 'disabled' : ''}>${esc(t.t)}</button>`).join('')}</div>
      <div aria-live="polite">${msg}</div><p class="mute sm c">點選正確的關鍵字，填進發亮的空格　失誤 ${miss}</p>`;
  };
  const whyNot = t => {                          // 這個關鍵字為什麼不是這一格
    if (blanks.includes(t)) return '它也是這段的關鍵字，但要填在後面的空格。讀讀發亮空格前後的句子。';
    if (c.b.includes('**' + t + '**')) return '它已經出現在這段文字裡了（看看粗體字）。';
    const home = x.L.cards.find(o => o !== c && o.b.includes('**' + t + '**'));
    return home ? `它屬於〈${esc(home.t)}〉那一段的內容，跟這句話無關。` : '它不屬於這一段。';
  };
  box.onclick = e => {
    const b = e.target.closest('.tile2'); if (!b || b.disabled || hold) return;
    const t = tiles[+b.dataset.k];
    if (t.t === blanks[bi]) {
      t.used = true; bi++; wrongHere = 0; sfx.ok(); msg = note(`✔ 「${esc(t.t)}」放對了！`, true);
      if (bi < blanks.length) return fog();
      earn(x, 8, miss ? 3 : 6);
      box.innerHTML = `<div class="lcard"><span class="tag">✨ 碎片修復完成${miss ? '' : '・零失誤'}</span>${head}<div class="lb">${text(false)}</div></div><div class="row c"><button class="btn pulse" id="go">收進圖鑑 →</button></div>`;
      $('#go', box).onclick = () => done();
    } else {
      miss++; wrongHere++; sfx.no(); hold = true;
      msg = note(`✘ 「${esc(t.t)}」不是這一格的答案。${whyNot(t.t)}${wrongHere >= 2 ? '<br>💡 發亮的空格已經提示了第一個字。' : ''}`);
      fog(); const nb = $(`.tile2[data-k="${b.dataset.k}"]`, box); if (nb) bad(nb);
      later(() => { hold = false; fog(); }, 1200);
    }
  };
  learn();
}
function stepQuick(box, x, done, c) {            // 關鍵字太少的卡片：直接用一題快問（只有一次機會）
  const head = `<div class="lcard"><span class="tag">💎 知識碎片</span><div class="le">${c.e || '📘'}</div><h2>${esc(c.t)}</h2><div class="lb">${md(c.b)}</div></div>`;
  if (!c.chk) { box.innerHTML = head + '<div class="row c"><button class="btn" id="go">收進圖鑑 →</button></div>'; $('#go', box).onclick = () => { earn(x, 8, 6); done(); }; return; }
  const q = chkQ(c), opts = shuffle([q.right, ...q.wrongs]); let pick = -1;
  box.innerHTML = head + `<div class="chk"><div class="chkt">⚡ 快速確認：選好後按「確定作答」，只有一次機會</div><div class="qq">${esc(q.q)}</div>${optsHTML(opts, 'ABC')}${CONFIRM}<div id="qf" aria-live="polite"></div></div>`;
  box.onclick = e => {
    const b = e.target.closest('.opt');
    if (b && !b.disabled) { pick = +b.dataset.i; return pickOpt(box, b); }
    if (!e.target.closest('#cf') || pick < 0) return;
    const ok = opts[pick] === q.right; revealOpts(box, q, opts, pick); ok ? sfx.ok() : sfx.no();
    $('#qf', box).innerHTML = note(ok ? '<b class="ok">✔ 答對了！</b>每個選項為什麼對、為什麼錯，都寫在選項下面。'
      : `<b class="no">✘ 答錯了</b>　正確答案是「<b>${esc(q.right)}</b>」。看看選項下面的說明，弄懂為什麼。`, ok);
    nextBtn($('#qf', box), '收進圖鑑 →', !ok, () => { earn(x, 8, ok ? 6 : 3); done(); });
  };
}

/* --- 步驟：掃描（點光點收集資料 → 辨識測試） --- */
function stepScan(box, x, done, c) {
  const items = c.flip, seen = new Set(); let phase = 0, tests = [], ti = 0, miss = 0, lastInfo = '', hold = false, msg = '';
  const order = shuffle(items.map((_, i) => i));
  const draw = () => {
    const q = phase === 1 ? items[tests[ti]] : null;
    box.innerHTML = `<div class="lcard"><span class="tag">📡 掃描任務</span><div class="le">${c.e || '📡'}</div><h2>${esc(c.t)}</h2><div class="lb">${md(c.b)}</div></div>
      <div class="scan"><div class="scanh">${phase === 0 ? `點擊每個訊號源，收集資料（${seen.size} / ${items.length}）` : `🔎 辨識測試 ${ti + 1} / ${tests.length}：下面這段資料屬於哪一個訊號源？`}</div>
      ${q ? `<div class="sinfo ask">${md(q[1])}</div>` : ''}
      <div class="orbs ${hold ? 'hold' : ''}">${order.map((i, k) => `<button class="orb2 ${seen.has(i) && phase === 0 ? 'seen' : ''}" data-i="${i}" style="--d:${-k * 0.7}s">${md(items[i][0])}</button>`).join('')}</div>
      ${phase === 1 ? `<div aria-live="polite">${msg}</div>` : ''}
      ${phase === 0 ? `<div class="sinfo">${lastInfo || '👆 點上面發亮的訊號源'}</div>` : ''}
      ${phase === 0 && seen.size === items.length ? '<div class="row c"><button class="btn pulse" id="go">資料收集完成，開始辨識 🔎</button></div>' : ''}</div>`;
    const go = $('#go', box); if (go) go.onclick = () => { phase = 1; tests = shuffle(items.map((_, i) => i)).slice(0, Math.min(3, items.length)); ti = 0; sfx.tap(); draw(); };
  };
  box.onclick = e => {
    const b = e.target.closest('.orb2'); if (!b || hold) return; const i = +b.dataset.i;
    if (phase === 0) { seen.add(i); sfx.tap(); lastInfo = `<b>${md(items[i][0])}</b><br>${md(items[i][1])}`; return draw(); }
    if (i === tests[ti]) { sfx.ok(); msg = note(`✔ 沒錯，剛才那段說的就是「${md(items[i][0])}」！`, true); if (++ti >= tests.length) { earn(x, 8, miss ? 3 : 6); return done(); } draw(); }
    else {
      miss++; sfx.no(); hold = true;
      msg = note(`✘ 不是「${md(items[i][0])}」。它的資料是：${md(items[i][1])}<br>和上面那段不一樣，再比對看看。`);
      draw(); const nb = $(`.orb2[data-i="${i}"]`, box); if (nb) bad(nb);
      later(() => { hold = false; draw(); }, 1200);
    }
  };
  draw();
}

/* --- 步驟：試煉小遊戲 --- */
function stepGame(box, x, done) {
  const g = x.L.game, meta = GK[gameKind(x.u, g)];
  box.innerHTML = `<div class="gm"><div class="gmt">${meta.ic} ${esc(meta.name)}<small>${esc(g.title || '')}</small></div><p class="mute">${esc(meta.ask(g))}</p><div id="gb"></div></div>`;
  meta.run($('#gb', box), g, miss => {
    earn(x, 15, miss ? 10 : 20); bump('game'); sfx.win(); if (!miss) confetti();
    box.innerHTML = `<div class="panel result"><div class="big">${miss ? '🎮' : '💯'}</div><h1>${miss ? '試煉通過！' : '完美過關，零失誤！'}</h1><p>失誤 ${miss} 次</p>
      ${g.recap ? `<div class="exp good">🧠 記起來：${md(g.recap)}</div>` : ''}<div class="row c" style="margin-top:14px"><button class="btn pulse" id="go">繼續 →</button></div></div>`;
    $('#go', box).onclick = () => done({miss});
  });
}
function gMemory(box, g, fin) {
  const cards = shuffle(g.pairs.flatMap((p, i) => [{i, t: p[0]}, {i, t: p[1]}]));
  let open = [], lock = false, left = g.pairs.length, flips = 0;
  box.innerHTML = `<div class="mem">${cards.map((c, k) => `<button class="mc" data-k="${k}" data-p="${c.i}"><span class="mf">✦</span><span class="mb">${md(c.t)}</span></button>`).join('')}</div><p class="mute sm" id="gi">翻牌次數 0</p>`;
  box.onclick = e => {
    const b = e.target.closest('.mc'); if (!b || lock || b.classList.contains('on')) return;
    b.classList.add('on'); sfx.tap(); open.push(b);
    if (open.length < 2) return;
    flips++; $('#gi', box).textContent = '翻牌次數 ' + flips;
    const [a, c] = open; open = [];
    if (a.dataset.p === c.dataset.p) { a.classList.add('ok'); c.classList.add('ok'); sfx.ok(); if (!--left) later(() => fin(Math.max(0, flips - g.pairs.length * 2)), 700); }
    else { lock = true; sfx.no(); setTimeout(() => { a.classList.remove('on'); c.classList.remove('on'); lock = false; }, tm(1000)); }
  };
}
function gBubbles(box, g, fin) {
  const order = shuffle(g.pairs.map((_, i) => i)); let qi = 0, miss = 0, hold = false;
  box.innerHTML = `<div class="btarget">🎯 <b id="bt2"></b></div><div class="arena">${shuffle(g.pairs.map((p, i) => ({i, t: p[1]}))).map((b, k) => `<button class="bb" data-p="${b.i}" style="--t:${4 + k % 3}s;--d:${-k * 1.1}s">${md(b.t)}</button>`).join('')}</div><p class="mute sm" id="gi"></p><div id="gf" aria-live="polite"></div>`;
  const show = () => { $('#bt2', box).innerHTML = md(g.pairs[order[qi]][0]); $('#gi', box).textContent = `還剩 ${order.length - qi} 個目標　失誤 ${miss}`; };
  box.onclick = e => {
    const b = e.target.closest('.bb'); if (!b || b.disabled || hold) return;
    const p = +b.dataset.p, want = order[qi];
    if (p === want) { b.disabled = true; b.classList.add('pop'); sfx.zap(); gsay(box, `✔ 「${md(g.pairs[p][0])}」── ${md(g.pairs[p][1])}`, true); if (++qi >= order.length) return later(() => fin(miss), 500); show(); }
    else { miss++; sfx.no(); bad(b); hold = true; gsay(box, `✘ 這顆泡泡說的是「${md(g.pairs[p][0])}」，不是「${md(g.pairs[want][0])}」。`); show(); later(() => { hold = false; }, 900); }
  };
  show();
}
function gMeteor(box, g, fin) {
  const items = shuffle(g.items); let i = 0, miss = 0, lock = false, idle = 0;
  box.innerHTML = `<div class="sky" id="sky"></div><div class="bks n${g.buckets.length}">${g.buckets.map((b, k) => `<button class="bk" data-k="${k}">${md(b)}</button>`).join('')}</div><p class="mute sm" id="gi"></p><div id="gf" aria-live="polite"></div>`;
  const sky = $('#sky', box), my = RUN, B = k => md(g.buckets[k]);
  const info = () => { $('#gi', box).textContent = `還剩 ${items.length - i} 顆隕石　失誤 ${miss}`; };
  const spawn = () => {
    if (i >= items.length) return fin(miss);
    if (idle >= 3) { sky.innerHTML = '<button class="btn" id="res">⏸ 點這裡繼續</button>'; $('#res', box).onclick = () => { idle = 0; spawn(); }; return; }
    sky.innerHTML = `<div class="met" data-k="${items[i][1]}" style="animation-duration:${window.__fast ? 600 : Math.max(5.5, 9 - i * 0.4)}s"><i>☄️</i><span>${md(items[i][0])}</span></div>`;
    sky.firstChild.onanimationend = () => { if (my !== RUN || lock) return; miss++; idle++; sfx.no(); gsay(box, `☄️ 隕石落地了！「${md(items[i][0])}」屬於「${B(items[i][1])}」。它稍後會再來一次。`); items.push(items[i]); i++; spawn(); };
    info();
  };
  box.onclick = e => {
    const b = e.target.closest('.bk'), m = $('.met', sky); if (!b || lock || !m) return; idle = 0;
    const it = items[i], k = +b.dataset.k;
    if (k === it[1]) { lock = true; sfx.zap(); gsay(box, `✔ 「${md(it[0])}」屬於「${B(k)}」`, true); m.style.top = getComputedStyle(m).top; m.classList.add('boom'); b.classList.add('good'); later(() => { b.classList.remove('good'); lock = false; i++; spawn(); }, 420); }
    else {                                       // 一顆隕石只有一次機會：答錯就公布正確類別，稍後再考一次
      lock = true; miss++; sfx.no(); bad(b); m.style.animationPlayState = 'paused';
      const r = $(`.bk[data-k="${it[1]}"]`, box); r.classList.add('good');
      gsay(box, `✘ 「${md(it[0])}」屬於「${B(it[1])}」，不是「${B(k)}」。這顆隕石稍後會再來一次。`);
      items.push(it); info();
      later(() => { r.classList.remove('good'); lock = false; i++; spawn(); }, 2200);
    }
  };
  spawn();
}
function gStars(box, g, fin) {
  const want = g.items, n = want.length, cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), slot = shuffle([...Array(n).keys()]);
  let placed = 0, miss = 0, prev = null, hold = false;
  box.innerHTML = `<div class="cons" style="height:${rows * 108 + 40}px"><svg class="cl"></svg>${want.map((t, k) => { const r = Math.floor(slot[k] / cols), c = slot[k] % cols; return `<button class="st2" data-k="${k}" style="left:${(c + 0.5) / cols * 100}%;top:${r * 108 + 8 + (c % 2 ? 24 : 0)}px"><i>✦</i><span>${md(t)}</span></button>`; }).join('')}</div><p class="mute sm" id="gi">失誤 0</p><div id="gf" aria-live="polite"></div>`;
  const wrap = $('.cons', box), cl = $('.cl', box);
  box.onclick = e => {
    const b = e.target.closest('.st2'); if (!b || b.classList.contains('on') || hold) return;
    const k = +b.dataset.k;
    if (k !== placed) {
      miss++; sfx.no(); bad(b); $('#gi', box).textContent = '失誤 ' + miss; hold = true;
      gsay(box, `✘ 「${md(want[k])}」排在第 ${k + 1} 個。現在要找第 ${placed + 1} 個${placed ? `，也就是接在「${md(want[placed - 1])}」後面的那一個` : '，也就是最前面的那一個'}。`);
      return later(() => { hold = false; }, 900);
    }
    gsay(box, `✔ 第 ${placed + 1} 個：「${md(want[placed])}」`, true);
    b.classList.add('on'); $('i', b).textContent = placed + 1; sfx.ok();
    const w = wrap.getBoundingClientRect(), r = b.getBoundingClientRect(), pt = [r.left - w.left + r.width / 2, r.top - w.top + 16];
    if (prev) cl.insertAdjacentHTML('beforeend', `<line x1="${prev[0]}" y1="${prev[1]}" x2="${pt[0]}" y2="${pt[1]}"/>`);
    prev = pt; if (++placed === n) later(() => fin(miss), 700);
  };
}
function gSentence(box, g, fin) {
  const want = g.items, pool = shuffle(want.map(t => ({t, used: false}))); let placed = 0, miss = 0, hold = false, msg = '';
  const draw = () => { box.innerHTML = `<div class="sent">${want.map((t, k) => `<span class="w ${k < placed ? 'on' : ''}">${k < placed ? esc(t) : '＿'}</span>`).join('')}</div>
    <div class="chips">${pool.map((p, k) => `<button class="chip2" data-k="${k}" ${p.used ? 'disabled' : ''}>${esc(p.t)}</button>`).join('')}</div><p class="mute sm">失誤 ${miss}</p><div id="gf" aria-live="polite">${msg}</div>`; };
  box.onclick = e => {
    const b = e.target.closest('.chip2'); if (!b || b.disabled || hold) return; const p = pool[+b.dataset.k];
    if (p.t === want[placed]) { p.used = true; placed++; sfx.ok(); msg = ''; draw(); if (placed === want.length) later(() => fin(miss), 500); }
    else {
      miss++; sfx.no(); hold = true; const j = want.findIndex((w, k) => k >= placed && w === p.t);
      msg = note(`✘ 「${esc(p.t)}」不是下一個${j >= 0 ? `，它要放在第 ${j + 1} 個位置` : ''}。${placed ? `想想「${esc(want[placed - 1])}」後面要接什麼。` : '想想句子要從哪裡開始。'}`);
      draw(); const nb = $(`.chip2[data-k="${b.dataset.k}"]`, box); if (nb) bad(nb);
      later(() => { hold = false; }, 900);
    }
  };
  draw();
}
function gLink(box, g, fin) {
  const n = g.pairs.length; let sel = null, left = n, miss = 0, hold = false;
  const Ls = shuffle(g.pairs.map((p, i) => ({i, t: p[0]}))), Rs = shuffle(g.pairs.map((p, i) => ({i, t: p[1]})));
  box.innerHTML = `<div class="mcols"><div class="mcol">${Ls.map(p => `<button class="tile" data-s="l" data-i="${p.i}">${md(p.t)}</button>`).join('')}</div>
    <div class="mcol">${Rs.map(p => `<button class="tile r" data-s="r" data-i="${p.i}">${md(p.t)}</button>`).join('')}</div></div><p class="mute sm" id="gi">已配對 0 / ${n}　失誤 0</p><div id="gf" aria-live="polite"></div>`;
  box.onclick = e => {
    const b = e.target.closest('.tile'); if (!b || b.disabled || hold) return;
    if (b.dataset.s === 'l') { $$('.tile[data-s=l]', box).forEach(t => t.classList.remove('sel')); b.classList.add('sel'); sel = b; sfx.tap(); return; }
    if (!sel) return toast('先點左邊的卡片喔');
    const li = +sel.dataset.i, ri = +b.dataset.i;
    if (li === ri) { sel.classList.remove('sel'); sel.classList.add('done'); b.classList.add('done'); sel.disabled = b.disabled = true; sel = null; left--; sfx.ok(); gsay(box, `✔ 「${md(g.pairs[li][0])}」配「${md(g.pairs[li][1])}」`, true); }
    else { miss++; sfx.no(); bad(sel); bad(b); hold = true; gsay(box, `✘ 「${md(g.pairs[ri][1])}」配的是「${md(g.pairs[ri][0])}」，不是「${md(g.pairs[li][0])}」。`); later(() => { hold = false; }, 1000); }
    $('#gi', box).textContent = `已配對 ${n - left} / ${n}　失誤 ${miss}`;
    if (!left) later(() => fin(miss), 500);
  };
}

/* ---------- 戰鬥引擎（Boss／守護者／突襲／錯題） ---------- */
let timerId = null;
const stopTimer = () => { if (timerId) { clearInterval(timerId); timerId = null; } };
const FOES = ['👾', '🐙', '👹', '🤖', '🦑', '👻', '🦂', '🕷️'];
function battle(box, cfg, done) {
  const pool = shuffle(cfg.qs), N = Math.min(cfg.n || 8, pool.length), H = cfg.hearts || 3, dmg = Math.ceil(100 / N);
  let queue = pool.slice(0, N), missed = [], cur = null, locked = true, over = false, paused = false;
  const st = {hp: 100, hearts: H, combo: 0, maxCombo: 0, right: 0, total: 0, scan: cfg.timer ? 0 : 1, shield: cfg.timer ? 0 : 1, shieldOn: false, kills: 0, left: cfg.timer || 0};
  const Q = s => box.querySelector(s);
  box.innerHTML = `<div class="bt" id="bt">
    <div class="foe" id="foe"><div class="fe" id="fe">${cfg.e}</div><div class="finfo"><div class="fname">${esc(cfg.name)}</div>${cfg.timer ? `<div class="timer" id="tm">${st.left}</div>` : '<div class="hpb"><i id="hp"></i></div>'}</div></div>
    <div class="beam" id="beam"></div>
    <div class="mebar"><span class="me">${P().ship}</span><span id="hearts"></span><span class="combo" id="combo"></span><span class="skills">${cfg.timer ? '<b id="kills"></b>' : '<button class="skb" id="sk1"></button><button class="skb" id="sk2"></button>'}</span></div>
    <div id="qa"></div></div>`;
  const hud = () => {
    if (cfg.timer) Q('#kills').textContent = '擊退 ' + st.kills + ' 隻';
    else {
      Q('#hp').style.width = st.hp + '%';
      Q('#hearts').textContent = '❤️'.repeat(Math.max(0, st.hearts)) + '🖤'.repeat(H - Math.max(0, st.hearts));
      Q('#sk1').textContent = '🔍 掃描 ×' + st.scan; Q('#sk1').disabled = !st.scan || locked;
      Q('#sk2').textContent = st.shieldOn ? '🛡️ 護盾啟動中' : '🛡️ 護盾 ×' + st.shield; Q('#sk2').disabled = !st.shield || st.shieldOn;
    }
    Q('#combo').textContent = st.combo > 1 ? '🔥 連擊 ×' + st.combo : '';
  };
  const fx = (id, cls) => { const el = Q('#' + id); el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const pop = t => { const d = document.createElement('span'); d.className = 'dmg'; d.textContent = t; Q('#foe').appendChild(d); setTimeout(() => d.remove(), 900); };
  const end = () => {
    if (over) return; over = true; locked = true; stopTimer(); document.onkeydown = null;
    const win = cfg.timer ? true : st.hp <= 0;
    if (win && !cfg.timer) { Q('#foe').classList.add('dead'); sfx.boom(); }
    later(() => done({win, hearts: Math.max(0, st.hearts), right: st.right, total: st.total, maxCombo: st.maxCombo, kills: st.kills}), win && !cfg.timer ? 950 : 350);
  };
  const ask = () => {
    if (over) return;
    paused = false;
    if (cfg.timer ? st.left <= 0 : (st.hp <= 0 || st.hearts <= 0)) return end();
    if (!queue.length) queue = shuffle(missed.length ? missed.splice(0) : pool).slice(0, N);
    const q = queue.shift(), tf = !cfg.timer && q.wrongs.length >= 2 && Math.random() < 0.3;
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
    let head;
    if (ok) {
      st.right++; st.combo++; st.maxCombo = Math.max(st.maxCombo, st.combo); st.kills++; bump('right');
      const crit = st.combo >= 3, d = crit ? Math.round(dmg * 1.5) : dmg; st.hp = Math.max(0, st.hp - d);
      sfx.zap(); fx('beam', 'fire'); fx('foe', 'hit'); pop(cfg.timer ? '💥' : crit ? '爆擊 −' + d : '−' + d);
      if (cfg.timer) Q('#fe').textContent = FOES[st.kills % FOES.length];
      head = `<b class="ok">✔ 答對了！${cfg.timer ? '擊退一隻迷霧怪' : crit ? '連擊爆擊！' : '命中！'}</b>`;
    } else {
      st.combo = 0; missed.push(q); sfx.no(); fx('bt', 'shake');
      if (st.shieldOn) { st.shieldOn = false; toast('🛡️ 護盾擋下了攻擊！'); } else if (!cfg.timer) st.hearts--;
      head = '<b class="no">✘ 答錯了，被反擊！</b>';
    }
    save(); hud();
    const fin = cfg.timer ? st.left <= 0 : st.hp <= 0 || st.hearts <= 0;
    Q('#after').innerHTML = note(head + why, ok);
    nextBtn(Q('#after'), fin ? '查看結果 →' : cfg.timer ? '下一隻 →' : '繼續戰鬥 →', !ok, ask);
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
function stepBoss(box, x, done) {
  const boss = bossOf(x.u.id);
  const have = new Set(x.u.qs.map(q => q.q));       // 題庫已有的題目不重複出
  const extra = x.L.cards.filter(c => c.chk && !have.has(c.chk[0])).map(chkQ);
  battle(box, {name: boss.n, e: boss.e, qs: [...x.u.qs, ...extra], n: 8, hearts: 3}, res => {
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
  arena({title: s.name + '・星系守護者', back: '#/s/' + sid, name: '星系守護者', e: '🐉', qs: s.units.filter(inGrade).flatMap(u => u.qs), n: 15, hearts: 4, tag: true});
}
function viewSprint() {
  const p = P();
  app.innerHTML = heroHTML() + `<h1>⏱ 迷霧突襲</h1><p class="mute">60 秒內，迷霧怪一隻接一隻衝過來！選好答案按「確定」，答對就能擊退一隻。每題都會說明對錯原因，看說明的時候計時會暫停。（個人最佳：${p.best['sprint' + DB.grade] || 0} 隻）</p>` +
    gradeChips() + `<div class="chips" id="sp">${SUBJECTS.map(s => `<button class="chip on" data-s="${s.id}">${s.icon} ${esc(s.name)}</button>`).join('')}</div><button class="btn" id="go">開始突襲 🚀</button>`;
  $('#sp').onclick = e => { const b = e.target.closest('[data-s]'); if (b) b.classList.toggle('on'); };
  $('#go').onclick = () => { const on = $$('#sp .on').map(b => b.dataset.s);
    arena({title: '迷霧突襲', back: '#/sprint', name: '迷霧怪群', e: '👾', timer: 60, tag: true, n: 999, qs: SUBJECTS.filter(s => on.includes(s.id)).flatMap(s => s.units.filter(inGrade).flatMap(u => u.qs))}); };
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

/* ---------- 雙人對戰：能量球推擠 ---------- */
function viewDuel() {
  app.innerHTML = `<h1>⚔️ 雙人對戰</h1><p class="mute">兩個人用同一台裝置，兩邊看到同一題。<b>先答對的人</b>把能量球推向對手。<b>每題每人只能答一次</b>：答錯就失去這題的作答權，並看到為什麼錯；每題結束後，兩邊都會看到每個選項的說明。把球推到對方底線就贏了！<br>鍵盤：左邊玩家按 1 2 3 4，右邊玩家按 7 8 9 0，按 Enter 進入下一題。手機請面對面坐。</p>` +
    gradeChips() + `<div class="chips" id="sp">${SUBJECTS.map(s => `<button class="chip on" data-s="${s.id}">${s.icon} ${esc(s.name)}</button>`).join('')}</div><button class="btn" id="go">開始對戰 ⚔️</button>`;
  $('#sp').onclick = e => { const b = e.target.closest('[data-s]'); if (b) b.classList.toggle('on'); };
  $('#go').onclick = () => { const on = $$('#sp .on').map(b => b.dataset.s); const qs = SUBJECTS.filter(s => on.includes(s.id)).flatMap(s => s.units.filter(inGrade).flatMap(u => u.qs)); if (qs.length) duel(qs); };
}
function duel(qs) {
  const GOAL = 5, list = shuffle(qs), KEYS = ['1234', '7890'];
  let pos = 0, qi = 0, over = false, left = 120, opts = [[], []], out = [false, false], picks = [-1, -1], solved = false;
  document.body.classList.add('playing');
  app.innerHTML = `<div class="duel"><div class="dbar"><a href="#/duel" class="hx">✕</a><span>🟥</span><div class="track"><i id="orb">⚡</i></div><span>🟦</span><b class="timer" id="dt">${left}</b></div>
    <div class="dsides"><div class="dside a" id="d0"></div><div class="dmid" id="dmid" hidden><button class="btn pulse" id="dnx">下一題 →</button></div><div class="dside b" id="d1"></div></div></div>`;
  const cq = () => list[qi % list.length];
  const side = k => { const q = cq(); opts[k] = shuffle([q.right, ...q.wrongs]);
    $('#d' + k).innerHTML = `<div class="dq">${esc(q.q)}</div>${opts[k].map((o, i) => `<button class="opt" data-k="${k}" data-i="${i}"><span class="k">${KEYS[k][i]}</span><span class="ot">${esc(o)}</span></button>`).join('')}<div class="dmsg" id="m${k}" aria-live="polite"></div>`; };
  const orb = () => { $('#orb').style.left = (50 + pos * 45 / GOAL) + '%'; };
  const draw = () => { out = [false, false]; picks = [-1, -1]; solved = false; side(0); side(1); orb(); $('#dmid').hidden = true; $$('.dside').forEach(d => d.classList.remove('out', 'won')); };
  const end = w => { over = true; stopTimer(); document.onkeydown = null; sfx.win(); confetti();
    app.innerHTML = `<div class="quiz"><div class="panel result"><div class="big">${w === 0 ? '🟥' : w === 1 ? '🟦' : '🤝'}</div><h1>${w === 0 ? '左邊（紅隊）獲勝！' : w === 1 ? '右邊（藍隊）獲勝！' : '平手！'}</h1>
      <div class="row c"><button class="btn" id="again">再比一場</button><a class="btn ghost" href="#/duel">重新設定</a><a class="btn ghost" href="#/">回星圖</a></div></div></div>`;
    $('#again').onclick = () => duel(qs); };
  const solve = w => {                           // 這一題結束：兩邊都公布每個選項的對錯原因
    solved = true;
    [0, 1].forEach(k => {
      const d = $('#d' + k); d.classList.remove('out'); revealOpts(d, cq(), opts[k], picks[k]);
      $('#m' + k).innerHTML = w === k ? '<b class="ok">✔ 答對了！能量球往前推一格。</b>看看其他選項為什麼錯。'
        : w === -1 ? '<b class="no">兩邊都答錯了。</b>看看每個選項的說明。'
        : picks[k] >= 0 ? '<b class="no">✘ 你答錯了，對手答對了。</b>看看每個選項的說明。'
        : '對手先答對了。看看每個選項的說明。';
    });
    $('#dnx').textContent = Math.abs(pos) >= GOAL ? '查看結果 →' : '下一題 →'; $('#dmid').hidden = false;
  };
  const hit = (k, i) => {
    if (over || solved || out[k] || i < 0 || i >= opts[k].length) return;
    const q = cq(), o = opts[k][i]; picks[k] = i;
    if (o === q.right) { pos += k === 0 ? 1 : -1; sfx.zap(); orb(); $('#d' + k).classList.add('won'); return solve(k); }
    out[k] = true; sfx.no();
    const d = $('#d' + k); d.classList.add('out'); $$('.opt', d).forEach(b => { b.disabled = true; }); $(`.opt[data-i="${i}"]`, d).classList.add('wrong', 'mine');
    $('#m' + k).innerHTML = `<b class="no">✘ 「${esc(o)}」不對</b>：${esc(whyOf(q, o))}<br><span class="mute">這題你不能再答了，換對手作答。</span>`;
    if (out[0] && out[1]) solve(-1);
  };
  $('#dnx').onclick = () => { if (over || !solved) return; if (Math.abs(pos) >= GOAL) return end(pos > 0 ? 0 : 1); qi++; draw(); };
  $('.dsides').onclick = e => { const b = e.target.closest('.opt'); if (b) hit(+b.dataset.k, +b.dataset.i); };
  document.onkeydown = e => { if (e.key === 'Enter') { if (solved) { e.preventDefault(); $('#dnx').click(); } return; } const a = KEYS[0].indexOf(e.key), b = KEYS[1].indexOf(e.key); if (e.key.length !== 1) return; if (a >= 0) hit(0, a); else if (b >= 0) hit(1, b); };
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
    const wr = Object.keys(p.wrong).filter(id => QS[id] && QS[id].sid === s.id).length;
    return `<tr><td>${s.icon} ${esc(s.name)}</td><td>${lit} / ${s.units.length}</td><td>★ ${got} / ${s.units.length * 3}</td><td>${wr}</td></tr>`;
  }).join('');
  app.innerHTML = heroHTML() + `<h1>我的進度</h1>
    <div class="panel"><table><tr><th>星系</th><th>點亮星球</th><th>能量核心</th><th>錯題</th></tr>${rows}</table></div>
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
  const nav = ['s', 'u', 'play', 'mix', 'learn', 'quiz', 'sprint'].includes(r) ? 'home' : (r || 'home');
  $$('[data-nav]').forEach(n => { const on = n.dataset.nav === nav; n.classList.toggle('on', on); if (on) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current'); });
  document.body.classList.toggle('playing', ['play', 'learn', 'quiz', 'mix'].includes(r));
  window.__repark = null;
  const wn = Object.keys(P().wrong).filter(id => QS[id]).length, wb = $('#wbadge'); if (wb) { wb.textContent = wn > 99 ? '99+' : wn; wb.hidden = !wn; }
  if (r === 's') viewSubject(a); else if (r === 'u') viewUnit(a); else if (r === 'play') play(a, b || 'all');
  else if (r === 'learn') play(a, 'all'); else if (r === 'quiz') play(a, 'b');
  else if (r === 'mix') viewMix(a); else if (r === 'sprint') viewSprint(); else if (r === 'duel') viewDuel();
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

/* 國中知識星航 — 先學再玩
   每個單元：🎯 任務簡報 → 📘 互動知識卡（每張有快問快答）→ 🎮 小遊戲（連連看／分類／排排站）→ ⚔️ 最終挑戰
   純前端、無需建置。 */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const esc = t => String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
const today = () => new Date().toLocaleDateString('sv');
const CN = {7: '七', 8: '八', 9: '九'};
const GRADES = [[0, '全部年級'], [7, '七年級'], [8, '八年級'], [9, '九年級']];
const LEVEL_SIZE = 8, MIX_SIZE = 20, SPRINT_SEC = 60;

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
        const q = {id: u.id + ':' + hash(raw[0]), uid: u.id, sid: s.id, q: raw[0], right: raw[1], wrongs: raw.slice(2, 5), exp: raw[5] || ''};
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
const blank = () => ({xp: 0, streak: 0, lastDay: '', stars: {}, wrong: {}, best: {}, done: 0, right: 0, learned: {}});
const P = () => { const p = DB.profiles[DB.cur] || (DB.profiles[DB.cur] = blank()); if (!p.learned) p.learned = {}; return p; };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} };
const level = xp => Math.floor(Math.sqrt(xp / 50)) + 1;
const levelFloor = lv => (lv - 1) * (lv - 1) * 50;
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
const sfx = {
  ok() { tone(660, .12); tone(990, .18, 'sine', .07, .09); },
  no() { tone(160, .28, 'sawtooth', .045); },
  tap() { tone(500, .04, 'sine', .04); },
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
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = t;
  document.body.appendChild(d); setTimeout(() => d.remove(), 1400);
}
const gain = n => { P().xp += n; save(); toast('+' + n + ' 經驗'); };

/* ---------- 共用畫面元件 ---------- */
const starStr = n => '<span>' + '★'.repeat(n) + '</span><span class="off">' + '★'.repeat(3 - n) + '</span>';
const inGrade = u => !DB.grade || u.g === DB.grade;
const say = (s, text) => `<div class="say"><div class="mas">${s.mascot}</div><div class="bub"><small>${esc(s.guide)}</small>${md(text)}</div></div>`;
function heroHTML() {
  const p = P(), lv = level(p.xp), a = levelFloor(lv), b = levelFloor(lv + 1);
  return `<section class="hero"><div><div class="who">👩‍🚀 ${esc(DB.cur)}　Lv.${lv}</div>
    <div class="xpbar"><i style="width:${Math.round((p.xp - a) / (b - a) * 100)}%"></i></div></div>
    <div class="stat"><span>經驗 <b>${p.xp}</b></span><span>連續學習 <b>${p.streak}</b> 天</span>
    <span>學過 <b>${Object.keys(p.learned).filter(id => UNITS[id]).length}</b> 站</span>
    <span>星星 <b>${Object.values(p.stars).reduce((x, y) => x + y, 0)}</b></span>
    <span>答對率 <b>${p.done ? Math.round(p.right / p.done * 100) : 0}%</b></span></div></section>`;
}
function gradeChips() {
  return '<div class="chips">' + GRADES.map(([g, n]) => `<button class="chip ${DB.grade === g ? 'on' : ''}" data-grade="${g}">${n}</button>`).join('') + '</div>';
}

/* ---------- 首頁：星圖 ---------- */
function viewHome() {
  const p = P();
  const cards = SUBJECTS.map(s => {
    const us = s.units.filter(inGrade); if (!us.length) return '';
    const got = us.reduce((x, u) => x + (p.stars[u.id] || 0), 0), max = us.length * 3;
    const learned = us.filter(u => p.learned[u.id]).length;
    return `<a class="card subj" href="#/s/${s.id}" style="border-top:4px solid ${s.color}">
      <div class="ico">${s.icon}<span class="mini">${s.mascot}</span></div><div class="nm">${esc(s.name)}星系</div>
      <div class="meta">${us.length} 站・已學 ${learned} 站</div>
      <div class="bar"><i style="width:${max ? got / max * 100 : 0}%"></i></div>
      <div class="meta">★ ${got} / ${max}</div></a>`;
  }).join('');
  app.innerHTML = heroHTML() + `<h1>選一個星系開始探險</h1>
    <p class="mute sm">每一站先聽任務故事、翻知識卡學觀念，再玩小遊戲、闖最終挑戰，把重點一次記起來。</p>` +
    gradeChips() + `<div class="grid">${cards}</div>`;
}

/* ---------- 星系頁：站點路線 ---------- */
function viewSubject(sid) {
  const s = subj(sid); if (!s) return viewHome();
  const p = P(), us = s.units.filter(inGrade);
  const groups = {};
  us.forEach(u => (groups[u.g + u.s] = groups[u.g + u.s] || []).push(u));
  const first = us.find(u => !p.learned[u.id]);
  const html = Object.keys(groups).sort().map(k => {
    const list = groups[k];
    return `<h2>${CN[list[0].g]}年級${list[0].s}學期</h2><div class="path" style="--c:${s.color}">` + list.map(u => {
      const L = LESSONS[u.id], st = p.stars[u.id] || 0, ln = p.learned[u.id];
      return `<a class="node ${first && first.id === u.id ? 'next' : ''}" href="#/u/${u.id}">
        <span class="orb">${L && L.ic ? L.ic : s.icon}${ln ? '<i class="ck">✓</i>' : ''}${ln && st === 3 ? '<i class="md">🏅</i>' : ''}</span>
        <span class="nlab"><b>${esc(u.t)}</b><small>${esc(u.k)}</small><em>${st ? starStr(st) : (first && first.id === u.id ? '👈 下一站' : '尚未挑戰')}</em></span></a>`;
    }).join('') + '</div>';
  }).join('');
  app.innerHTML = `<a class="back" href="#/">← 回星圖</a><h1>${s.icon} ${esc(s.name)}星系</h1>` +
    say(s, first ? `歡迎來到${s.name}星系！我是${s.guide}。沿著路線一站一站走，每一站都有故事任務和小遊戲。先從「**${first.t}**」出發吧！` : `太厲害了，這個年級的${s.name}站你全都走過了！可以去玩綜合挑戰，看看記得多少。`) +
    gradeChips() +
    `<div class="row"><a class="btn" href="#/mix/${s.id}">🌌 綜合挑戰（${DB.grade ? CN[DB.grade] + '年級' : '會考範圍'}隨機 ${MIX_SIZE} 題）</a></div>` +
    (html || '<p class="mute">這個年級沒有此科目的單元。</p>');
}

/* ---------- 單元任務頁 ---------- */
const GAMES = {
  match: {ic: '🔗', name: '連連看', ask: '先點左邊的卡片，再點右邊相配的卡片，全部配對成功就過關！'},
  sort: {ic: '🧺', name: '分類大挑戰', ask: '每次出現一個項目，點選它該放進哪一類。'},
  order: {ic: '🔢', name: '排排站', ask: '依照正確的順序，一個一個點選下面的卡片。'}
};
function viewUnit(uid) {
  const u = UNITS[uid]; if (!u) return viewHome();
  const s = subj(u.sid), L = LESSONS[uid], p = P();
  const idx = s.units.findIndex(x => x.id === uid) + 1;
  const st = p.stars[uid] || 0, ln = !!p.learned[uid];
  app.innerHTML = `<a class="back" href="#/s/${s.id}">← 回${esc(s.name)}星系</a>
  <section class="mission" style="--c:${s.color}">
    <div class="mtag">🎯 第 ${idx} 站・${CN[u.g]}年級${u.s}學期</div>
    <h1><span class="mic">${L && L.ic ? L.ic : s.icon}</span> ${esc(u.t)}</h1>
    ${L ? say(s, L.hook) : ''}
    <ol class="route">
      ${L ? `<li class="${ln ? 'ok' : ''}"><b>📘 互動知識卡</b><span>${L.cards.length} 張卡，每張有快問快答</span></li>` : ''}
      ${L && L.game ? `<li class="${ln ? 'ok' : ''}"><b>${GAMES[L.game.type].ic} 小遊戲</b><span>${GAMES[L.game.type].name}：${esc(L.game.title || '')}</span></li>` : ''}
      <li class="${st ? 'ok' : ''}"><b>⚔️ 最終挑戰</b><span>${Math.min(LEVEL_SIZE, u.qs.length)} 題・3 顆愛心・目前 ${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span></li>
    </ol>
    <div class="row">${L ? `<a class="btn" href="#/learn/${uid}">${ln ? '再學一次' : '開始探險'} 🚀</a>` : ''}<a class="btn ghost" href="#/quiz/${uid}">${L ? '直接挑戰' : '開始挑戰'}</a></div>
  </section>`;
}

/* ---------- 學習流程：知識卡 → 小遊戲 → 挑戰 ---------- */
function runLesson(uid) {
  const u = UNITS[uid]; if (!u) return viewHome();
  const L = LESSONS[uid]; if (!L) return viewQuiz(uid);
  const s = subj(u.sid), cards = L.cards, G = L.game;
  const total = cards.length + (G ? 1 : 0) + 1;
  touchStreak(); save();

  const shell = (label, step, inner) => {
    app.innerHTML = `<div class="quiz lesson" style="--c:${s.color}"><div class="qhead"><a href="#/u/${uid}">✕ 離開</a><b>${esc(u.t)}</b><span>${label}</span></div>
      <div class="prog"><i style="width:${Math.round(step / total * 100)}%"></i></div>${inner}</div>`;
    window.scrollTo(0, 0);
  };

  function showCard(ci) {
    const c = cards[ci], last = ci === cards.length - 1;
    let need = (c.flip ? c.flip.length : 0) + (c.chk ? 1 : 0), got = 0, tries = 0;
    shell(`知識卡 ${ci + 1} / ${cards.length}`, ci, `
      <div class="lcard"><div class="le">${c.e || '📘'}</div><h2>${esc(c.t)}</h2><div class="lb">${md(c.b)}</div>
      ${c.flip ? `<div class="flips">${c.flip.map((f, i) => `<button class="flipc" data-i="${i}"><span class="ff">${md(f[0])}</span><span class="fb">${md(f[1])}</span></button>`).join('')}</div><p class="mute sm">👆 把每張小卡都點開看看</p>` : ''}</div>
      ${c.chk ? `<div class="chk"><div class="chkt">⚡ 快問快答</div><div class="qq">${esc(c.chk[0])}</div><div class="opts" id="co"></div><div id="cf"></div></div>` : ''}
      <div class="row"><button class="btn" id="nx" disabled>${last ? (G ? '進入小遊戲 🎮' : '去挑戰 ⚔️') : '下一張 →'}</button></div>`);
    const nx = $('#nx');
    const upd = () => { nx.disabled = got < need; if (!nx.disabled && need) nx.classList.add('pulse'); };
    upd();
    document.querySelectorAll('.flipc').forEach(b => b.onclick = () => {
      b.classList.toggle('on'); sfx.tap();
      if (!b.dataset.seen) { b.dataset.seen = 1; got++; upd(); }
    });
    if (c.chk) {
      const right = c.chk[1], opts = shuffle(c.chk.slice(1)), co = $('#co');
      co.innerHTML = opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="k">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`).join('');
      co.onclick = e => {
        const b = e.target.closest('.opt'); if (!b || b.disabled) return;
        if (opts[+b.dataset.i] === right) {
          co.querySelectorAll('.opt').forEach(x => x.disabled = true);
          b.classList.add('right'); sfx.ok();
          $('#cf').innerHTML = `<div class="exp good"><b class="ok">✔ 答對了！</b>${tries ? '' : ' 一次就對，太強了 🔥'}</div>`;
          if (!tries) gain(3);
          got++; upd();
        } else {
          tries++; b.disabled = true; b.classList.add('wrong', 'shake'); sfx.no();
          $('#cf').innerHTML = '<div class="exp">🔍 再想想！答案就藏在上面卡片的<b>粗體字</b>裡。</div>';
        }
      };
    }
    nx.onclick = () => last ? finishCards() : showCard(ci + 1);
  }

  function finishCards() {
    P().learned[uid] = true; gain(10); save();
    G ? showGame() : toChallenge();
  }

  function showGame() {
    const meta = GAMES[G.type];
    shell('小遊戲', cards.length, `<div class="gm"><div class="gmt">${meta.ic} ${esc(G.title || meta.name)}</div><p class="mute">${esc(G.ask || meta.ask)}</p><div id="gb"></div></div>`);
    ({match: playMatch, sort: playSort, order: playOrder})[G.type]($('#gb'), G, gameDone);
  }

  function gameDone(miss) {
    const x = Math.max(5, 15 - miss * 3); gain(x); sfx.win();
    if (!miss) confetti();
    shell('小遊戲完成', cards.length + 1, `<div class="panel result"><div class="big">${miss ? '🎮' : '💯'}</div>
      <h1>${miss ? '過關！' : '完美過關，零失誤！'}</h1><p>失誤 ${miss} 次　經驗 <b>+${x}</b></p>
      ${G.recap ? `<div class="exp good">🧠 記起來：${md(G.recap)}</div>` : ''}
      <div class="row" style="justify-content:center;margin-top:14px"><button class="btn" id="go">闖最終挑戰 ⚔️</button></div></div>`);
    $('#go').onclick = toChallenge;
  }

  function toChallenge() {
    startQuiz({title: u.t, back: '#/s/' + u.sid, qs: u.qs, mode: 'level', unit: u});
  }
  showCard(0);
}

/* ---------- 三種小遊戲 ---------- */
function playMatch(box, g, done) {
  const n = g.pairs.length; let sel = null, left = n, miss = 0;
  const Ls = shuffle(g.pairs.map((p, i) => ({i, t: p[0]}))), Rs = shuffle(g.pairs.map((p, i) => ({i, t: p[1]})));
  box.innerHTML = `<div class="mcols"><div class="mcol">${Ls.map(x => `<button class="tile" data-s="l" data-i="${x.i}">${md(x.t)}</button>`).join('')}</div>
    <div class="mcol">${Rs.map(x => `<button class="tile r" data-s="r" data-i="${x.i}">${md(x.t)}</button>`).join('')}</div></div>
    <p class="mute sm" id="mi">已配對 0 / ${n}　失誤 0</p>`;
  box.onclick = e => {
    const b = e.target.closest('.tile'); if (!b || b.disabled) return;
    if (b.dataset.s === 'l') {
      box.querySelectorAll('.tile[data-s=l]').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel'); sel = b; sfx.tap(); return;
    }
    if (!sel) { toast('先點左邊的卡片喔'); return; }
    if (sel.dataset.i === b.dataset.i) {
      sel.classList.remove('sel'); sel.classList.add('done'); b.classList.add('done');
      sel.disabled = b.disabled = true; sel = null; left--; sfx.ok();
    } else {
      miss++; sfx.no();
      [sel, b].forEach(x => { x.classList.add('bad'); setTimeout(() => x.classList.remove('bad'), 450); });
    }
    $('#mi').textContent = `已配對 ${n - left} / ${n}　失誤 ${miss}`;
    if (!left) setTimeout(() => done(miss), 500);
  };
}
function playSort(box, g, done) {
  const items = shuffle(g.items); let i = 0, miss = 0, locked = false;
  const draw = () => {
    box.innerHTML = `<div class="sorthead">第 ${i + 1} / ${items.length} 個　失誤 <span id="sm">${miss}</span></div>
      <div class="sitem">${md(items[i][0])}</div>
      <div class="bks n${g.buckets.length}">${g.buckets.map((b, k) => `<button class="bk" data-k="${k}">${md(b)}</button>`).join('')}</div><div id="sf"></div>`;
  };
  box.onclick = e => {
    const b = e.target.closest('.bk'); if (!b || locked) return;
    if (+b.dataset.k === items[i][1]) {
      sfx.ok(); b.classList.add('good'); locked = true;
      setTimeout(() => { locked = false; i++; if (i >= items.length) return done(miss); draw(); }, 380);
    } else {
      miss++; sfx.no(); b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 450);
      $('#sm').textContent = miss; $('#sf').innerHTML = '<div class="exp">再想想看～ 🤔</div>';
    }
  };
  draw();
}
function playOrder(box, g, done) {
  const want = g.items; let placed = 0, miss = 0;
  let pool = shuffle(want.map((t, i) => ({t, i}))), guard = 0;
  while (pool.every((x, k) => x.t === want[k]) && guard++ < 10) pool = shuffle(pool);
  const draw = () => {
    box.innerHTML = `<div class="slots">${want.map((t, k) => `<div class="slot ${k < placed ? 'on' : ''}"><i>${k + 1}</i><span>${k < placed ? md(t) : ''}</span></div>`).join('')}</div>
      <div class="chips">${pool.map((x, k) => `<button class="chip2" data-k="${k}" ${x.used ? 'disabled' : ''}>${md(x.t)}</button>`).join('')}</div>
      <p class="mute sm" id="om">失誤 ${miss}</p>`;
  };
  box.onclick = e => {
    const b = e.target.closest('.chip2'); if (!b || b.disabled) return;
    const x = pool[+b.dataset.k];
    if (x.t === want[placed]) {
      x.used = true; placed++; sfx.ok(); draw();
      if (placed === want.length) setTimeout(() => done(miss), 500);
    } else {
      miss++; sfx.no(); b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 450);
      $('#om').textContent = `失誤 ${miss}`;
    }
  };
  draw();
}

/* ---------- 測驗引擎（最終挑戰／綜合／衝刺／錯題） ---------- */
let timerId = null;
const stopTimer = () => { if (timerId) { clearInterval(timerId); timerId = null; } };
function nextUnit(u) {
  const l = subj(u.sid).units.filter(inGrade), i = l.findIndex(x => x.id === u.id);
  return i >= 0 ? l[i + 1] || null : null;
}
function startQuiz(cfg) {
  stopTimer();
  const st = {i: 0, right: 0, hearts: 3, combo: 0, maxCombo: 0, xp: 0, left: SPRINT_SEC, list: shuffle(cfg.qs)};
  const useHearts = cfg.mode === 'level';
  if (cfg.mode === 'level') st.list = st.list.slice(0, LEVEL_SIZE);
  if (cfg.mode === 'mix') st.list = st.list.slice(0, MIX_SIZE);
  if (!st.list.length) { app.innerHTML = `<a class="back" href="${cfg.back}">← 返回</a><p class="mute">目前沒有題目。</p>`; return; }
  touchStreak(); save();

  function finish() {
    stopTimer();
    const total = cfg.mode === 'sprint' ? st.i : st.list.length;
    const rate = total ? st.right / total : 0;
    let stars = 0, extra = '';
    if (cfg.mode === 'level') {
      stars = st.hearts <= 0 ? 0 : rate >= .9 ? 3 : rate >= .7 ? 2 : rate >= .5 ? 1 : 0;
      const p = P(); if (stars > (p.stars[cfg.unit.id] || 0)) p.stars[cfg.unit.id] = stars;
      st.xp += stars * 10;
      if (stars === 3 && p.learned[cfg.unit.id]) extra = '🏅 獲得本站徽章！';
    }
    if (cfg.mode === 'sprint') {
      const p = P(), k = 'sprint' + DB.grade;
      if (st.right > (p.best[k] || 0)) { p.best[k] = st.right; extra = '🎉 刷新個人紀錄！'; }
      else extra = `個人最佳：${p.best[k] || 0} 題`;
    }
    P().xp += st.xp; save();
    if (cfg.mode === 'level' ? stars >= 1 : rate >= .7) { sfx.win(); if (stars >= 2 || (cfg.mode !== 'level' && rate >= .9)) confetti(); }
    const nx = cfg.mode === 'level' ? nextUnit(cfg.unit) : null;
    const s = cfg.unit ? subj(cfg.unit.sid) : null;
    const msg = cfg.mode === 'level' ? (st.hearts <= 0 ? '能量耗盡，再試一次！' : ['再接再厲！', '通過了，繼續加油！', '很棒！差一點就滿星', '完美登陸！'][stars]) : '挑戰完成！';
    app.innerHTML = `<div class="quiz"><div class="panel result">
      ${cfg.mode === 'level' ? `<div class="big">${starStr(stars)}</div>` : ''}
      <h1>${msg}</h1><p>答對 <b>${st.right}</b> / ${total} 題　最高連擊 ${st.maxCombo}　獲得經驗 <b>+${st.xp}</b></p>
      <p class="mute">${extra}</p>
      ${s && stars < 3 ? say(s, stars === 0 ? '別氣餒！回去翻翻知識卡，再來一次一定更好。' : '再多答對幾題就能拿滿星囉，要不要再挑戰一次？') : ''}
      <div class="row" style="justify-content:center"><button class="btn" id="again">再玩一次</button>
      ${nx && stars >= 1 ? `<a class="btn" href="#/u/${nx.id}">下一站：${esc(nx.t)} →</a>` : ''}
      <a class="btn ghost" href="${cfg.back}">返回</a><a class="btn ghost" href="#/wrong">錯題本</a></div></div></div>`;
    $('#again').onclick = () => startQuiz(cfg);
  }

  function show() {
    if (cfg.mode === 'sprint' && st.i >= st.list.length) st.list = st.list.concat(shuffle(cfg.qs));
    if (st.i >= st.list.length || (useHearts && st.hearts <= 0)) return finish();
    const q = st.list[st.i], opts = shuffle([q.right, ...q.wrongs]);
    const u = UNITS[q.uid], s = subj(q.sid);
    app.innerHTML = `<div class="quiz"><div class="qhead"><a href="${cfg.back}" id="quit">✕ 離開</a><b>${esc(cfg.title)}</b>
      <span>${cfg.mode === 'sprint' ? `<span class="timer" id="tm">${st.left}</span> 秒` : useHearts ? `<span class="hearts">${'❤️'.repeat(st.hearts)}${'🖤'.repeat(3 - st.hearts)}</span>` : `${st.i + 1} / ${st.list.length}`}</span></div>
      <div class="prog"><i style="width:${cfg.mode === 'sprint' ? st.left / SPRINT_SEC * 100 : st.i / st.list.length * 100}%"></i></div>
      <div class="qbox"><span class="qtag">${s.icon} ${esc(s.name)}・${esc(u.t)}</span>\n${esc(q.q)}</div>
      <div class="opts">${opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="k">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
      <div id="after"></div></div>`;
    const btns = [...app.querySelectorAll('.opt')];
    const answer = i => {
      if (btns[0].disabled) return;
      const ok = opts[i] === q.right;
      btns.forEach((b, j) => { b.disabled = true; if (opts[j] === q.right) b.classList.add('right'); else if (j === i) b.classList.add('wrong', 'shake'); });
      ok ? sfx.ok() : sfx.no();
      record(q, ok);
      if (ok) { st.right++; st.combo++; st.maxCombo = Math.max(st.maxCombo, st.combo); st.xp += 5 + Math.min(st.combo - 1, 5); }
      else { st.combo = 0; if (useHearts) st.hearts--; }
      save(); st.i++;
      if (cfg.mode === 'sprint') { setTimeout(() => { if (timerId) show(); }, ok ? 350 : 1400); return; }
      $('#after').innerHTML = `<div class="exp"><b class="${ok ? 'ok' : 'no'}">${ok ? '✔ 答對了！' : '✘ 答錯了'}</b>${st.combo > 1 ? ` <span class="combo">連擊 ×${st.combo}</span>` : ''}
        \n正確答案：${esc(q.right)}${q.exp ? '\n💡 ' + esc(q.exp) : ''}</div>
        <div class="row" style="margin-top:12px"><button class="btn" id="next">${st.i >= st.list.length || (useHearts && st.hearts <= 0) ? '看結果' : '下一題 →'}</button></div>`;
      $('#next').onclick = show; $('#next').focus();
    };
    btns.forEach((b, i) => b.onclick = () => answer(i));
    document.onkeydown = e => {
      const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
      if (i >= 0 && i < btns.length && !btns[0].disabled) answer(i);
    };
  }
  if (cfg.mode === 'sprint') {
    timerId = setInterval(() => {
      st.left--; const tm = $('#tm'); if (tm) { tm.textContent = st.left; tm.classList.toggle('low', st.left <= 10); }
      if (st.left <= 0) finish();
    }, 1000);
  }
  show();
}

/* ---------- 各模式入口 ---------- */
function viewQuiz(uid) {
  const u = UNITS[uid]; if (!u) return viewHome();
  startQuiz({title: u.t, back: '#/u/' + u.id, qs: u.qs, mode: 'level', unit: u});
}
function viewMix(sid) {
  const s = subj(sid); if (!s) return viewHome();
  startQuiz({title: s.name + ' 綜合挑戰', back: '#/s/' + sid, qs: s.units.filter(inGrade).flatMap(u => u.qs), mode: 'mix'});
}
function viewSprint() {
  const p = P();
  app.innerHTML = heroHTML() + `<h1>⏱ 限時衝刺</h1>
    <p class="mute">${SPRINT_SEC} 秒內，從所選年級的科目隨機出題，看你能答對幾題！（個人最佳：${p.best['sprint' + DB.grade] || 0} 題）</p>` +
    gradeChips() + `<div class="chips" id="sp">${SUBJECTS.map(s => `<button class="chip on" data-s="${s.id}">${s.icon} ${esc(s.name)}</button>`).join('')}</div>
    <button class="btn" id="go">開始衝刺 🚀</button>`;
  $('#sp').onclick = e => { const b = e.target.closest('[data-s]'); if (b) b.classList.toggle('on'); };
  $('#go').onclick = () => {
    const on = [...app.querySelectorAll('#sp .on')].map(b => b.dataset.s);
    const qs = SUBJECTS.filter(s => on.includes(s.id)).flatMap(s => s.units.filter(inGrade).flatMap(u => u.qs));
    startQuiz({title: '限時衝刺', back: '#/sprint', qs, mode: 'sprint'});
  };
}
function viewWrong() {
  const p = P();
  Object.keys(p.wrong).forEach(id => { if (!QS[id]) delete p.wrong[id]; });
  const list = Object.keys(p.wrong).map(id => QS[id]);
  const by = {};
  list.forEach(q => (by[q.sid] = by[q.sid] || []).push(q));
  app.innerHTML = `<h1>📒 錯題本</h1><p class="mute">答錯的題目會留在這裡，之後再答對 2 次就會自動移除。</p>` +
    (list.length ? `<div class="row"><button class="btn" id="redo">複習全部錯題（${list.length} 題）</button></div>` : '<div class="panel">目前沒有錯題，太厲害了！🎉</div>') +
    Object.keys(by).map(sid => { const s = subj(sid);
      return `<h2>${s.icon} ${esc(s.name)}（${by[sid].length}）</h2><div class="panel"><ul class="wl">` + by[sid].map(q =>
        `<li><div>${esc(q.q)}</div><div class="a">✔ ${esc(q.right)}</div>${q.exp ? `<div class="mute sm">💡 ${esc(q.exp)}</div>` : ''}<a class="sm" href="#/u/${q.uid}">📘 回到「${esc(UNITS[q.uid].t)}」複習</a></li>`).join('') + '</ul></div>';
    }).join('');
  if (list.length) $('#redo').onclick = () => startQuiz({title: '錯題複習', back: '#/wrong', qs: list, mode: 'wrong'});
}
function viewMe() {
  const p = P();
  const rows = SUBJECTS.map(s => {
    const got = s.units.reduce((x, u) => x + (p.stars[u.id] || 0), 0);
    const ln = s.units.filter(u => p.learned[u.id]).length;
    const wr = Object.keys(p.wrong).filter(id => QS[id] && QS[id].sid === s.id).length;
    return `<tr><td>${s.icon} ${esc(s.name)}</td><td>${ln} / ${s.units.length}</td><td>★ ${got} / ${s.units.length * 3}</td><td>${wr}</td></tr>`;
  }).join('');
  app.innerHTML = heroHTML() + `<h1>我的進度</h1>
    <div class="panel"><table><tr><th>科目</th><th>學過</th><th>星星</th><th>錯題</th></tr>${rows}</table></div>
    <h2>切換／新增使用者</h2><div class="panel row">
      <select id="who">${Object.keys(DB.profiles).map(n => `<option ${n === DB.cur ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <input type="text" id="nn" placeholder="新名字" maxlength="12"><button class="btn ghost" id="add">新增並切換</button></div>
    <h2>備份與還原</h2><div class="panel"><p class="mute sm">紀錄只存在這台裝置的瀏覽器裡。換裝置或清除瀏覽資料前，請先匯出備份。</p>
      <div class="row"><button class="btn ghost" id="exp">匯出備份檔</button><label class="btn ghost">匯入備份檔<input type="file" id="imp" accept=".json" hidden></label>
      <button class="btn danger" id="clr">清除「${esc(DB.cur)}」的紀錄</button></div></div>
    <p class="mute sm">題庫版本：${esc(META.updated || '')}・共 ${Object.keys(QS).length} 題・${Object.keys(LESSONS).length} 個單元有互動課程</p>`;
  $('#who').onchange = e => { DB.cur = e.target.value; save(); viewMe(); };
  $('#add').onclick = () => { const n = $('#nn').value.trim(); if (!n) return; DB.cur = n; P(); save(); viewMe(); };
  $('#exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(DB)], {type: 'application/json'}));
    a.download = '知識星航備份-' + today() + '.json'; a.click();
  };
  $('#imp').onchange = async e => {
    try { const d = JSON.parse(await e.target.files[0].text()); if (!d.profiles) throw 0;
      DB.profiles = {...DB.profiles, ...d.profiles}; if (d.cur) DB.cur = d.cur; save(); alert('匯入完成'); viewMe();
    } catch (err) { alert('這不是有效的備份檔'); }
  };
  $('#clr').onclick = () => { if (confirm('確定清除「' + DB.cur + '」的所有紀錄？此動作無法復原。')) { DB.profiles[DB.cur] = blank(); save(); viewMe(); } };
}

/* ---------- 路由 ---------- */
function route() {
  stopTimer(); document.onkeydown = null;
  const [, r, a] = location.hash.split('/');
  document.querySelectorAll('[data-nav]').forEach(n => n.classList.toggle('on', n.dataset.nav === (r || 'home') || (n.dataset.nav === 'home' && ['s', 'u', 'learn', 'quiz', 'mix'].includes(r))));
  if (r === 's') viewSubject(a); else if (r === 'u') viewUnit(a); else if (r === 'learn') runLesson(a);
  else if (r === 'quiz') viewQuiz(a); else if (r === 'mix') viewMix(a);
  else if (r === 'sprint') viewSprint(); else if (r === 'wrong') viewWrong(); else if (r === 'me') viewMe(); else viewHome();
  window.scrollTo(0, 0);
}
app.addEventListener('click', e => {
  const g = e.target.closest('[data-grade]');
  if (g) { DB.grade = +g.dataset.grade; save(); route(); }
});
const sndBtn = $('#snd');
const sndSync = () => { sndBtn.textContent = DB.mute ? '🔇' : '🔊'; };
sndBtn.onclick = () => { DB.mute = !DB.mute; save(); sndSync(); if (!DB.mute) sfx.tap(); };
sndSync();
window.addEventListener('hashchange', route);
loadBank().then(() => {
  const nl = Object.keys(LESSONS).length;
  $('#bankInfo').textContent = `題庫共 ${Object.keys(QS).length} 題・${nl} 個互動單元・最後更新 ${META.updated || ''}`;
  P(); save(); route();
}).catch(err => { app.innerHTML = '<p class="loading">載入失敗，請重新整理頁面。<br><span class="sm">' + esc(err.message) + '</span></p>'; });
})();

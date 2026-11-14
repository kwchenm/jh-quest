/* 國中知識星航 — 主程式（純前端，無需建置） */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const esc = t => String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
const today = () => new Date().toLocaleDateString('sv');
const GRADES = [[0, '全部年級'], [7, '七年級'], [8, '八年級'], [9, '九年級']];
const LEVEL_SIZE = 8, MIX_SIZE = 20, SPRINT_SEC = 60;

/* ---------- 題庫 ---------- */
let SUBJECTS = [], UNITS = {}, QS = {}, META = {};
async function loadBank() {
  const man = await (await fetch('data/manifest.json', {cache: 'no-cache'})).json();
  META = man;
  const files = await Promise.all(man.subjects.map(s => fetch('data/' + s.file, {cache: 'no-cache'}).then(r => r.json())));
  SUBJECTS = man.subjects.map((s, i) => {
    const units = files[i].units.map(u => {
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
const blank = () => ({xp: 0, streak: 0, lastDay: '', stars: {}, wrong: {}, best: {}, done: 0, right: 0});
const P = () => DB.profiles[DB.cur] || (DB.profiles[DB.cur] = blank());
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
  if (!ok) p.wrong[q.id] = 2;                       // 需再答對 2 次才移出錯題本
  else if (p.wrong[q.id]) { if (--p.wrong[q.id] <= 0) delete p.wrong[q.id]; }
}

/* ---------- 畫面共用 ---------- */
const starStr = n => '<span>' + '★'.repeat(n) + '</span><span class="off">' + '★'.repeat(3 - n) + '</span>';
const inGrade = u => !DB.grade || u.g === DB.grade;
function heroHTML() {
  const p = P(), lv = level(p.xp), a = levelFloor(lv), b = levelFloor(lv + 1);
  return `<section class="hero"><div><div class="who">👩‍🚀 ${esc(DB.cur)}　Lv.${lv}</div>
    <div class="xpbar"><i style="width:${Math.round((p.xp - a) / (b - a) * 100)}%"></i></div></div>
    <div class="stat"><span>經驗 <b>${p.xp}</b></span><span>連續學習 <b>${p.streak}</b> 天</span>
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
    const nq = us.reduce((x, u) => x + u.qs.length, 0);
    return `<a class="card subj" href="#/s/${s.id}" style="border-top:4px solid ${s.color}">
      <div class="ico">${s.icon}</div><div class="nm">${esc(s.name)}星系</div>
      <div class="meta">${us.length} 顆星球・${nq} 題</div>
      <div class="bar"><i style="width:${max ? got / max * 100 : 0}%"></i></div>
      <div class="meta">★ ${got} / ${max}</div></a>`;
  }).join('');
  app.innerHTML = heroHTML() + `<h1>選一個星系開始探險</h1>
    <p class="mute sm">每顆星球是一個課綱主題。答對拿星星、累積經驗升級；答錯的題目會收進錯題本，隨時回來複習。</p>` +
    gradeChips() + `<div class="grid">${cards}</div>`;
}

/* ---------- 科目頁 ---------- */
function viewSubject(sid) {
  const s = subj(sid); if (!s) return viewHome();
  const p = P(), us = s.units.filter(inGrade);
  const groups = {};
  us.forEach(u => (groups[u.g + u.s] = groups[u.g + u.s] || []).push(u));
  const cn = {7: '七', 8: '八', 9: '九'};
  const html = Object.keys(groups).sort().map(k => {
    const list = groups[k];
    return `<h2>${cn[list[0].g]}年級${list[0].s}學期</h2><div class="grid">` + list.map(u =>
      `<a class="card unit" href="#/quiz/${u.id}"><div class="st">${starStr(p.stars[u.id] || 0)}</div>
       <div class="ttl">🪐 ${esc(u.t)}</div><div class="meta">${u.qs.length} 題${u.k ? '・' + esc(u.k) : ''}</div></a>`).join('') + '</div>';
  }).join('');
  app.innerHTML = `<a class="back" href="#/">← 回星圖</a><h1>${s.icon} ${esc(s.name)}星系</h1>` + gradeChips() +
    `<div class="row"><a class="btn" href="#/mix/${s.id}">🌌 綜合挑戰（${DB.grade ? cn[DB.grade] + '年級' : '會考範圍'}隨機 ${MIX_SIZE} 題）</a></div>` +
    (html || '<p class="mute">這個年級沒有此科目的單元。</p>');
}

/* ---------- 測驗引擎 ---------- */
let timerId = null;
const stopTimer = () => { if (timerId) { clearInterval(timerId); timerId = null; } };
function startQuiz(cfg) {
  // cfg: {title, back, qs, mode:'level'|'mix'|'wrong'|'sprint', unit}
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
    }
    if (cfg.mode === 'sprint') {
      const p = P(), k = 'sprint' + DB.grade;
      if (st.right > (p.best[k] || 0)) { p.best[k] = st.right; extra = '🎉 刷新個人紀錄！'; }
      else extra = `個人最佳：${p.best[k] || 0} 題`;
    }
    P().xp += st.xp; save();
    const msg = cfg.mode === 'level' ? (st.hearts <= 0 ? '能量耗盡，再試一次！' : ['再接再厲！', '通過了，繼續加油！', '很棒！差一點就滿星', '完美登陸！'][stars]) : '挑戰完成！';
    app.innerHTML = `<div class="quiz"><div class="panel result">
      ${cfg.mode === 'level' ? `<div class="big">${starStr(stars)}</div>` : ''}
      <h1>${msg}</h1><p>答對 <b>${st.right}</b> / ${total} 題　最高連擊 ${st.maxCombo}　獲得經驗 <b>+${st.xp}</b></p>
      <p class="mute">${extra}</p>
      <div class="row" style="justify-content:center"><button class="btn" id="again">再玩一次</button>
      <a class="btn ghost" href="${cfg.back}">返回</a><a class="btn ghost" href="#/wrong">看錯題本</a></div></div></div>`;
    $('#again').onclick = () => startQuiz(cfg);
  }

  function show() {
    if (cfg.mode === 'sprint' && st.i >= st.list.length) { st.list = st.list.concat(shuffle(cfg.qs)); }
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
      btns.forEach((b, j) => { b.disabled = true; if (opts[j] === q.right) b.classList.add('right'); else if (j === i) b.classList.add('wrong'); });
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
  startQuiz({title: u.t, back: '#/s/' + u.sid, qs: u.qs, mode: 'level', unit: u});
}
function viewMix(sid) {
  const s = subj(sid); if (!s) return viewHome();
  startQuiz({title: s.name + ' 綜合挑戰', back: '#/s/' + sid, qs: s.units.filter(inGrade).flatMap(u => u.qs), mode: 'mix'});
}
function viewSprint() {
  const p = P();
  app.innerHTML = heroHTML() + `<h1>⏱ 限時衝刺</h1>
    <p class="mute">${SPRINT_SEC} 秒內，從所選年級的全部科目隨機出題，看你能答對幾題！（個人最佳：${p.best['sprint' + DB.grade] || 0} 題）</p>` +
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
        `<li><div>${esc(q.q)}</div><div class="a">✔ ${esc(q.right)}</div>${q.exp ? `<div class="mute sm">💡 ${esc(q.exp)}</div>` : ''}</li>`).join('') + '</ul></div>';
    }).join('');
  if (list.length) $('#redo').onclick = () => startQuiz({title: '錯題複習', back: '#/wrong', qs: list, mode: 'wrong'});
}
function viewMe() {
  const p = P();
  const rows = SUBJECTS.map(s => {
    const got = s.units.reduce((x, u) => x + (p.stars[u.id] || 0), 0);
    const wr = Object.keys(p.wrong).filter(id => QS[id] && QS[id].sid === s.id).length;
    return `<tr><td>${s.icon} ${esc(s.name)}</td><td>★ ${got} / ${s.units.length * 3}</td><td>${wr}</td></tr>`;
  }).join('');
  app.innerHTML = heroHTML() + `<h1>我的進度</h1>
    <div class="panel"><table><tr><th>科目</th><th>星星</th><th>錯題</th></tr>${rows}</table></div>
    <h2>切換／新增使用者</h2><div class="panel row">
      <select id="who">${Object.keys(DB.profiles).map(n => `<option ${n === DB.cur ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <input type="text" id="nn" placeholder="新名字" maxlength="12"><button class="btn ghost" id="add">新增並切換</button></div>
    <h2>備份與還原</h2><div class="panel"><p class="mute sm">紀錄只存在這台裝置的瀏覽器裡。換裝置或清除瀏覽資料前，請先匯出備份。</p>
      <div class="row"><button class="btn ghost" id="exp">匯出備份檔</button><label class="btn ghost">匯入備份檔<input type="file" id="imp" accept=".json" hidden></label>
      <button class="btn danger" id="clr">清除「${esc(DB.cur)}」的紀錄</button></div></div>
    <p class="mute sm">題庫版本：${esc(META.updated || '')}・共 ${Object.keys(QS).length} 題</p>`;
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
  document.querySelectorAll('[data-nav]').forEach(n => n.classList.toggle('on', n.dataset.nav === (r || 'home') || (n.dataset.nav === 'home' && ['s', 'quiz', 'mix'].includes(r))));
  if (r === 's') viewSubject(a); else if (r === 'quiz') viewQuiz(a); else if (r === 'mix') viewMix(a);
  else if (r === 'sprint') viewSprint(); else if (r === 'wrong') viewWrong(); else if (r === 'me') viewMe(); else viewHome();
  window.scrollTo(0, 0);
}
app.addEventListener('click', e => {
  const g = e.target.closest('[data-grade]');
  if (g) { DB.grade = +g.dataset.grade; save(); route(); }
});
window.addEventListener('hashchange', route);
loadBank().then(() => {
  $('#bankInfo').textContent = `題庫共 ${Object.keys(QS).length} 題・最後更新 ${META.updated || ''}`;
  P(); save(); route();
}).catch(err => { app.innerHTML = '<p class="loading">題庫載入失敗，請重新整理頁面。<br><span class="sm">' + esc(err.message) + '</span></p>'; });
})();

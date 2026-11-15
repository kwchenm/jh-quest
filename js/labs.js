/* 互動實驗室：動手調整 → 觀察變化 → 完成任務
   每個實驗以單元代號為 key。純邏輯（view 回傳字串），瀏覽器與 Node 都能載入測試。
   mission：{t 任務, set 進入時設定, ok 是否達成, say 完成後的說明, sol 解法（測試用）, hint 提示} */
(function (G) {
'use strict';
const L = G.LABS = {};
const R = (n, d = 2) => String(Math.round(n * 10 ** d) / 10 ** d);
const rep = (e, n) => e.repeat(Math.max(0, Math.min(60, Math.round(n))));
const svg = (w, h, inner) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const T = (x, y, t, o = '') => `<text x="${x}" y="${y}" ${o}>${t}</text>`;
const rc = (x, y, w, h, c, o = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${c}" ${o}/>`;
const M = (t, set, ok, say, sol, hint) => ({ t, set, ok, say, sol, hint });

function plane(n, sz = 300) {
  const u = sz / (2 * n + 2), c = sz / 2, X = x => c + x * u, Y = y => c - y * u;
  let g = `<defs><clipPath id="pc"><rect x="${X(-n)}" y="${Y(n)}" width="${2 * n * u}" height="${2 * n * u}"/></clipPath></defs>`;
  for (let i = -n; i <= n; i++) {
    g += `<line x1="${X(i)}" y1="${Y(n)}" x2="${X(i)}" y2="${Y(-n)}" class="gl"/><line x1="${X(-n)}" y1="${Y(i)}" x2="${X(n)}" y2="${Y(i)}" class="gl"/>`;
    if (i) g += T(X(i), c + 9, i, 'class="tk"') + T(c - 8, Y(i), i, 'class="tk"');
  }
  g += `<line x1="${X(-n)}" y1="${c}" x2="${X(n)}" y2="${c}" class="ax"/><line x1="${c}" y1="${Y(n)}" x2="${c}" y2="${Y(-n)}" class="ax"/>` + T(X(n) + 9, c, 'x', 'class="tk"') + T(c, Y(n) - 8, 'y', 'class="tk"');
  return { g, X, Y, u };
}

/* ======================= 數學 ======================= */
L.ma7a1 = {
  name: '數線跳跳蛙', intro: '青蛙站在數線上。「加」就往右跳，「減」就往左跳。**點數線上的數字**，讓青蛙跳到正確答案！',
  init: () => ({ start: 0, pos: 0 }),
  view: s => {
    let g = '<line x1="10" y1="60" x2="330" y2="60" class="ax"/>';
    for (let i = -10; i <= 10; i++) { const x = 170 + i * 15; g += `<g data-tap="${i}" class="tapz"><rect x="${x - 7.5}" y="15" width="15" height="80" class="hit"/><line x1="${x}" y1="54" x2="${x}" y2="66" class="ax"/>${T(x, 78, i, 'class="tk"')}</g>`; }
    const a = 170 + s.start * 15, b = 170 + s.pos * 15;
    if (s.pos !== s.start) g += `<path d="M${a} 48 Q${(a + b) / 2} 4 ${b} 48" class="arc"/>`;
    return svg(340, 105, g + T(a, 96, '🚩', 'font-size="13"') + T(b, 38, '🐸', 'font-size="22"'));
  },
  read: s => [['起點', s.start], ['青蛙現在', s.pos], ['這一跳', s.pos === s.start ? '還沒跳' : (s.pos > s.start ? '往右 ' : '往左 ') + Math.abs(s.pos - s.start) + ' 格']],
  tap: (s, id) => { s.pos = +id; },
  missions: [
    M('青蛙在 −7。算式 (−7) + 12：往右跳 12 格，會落在哪裡？', s => { s.start = -7; s.pos = -7; }, s => s.pos === 5, '(−7) + 12 = **5**。加正數就是往右跳。', s => { s.pos = 5; }, '從 −7 往右數 12 格。'),
    M('青蛙在 5。算式 5 − (−3)：減去負數，其實是往「右」跳 3 格！', s => { s.start = 5; s.pos = 5; }, s => s.pos === 8, '5 − (−3) = 5 + 3 = **8**。**減負數＝加正數**。', s => { s.pos = 8; }, '減負數等於加正數：往右 3 格。'),
    M('青蛙在 −2。算式 (−2) − 6：往左跳 6 格。', s => { s.start = -2; s.pos = -2; }, s => s.pos === -8, '(−2) − 6 = **−8**。越往左，數越小。', s => { s.pos = -8; }, '從 −2 往左數 6 格。'),
    M('和原點 0 的距離是 6 的數有兩個。讓青蛙跳到「左邊」那一個。', s => { s.start = 0; s.pos = 0; }, s => s.pos === -6, '|−6| = |6| = 6。**絕對值**就是到原點的距離，所以答案有 6 和 −6。', s => { s.pos = -6; }, '距離 6，在原點左邊。')
  ]
};

const eq = s => `${s.a > 1 ? s.a : ''}x${s.b > 0 ? ' + ' + s.b : s.b < 0 ? ' − ' + (-s.b) : ''} = ${s.c}`;
L.ma7a2 = {
  name: '天平解方程式', intro: '每個 📦 裡面都裝著 **x** 個砝碼。兩邊做「一樣的事」，天平就不會倒。想辦法讓左邊**只剩 1 個 📦**，就知道 x 是多少！',
  init: () => ({ a: 2, b: 3, c: 11, msg: '' }),
  ctrl: [
    { type: 'btn', label: '兩邊各拿走 1', run: s => { s.msg = ''; s.b--; s.c--; } },
    { type: 'btn', label: '兩邊各加上 1', run: s => { s.msg = ''; s.b++; s.c++; } },
    { type: 'btn', label: '兩邊平分（÷ 箱子數）', run: s => { if (s.a === 1) { s.msg = '已經只剩 1 個箱子了。'; return; } if (s.b !== 0) { s.msg = '左邊還有別的東西，先處理掉才能平分喔！'; return; } if (s.c % s.a) { s.msg = '分不平，再想想。'; return; } s.c /= s.a; s.a = 1; s.msg = ''; } }
  ],
  view: s => { const w = n => n === 0 ? '' : n > 0 ? (n > 12 ? `🟡×${n}` : rep('🟡', n)) : (n < -12 ? `🎈×${-n}` : rep('🎈', -n));
    return `<div class="bal"><div class="pan">${rep('📦', s.a)}<br>${w(s.b) || '&nbsp;'}</div><div class="fulc">⚖️</div><div class="pan">${w(s.c) || '（空）'}</div></div><p class="labnote">🎈 代表「少 1」（負數）${s.msg ? '　<b>' + s.msg + '</b>' : ''}</p>`; },
  read: s => [['算式', eq(s)]],
  missions: [
    M('解 2x + 3 = 11', s => { s.a = 2; s.b = 3; s.c = 11; s.msg = ''; }, s => s.a === 1 && s.b === 0, s => `x = **${s.c}**。先兩邊減 3，再兩邊除以 2。`, s => { s.b = 0; s.c = 4; s.a = 1; }, '先把左邊的 3 個砝碼拿走。'),
    M('解 3x + 2 = 14', s => { s.a = 3; s.b = 2; s.c = 14; s.msg = ''; }, s => s.a === 1 && s.b === 0, s => `x = **${s.c}**。等號兩邊做相同的運算，等式仍然成立。`, s => { s.b = 0; s.c = 4; s.a = 1; }, '先拿走 2，再平分成 3 份。'),
    M('解 3x − 5 = 16（左邊有 5 個 🎈）', s => { s.a = 3; s.b = -5; s.c = 16; s.msg = ''; }, s => s.a === 1 && s.b === 0, s => `x = **${s.c}**。「−5」要兩邊各加 5 才會消掉，這就是**移項變號**。`, s => { s.b = 0; s.c = 7; s.a = 1; }, '氣球是 −1，兩邊各加 1 可以抵消一個氣球。')
  ]
};

const QN = (x, y) => x > 0 && y > 0 ? '一' : x < 0 && y > 0 ? '二' : x < 0 && y < 0 ? '三' : x > 0 && y < 0 ? '四' : '';
L.ma7b1 = {
  name: '星圖定位', intro: '坐標 **(x, y)**：先看橫的 x，再看直的 y。**點格子**把衛星 🛰️ 放到指定的位置！',
  init: () => ({ x: 0, y: 0, tx: 3, ty: 2 }),
  view: s => { const p = plane(5); let g = p.g + T(p.X(3), p.Y(4.5), '第一象限', 'class="q"') + T(p.X(-3), p.Y(4.5), '第二象限', 'class="q"') + T(p.X(-3), p.Y(-4.5), '第三象限', 'class="q"') + T(p.X(3), p.Y(-4.5), '第四象限', 'class="q"');
    for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) g += `<circle cx="${p.X(i)}" cy="${p.Y(j)}" r="${p.u / 2}" class="hit" data-tap="${i},${j}"/>`;
    return svg(300, 300, g + T(p.X(s.x), p.Y(s.y), '🛰️', 'font-size="20" pointer-events="none"')); },
  read: s => [['目標', `(${s.tx}, ${s.ty})`]],
  tap: (s, id) => { [s.x, s.y] = id.split(',').map(Number); },
  missions: [[3, 2], [-2, 4], [-3, -1], [4, -3]].map(([tx, ty]) => M(`把衛星放到 (${tx}, ${ty})`, s => { s.tx = tx; s.ty = ty; s.x = 0; s.y = 0; }, s => s.x === tx && s.y === ty,
    `(${tx}, ${ty}) 在**第${QN(tx, ty)}象限**：x 是${tx > 0 ? '正' : '負'}的、y 是${ty > 0 ? '正' : '負'}的。`, s => { s.x = tx; s.y = ty; }, s => `你放在 (${s.x}, ${s.y})。記得先橫（x）再直（y）。`))
};

L.ma7b2 = {
  name: '面積固定的長方形', intro: '這塊地的面積永遠是 **12**。拉動滑桿改變長 x，看看寬 y 怎麼跟著變！',
  init: () => ({ x: 3 }),
  ctrl: [{ k: 'x', label: '長 x', min: 1, max: 12 }],
  view: s => { const y = 12 / s.x, u = 17; return svg(270, 232, rc(16, 214 - y * u, s.x * u, y * u, 'fillA') + T(16 + s.x * u / 2, 224, 'x = ' + s.x, 'class="tk"') + T(16 + s.x * u + 26, 214 - y * u / 2, 'y = ' + R(y), 'class="tk"')); },
  read: s => [['長 x', s.x], ['寬 y', R(12 / s.x)], ['x × y', 12]],
  missions: [
    M('把長 x 調成 4，寬 y 是多少？', s => { s.x = 3; }, s => s.x === 4, '4 × 3 = 12。x 變大，y 就變小，但 **x × y 永遠是 12**。這種關係叫做**反比**。', s => { s.x = 4; }),
    M('讓寬 y 變成 6', s => { s.x = 4; }, s => s.x === 2, 'x = 2 時 y = 6。x 變成一半，y 就變成 2 倍。', s => { s.x = 2; }, 'x × y = 12，所以 x = 12 ÷ 6。'),
    M('讓寬 y 變成 1.5', s => { s.x = 2; }, s => s.x === 8, 'x = 8 時 y = 1.5。反比關係：**y = 12 ÷ x**。', s => { s.x = 8; }, 'x = 12 ÷ 1.5。')
  ]
};

L.ma8a1 = {
  name: '乘法公式拼圖', intro: '大正方形的邊長是 **a + b**。它被切成四塊：一塊 a²、兩塊 ab、一塊 b²。拉滑桿看看面積怎麼變！',
  init: () => ({ a: 2, b: 1 }),
  ctrl: [{ k: 'a', label: 'a', min: 1, max: 6 }, { k: 'b', label: 'b', min: 1, max: 6 }],
  view: s => { const u = 24, A = s.a * u, B = s.b * u, o = 6;
    return svg(300, 300, rc(o, o, A, A, 'fillA') + rc(o + A, o, B, A, 'fillB') + rc(o, o + A, A, B, 'fillB') + rc(o + A, o + A, B, B, 'fillC') + T(o + A / 2, o + A / 2, 'a²=' + s.a * s.a) + T(o + A + B / 2, o + A / 2, s.a * s.b) + T(o + A / 2, o + A + B / 2, s.a * s.b) + T(o + A + B / 2, o + A + B / 2, s.b * s.b)); },
  read: s => [['a² + 2ab + b²', `${s.a * s.a} + ${2 * s.a * s.b} + ${s.b * s.b} = ${(s.a + s.b) ** 2}`], ['(a + b)²', `${s.a + s.b}² = ${(s.a + s.b) ** 2}`]],
  missions: [
    M('調成 a = 3、b = 2，四塊面積加起來是多少？', s => { s.a = 2; s.b = 1; }, s => s.a === 3 && s.b === 2, '9 + 6 + 6 + 4 = 25 = (3 + 2)²。所以 **(a + b)² = a² + 2ab + b²**。', s => { s.a = 3; s.b = 2; }),
    M('讓兩塊黃色長方形的面積各是 12', s => { s.a = 1; s.b = 1; }, s => s.a * s.b === 12, '黃色那兩塊就是公式中間的 **2ab**，最容易被漏掉！', s => { s.a = 3; s.b = 4; }, '黃色每塊的面積是 a × b。'),
    M('讓整個大正方形的面積變成 49', s => { s.a = 1; s.b = 1; }, s => s.a + s.b === 7, '邊長 a + b = 7，面積就是 7² = 49。', s => { s.a = 3; s.b = 4; }, '49 = 7²，所以 a + b = 7。')
  ]
};

L.ma8a2 = {
  name: '畢氏定理測量站', intro: '直角三角形的兩股是 a、b，斜邊是 c。拉滑桿改變兩股，看看 **a² + b²** 和 **c²** 的關係！',
  init: () => ({ a: 2, b: 2 }),
  ctrl: [{ k: 'a', label: '股 a', min: 1, max: 15 }, { k: 'b', label: '股 b', min: 1, max: 15 }],
  view: s => { const u = 12, x0 = 34, y0 = 198, x1 = x0 + s.a * u, y1 = y0 - s.b * u;
    return svg(240, 215, `<polygon points="${x0},${y0} ${x1},${y0} ${x0},${y1}" class="fillA"/>` + rc(x0, y0 - 9, 9, 9, 'mark') + T((x0 + x1) / 2, y0 + 10, 'a = ' + s.a, 'class="tk"') + T(x0 - 18, (y0 + y1) / 2, 'b=' + s.b, 'class="tk"') + T((x0 + x1) / 2 + 16, (y0 + y1) / 2 - 8, 'c', 'class="tk"')); },
  read: s => { const c2 = s.a * s.a + s.b * s.b, c = Math.sqrt(c2); return [['a² + b²', `${s.a * s.a} + ${s.b * s.b} = ${c2}`], ['斜邊 c = √' + c2, R(c) + (Number.isInteger(c) ? ' ✨ 整數！' : '')]]; },
  missions: [
    M('把兩股調成 3 和 4，斜邊是多少？', s => { s.a = 2; s.b = 2; }, s => s.a * s.a + s.b * s.b === 25, '9 + 16 = 25，所以斜邊 = **5**。這就是**畢氏定理：a² + b² = c²**。', s => { s.a = 3; s.b = 4; }),
    M('找出一組兩股，讓斜邊剛好是 10', s => { s.a = 1; s.b = 1; }, s => s.a * s.a + s.b * s.b === 100, '6² + 8² = 100 = 10²。**6-8-10** 是 3-4-5 放大 2 倍。', s => { s.a = 6; s.b = 8; }, '把 3-4-5 都乘以 2 試試。'),
    M('再找一組，讓斜邊剛好是 13', s => { s.a = 1; s.b = 1; }, s => s.a * s.a + s.b * s.b === 169, '5² + 12² = 169 = 13²。**5-12-13** 也是常考的勾股數。', s => { s.a = 5; s.b = 12; }, '其中一股是 5。')
  ]
};

const LINE_PTS = [[[0, 3], [1, 5]], [[0, -2], [2, 0]], [[-3, 4], [3, 4]]];
L.ma8b1 = {
  name: '直線函數發射台', intro: '函數 **y = ax + b** 的圖形是一條直線。調整 a 和 b，讓雷射光**同時穿過兩顆星星**！',
  init: () => ({ a: 1, b: 0, mi: 0 }),
  ctrl: [{ k: 'a', label: 'a（斜的程度）', min: -3, max: 3, step: 0.5 }, { k: 'b', label: 'b（和 y 軸的交點）', min: -5, max: 5 }],
  view: s => { const p = plane(6); return svg(300, 300, p.g + `<line x1="${p.X(-7)}" y1="${p.Y(-7 * s.a + s.b)}" x2="${p.X(7)}" y2="${p.Y(7 * s.a + s.b)}" class="ln" clip-path="url(#pc)"/>` + LINE_PTS[s.mi || 0].map(q => T(p.X(q[0]), p.Y(q[1]), '⭐', 'font-size="15"')).join('')); },
  read: s => [['函數', `y = ${s.a}x ${s.b < 0 ? '− ' + (-s.b) : '+ ' + s.b}`], ['和 y 軸交於', `(0, ${s.b})`]],
  missions: [
    M('讓直線通過 (0, 3) 和 (1, 5)', s => { s.a = 1; s.b = 0; }, s => s.a === 2 && s.b === 3, 'y = 2x + 3。**b** 是和 y 軸的交點 (0, 3)；x 每加 1，y 就加 **a** = 2。', s => { s.a = 2; s.b = 3; }, '先用 b 對準 (0, 3)，再調 a。'),
    M('讓直線通過 (0, −2) 和 (2, 0)', s => { s.a = -1; s.b = 1; }, s => s.a === 1 && s.b === -2, 'y = x − 2。', s => { s.a = 1; s.b = -2; }, '先讓 b = −2。'),
    M('做出一條水平線，通過 (−3, 4) 和 (3, 4)', s => { s.a = 1; s.b = 0; }, s => s.a === 0 && s.b === 4, 'a = 0 時 y = 4，不管 x 是多少 y 都是 4，這叫做**常數函數**，圖形是水平線。', s => { s.a = 0; s.b = 4; }, '水平線不會斜，所以 a = 0。')
  ]
};

L.ma8b2 = {
  name: '多邊形工廠', intro: '從一個頂點畫對角線，可以把 n 邊形切成 **n − 2** 個三角形。拉滑桿改變邊數看看！',
  init: () => ({ n: 3 }),
  ctrl: [{ k: 'n', label: '邊數 n', min: 3, max: 10 }],
  view: s => { const n = s.n, P = [...Array(n)].map((_, i) => { const a = (-90 + 360 * i / n) * Math.PI / 180; return [130 + 92 * Math.cos(a), 112 + 92 * Math.sin(a)]; });
    let g = `<polygon points="${P.map(p => p.join(',')).join(' ')}" class="fillA"/>`;
    for (let i = 2; i < n - 1; i++) g += `<line x1="${P[0][0]}" y1="${P[0][1]}" x2="${P[i][0]}" y2="${P[i][1]}" class="dash"/>`;
    return svg(260, 220, g); },
  read: s => [['切成', (s.n - 2) + ' 個三角形'], ['內角和', `${s.n - 2} × 180° = ${(s.n - 2) * 180}°`], ['正 ' + s.n + ' 邊形每個內角', R((s.n - 2) * 180 / s.n, 1) + '°']],
  missions: [
    M('做出每個內角都是 120° 的正多邊形', s => { s.n = 3; }, s => s.n === 6, '正六邊形：內角和 720°，720 ÷ 6 = 120°。**內角和 = (n − 2) × 180°**。', s => { s.n = 6; }),
    M('做出每個內角都是 108° 的正多邊形', s => { s.n = 3; }, s => s.n === 5, '正五邊形：540° ÷ 5 = 108°。', s => { s.n = 5; }),
    M('做出內角和是 1080° 的多邊形', s => { s.n = 3; }, s => s.n === 8, '八邊形可切成 6 個三角形，6 × 180° = 1080°。', s => { s.n = 8; }, '1080 ÷ 180 = 6 個三角形。')
  ]
};

L.ma9a1 = {
  name: '放大縮小燈', intro: '用放大燈照三角形，形狀不變、大小改變，這就是**相似**。看看邊長和面積各放大幾倍！',
  init: () => ({ k: 1 }),
  ctrl: [{ k: 'k', label: '放大倍率', min: 1, max: 4, step: 0.5 }],
  view: s => svg(215, 135, `<polygon points="12,125 42,125 12,101" class="fillC"/><polygon points="75,125 ${75 + 30 * s.k},125 75,${125 - 24 * s.k}" class="fillA"/>` + T(27, 132, '原圖', 'class="tk"')),
  read: s => [['邊長比', '1 : ' + s.k], ['面積比', '1 : ' + R(s.k * s.k)]],
  missions: [
    M('讓面積變成原來的 4 倍', s => { s.k = 1; }, s => s.k === 2, '邊長放大 2 倍，面積放大 2² = **4** 倍。', s => { s.k = 2; }),
    M('讓面積變成原來的 9 倍', s => { s.k = 1; }, s => s.k === 3, '邊長比 1 : 3，面積比 1 : 9。**面積比 = 邊長比的平方**。', s => { s.k = 3; }),
    M('邊長比 2 : 3 就是放大 1.5 倍。調過去看看面積比', s => { s.k = 1; }, s => s.k === 1.5, '面積變成 2.25 倍，也就是 **4 : 9**。', s => { s.k = 1.5; })
  ]
};

L.ma9a2 = {
  name: '圓周角觀測站', intro: '橘色是**圓心角**，藍色是同一段弧所對的**圓周角**。移動 P 點、改變弧的大小，找出它們的關係！',
  init: () => ({ arc: 100, p: 20 }),
  ctrl: [{ k: 'arc', label: '弧 AB 的度數', min: 40, max: 320, step: 20 }, { k: 'p', label: 'P 點的位置', min: 0, max: 100, step: 5 }],
  view: s => { const cx = 120, cy = 112, r = 86, pt = d => [cx + r * Math.cos(d * Math.PI / 180), cy + r * Math.sin(d * Math.PI / 180)];
    const A = pt(90 + s.arc / 2), B = pt(90 - s.arc / 2), P = pt(90 - s.arc / 2 - (0.1 + 0.8 * s.p / 100) * (360 - s.arc));
    const ln = (a, b, c) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="${c}"/>`;
    return svg(240, 224, `<circle cx="${cx}" cy="${cy}" r="${r}" class="orbit"/>` + ln([cx, cy], A, 'ln2') + ln([cx, cy], B, 'ln2') + ln(P, A, 'ln') + ln(P, B, 'ln') + T(A[0] - 8, A[1] + 9, 'A', 'class="tk"') + T(B[0] + 8, B[1] + 9, 'B', 'class="tk"') + T(P[0], P[1] - 9, 'P', 'class="tk"') + T(cx + 9, cy - 7, 'O', 'class="tk"')); },
  read: s => [['圓心角 ∠AOB', s.arc + '°'], ['圓周角 ∠APB', s.arc / 2 + '°']],
  missions: [
    M('把 P 點滑到另一頭（位置 80 以上）。圓周角有改變嗎？', s => { s.arc = 100; s.p = 20; }, s => s.p >= 80, '沒有變！**同一段弧所對的圓周角都相等**，而且是圓心角的**一半**。', s => { s.p = 90; }),
    M('讓圓周角剛好是 90°', s => { s.arc = 100; }, s => s.arc === 180, '弧是 180°，AB 剛好是直徑。**半圓所對的圓周角是 90°**。', s => { s.arc = 180; }, '圓周角是弧度數的一半。'),
    M('讓圓周角變成 60°', s => { s.arc = 180; }, s => s.arc === 120, '弧 120°，圓周角 = 120° ÷ 2 = 60°。', s => { s.arc = 120; })
  ]
};

L.ma9b1 = {
  name: '拋物線投籃機', intro: '二次函數 **y = a(x − h)² + k** 的圖形是拋物線，頂點在 **(h, k)**。調整三個數字，看拋物線怎麼動！',
  init: () => ({ a: 1, h: 0, k: 0 }),
  ctrl: [{ k: 'a', label: 'a（開口）', min: -2, max: 2, step: 0.5 }, { k: 'h', label: 'h（左右）', min: -4, max: 4 }, { k: 'k', label: 'k（上下）', min: -4, max: 4 }],
  view: s => { const p = plane(6); let pts = ''; for (let x = -6; x <= 6.01; x += 0.25) pts += `${p.X(x)},${p.Y(s.a * (x - s.h) ** 2 + s.k)} `;
    return svg(300, 300, p.g + `<polyline points="${pts}" class="ln" fill="none" clip-path="url(#pc)"/><circle cx="${p.X(s.h)}" cy="${p.Y(s.k)}" r="5" class="vx"/>`); },
  read: s => [['頂點', `(${s.h}, ${s.k})`], ['開口', s.a > 0 ? '向上（有最小值 ' + s.k + '）' : s.a < 0 ? '向下（有最大值 ' + s.k + '）' : 'a = 0 就不是二次函數了']],
  missions: [
    M('把頂點移到 (2, 3)', s => { s.a = 1; s.h = 0; s.k = 0; }, s => s.h === 2 && s.k === 3, 'y = (x − 2)² + 3 的頂點是 **(2, 3)**。注意 h 前面是減號！', s => { s.h = 2; s.k = 3; }),
    M('讓拋物線開口向下，而且最大值是 4', s => { s.a = 1; s.h = 0; s.k = 0; }, s => s.a < 0 && s.k === 4, '**a < 0 開口向下**，頂點是最高點，最大值就是 k。', s => { s.a = -1; s.k = 4; }, 'a 要調成負的，k 是最大值。'),
    M('讓頂點在 (2, −4)，而且拋物線通過原點 (0, 0)', s => { s.a = -1; s.h = 0; s.k = 0; }, s => s.a === 1 && s.h === 2 && s.k === -4, 'x = 0 時 y = 1 × (0 − 2)² − 4 = 0，所以通過原點。', s => { s.a = 1; s.h = 2; s.k = -4; }, '先移頂點，再調 a 讓線穿過原點。')
  ]
};

const roll = (s, k) => { for (let i = 0; i < k; i++) { const r = Math.floor(Math.random() * 6); s.c[r]++; s.n++; s.last = r; } };
L.ma9b2 = {
  name: '骰子大數據', intro: '擲一次骰子很難猜，但擲很多很多次會發生什麼事？按按鈕擲擲看！',
  init: () => ({ c: [0, 0, 0, 0, 0, 0], n: 0, last: -1 }),
  ctrl: [{ type: 'btn', label: '🎲 擲 1 次', run: s => roll(s, 1) }, { type: 'btn', label: '擲 10 次', run: s => roll(s, 10) }, { type: 'btn', label: '擲 100 次', run: s => roll(s, 100) }],
  view: s => { const mx = Math.max(1, ...s.c); let g = '';
    for (let i = 0; i < 6; i++) { const h = s.c[i] / mx * 100; g += rc(18 + i * 40, 122 - h, 28, h, 'fillA') + T(32 + i * 40, 114 - h, s.c[i], 'class="tk"') + T(32 + i * 40, 138, '⚀⚁⚂⚃⚄⚅'[i], 'font-size="20"'); }
    return svg(260, 152, g); },
  read: s => [['總次數', s.n], ['偶數點比例', s.n ? R((s.c[1] + s.c[3] + s.c[5]) / s.n * 100, 1) + '%' : '—'], ['6 點比例', s.n ? R(s.c[5] / s.n * 100, 1) + '%' : '—']],
  missions: [
    M('先擲 10 次，看看每個點數各出現幾次', s => { s.c = [0, 0, 0, 0, 0, 0]; s.n = 0; }, s => s.n >= 10, '只擲幾次時，每個點數出現的次數差很多，看不出規律。', s => { s.n = 10; s.c = [2, 1, 2, 2, 1, 2]; }),
    M('擲到 200 次以上，觀察「偶數點比例」', s => {}, s => s.n >= 200, s => `現在偶數點比例是 ${R((s.c[1] + s.c[3] + s.c[5]) / s.n * 100, 1)}%，很接近 **50%**。偶數點有 2、4、6 三種，機率 = 3/6 = **1/2**。`, s => { s.n = 200; s.c = [33, 34, 33, 33, 34, 33]; }, '用「擲 100 次」比較快。'),
    M('擲到 600 次以上，觀察「6 點比例」', s => {}, s => s.n >= 600, s => `6 點比例是 ${R(s.c[5] / s.n * 100, 1)}%，接近 **1/6（約 16.7%）**。次數越多，越接近理論上的機率。`, s => { s.n = 600; s.c = [100, 100, 100, 100, 100, 100]; })
  ]
};

/* ======================= 理化 ======================= */
L.pc8a1 = {
  name: '浮沉水槽', intro: '把方塊丟進水裡會浮還是沉？關鍵是**密度 = 質量 ÷ 體積**。水的密度是 1 g/cm³。',
  init: () => ({ m: 50, v: 50 }),
  ctrl: [{ k: 'm', label: '質量', min: 10, max: 200, step: 10, unit: ' g' }, { k: 'v', label: '體積', min: 10, max: 200, step: 10, unit: ' cm³' }],
  view: s => { const d = s.m / s.v, sd = 22 + s.v * 0.24, y = d < 1 ? 80 - sd * (1 - d) : d === 1 ? 135 - sd / 2 : 190 - sd;
    return svg(240, 200, rc(20, 80, 200, 110, 'water') + rc(120 - sd / 2, y, sd, sd, 'block') + T(120, y + sd / 2, R(d), 'class="tk"') + '<line x1="20" y1="80" x2="220" y2="80" class="ln2"/>'); },
  read: s => { const d = s.m / s.v; return [['密度', `${s.m} ÷ ${s.v} = ${R(d)} g/cm³`], ['結果', d < 1 ? '比水輕 → 浮起來' : d === 1 ? '和水一樣 → 懸浮' : '比水重 → 沉下去']]; },
  missions: [
    M('做一個質量 60 g、體積 20 cm³ 的方塊', s => { s.m = 50; s.v = 50; }, s => s.m === 60 && s.v === 20, '密度 = 60 ÷ 20 = **3 g/cm³**，比水大，所以沉下去。', s => { s.m = 60; s.v = 20; }),
    M('想辦法讓方塊浮起來', s => { s.m = 100; s.v = 50; }, s => s.m / s.v < 1, '只要**密度小於 1**（比水輕）就會浮。可以減少質量，或把體積變大。', s => { s.m = 40; s.v = 50; }, '讓質量比體積的數字小。'),
    M('做出密度剛好是 1 的方塊，讓它停在水中', s => { s.m = 100; s.v = 50; }, s => s.m === s.v, '質量和體積的數字相同，密度就是 1，和水一樣。', s => { s.m = 50; s.v = 50; })
  ]
};

L.pc8a2 = {
  name: '聲波製造機', intro: '聲音是一種波。調整**頻率**和**振幅**，再按「聽聽看」，用耳朵感受聲音的變化！',
  init: () => ({ f: 3, a: 3 }),
  ctrl: [{ k: 'f', label: '頻率', min: 1, max: 8 }, { k: 'a', label: '振幅', min: 1, max: 5 }, { type: 'btn', label: '▶ 聽聽看', run: s => { if (G.jhTone) G.jhTone(150 + s.f * 90, 0.5, s.a * 0.03); } }],
  view: s => { let d = ''; for (let x = 0; x <= 300; x += 3) d += `${x},${75 - s.a * 12 * Math.sin(2 * Math.PI * s.f * x / 300)} `; return svg(300, 150, '<line x1="0" y1="75" x2="300" y2="75" class="gl"/>' + `<polyline points="${d}" class="ln" fill="none"/>`); },
  read: s => [['頻率 → 音調', s.f >= 6 ? '高音' : s.f <= 2 ? '低音' : '中音'], ['振幅 → 響度', s.a >= 4 ? '大聲' : s.a <= 2 ? '小聲' : '普通']],
  missions: [
    M('做出高音（頻率調到 6 以上），按「聽聽看」', s => { s.f = 3; s.a = 3; }, s => s.f >= 6, '波變得很密，聲音變尖。**頻率越高，音調越高**。', s => { s.f = 7; }),
    M('讓聲音變到最大聲', s => { s.a = 3; }, s => s.a === 5, '波變高了。**振幅越大，響度越大**。', s => { s.a = 5; }),
    M('做出又低又小聲的聲音（頻率 2 以下、振幅 2 以下）', s => { s.f = 5; s.a = 4; }, s => s.f <= 2 && s.a <= 2, '頻率決定音調高低、振幅決定大小聲，兩件事互不影響。', s => { s.f = 1; s.a = 1; })
  ]
};

const PHC = ['#d32f2f', '#e53935', '#f4511e', '#fb8c00', '#fdd835', '#c0ca33', '#7cb342', '#43a047', '#26a69a', '#1e88e5', '#3949ab', '#5e35b1', '#6a1b9a', '#4a148c', '#311b92'];
L.pc8b1 = {
  name: '酸鹼調色燒杯', intro: '燒杯裡加了指示劑，顏色會隨 pH 值改變。試著加酸、加鹼，把溶液調成指定的 pH！',
  init: () => ({ ph: 2 }),
  ctrl: [{ type: 'btn', label: '🧴 加鹼（pH +1）', run: s => { s.ph = Math.min(14, s.ph + 1); } }, { type: 'btn', label: '🍋 加酸（pH −1）', run: s => { s.ph = Math.max(0, s.ph - 1); } }],
  view: s => { let g = `<path d="M70 20 V60 L40 150 Q38 160 50 160 H170 Q182 160 180 150 L150 60 V20" class="glass"/><path d="M62 90 L44 148 Q43 154 50 154 H170 Q177 154 176 148 L158 90 Z" fill="${PHC[s.ph]}"/>`;
    for (let i = 0; i < 15; i++) g += `<rect x="${8 + i * 14}" y="176" width="14" height="12" fill="${PHC[i]}"/>`;
    return svg(226, 200, g + T(15 + s.ph * 14, 170, '▼') + T(110, 125, 'pH ' + s.ph, 'font-size="18"')); },
  read: s => [['pH 值', s.ph], ['性質', s.ph < 7 ? '酸性' : s.ph > 7 ? '鹼性' : '中性']],
  missions: [
    M('這杯是檸檬汁（pH 2）。把它中和到剛好中性', s => { s.ph = 2; }, s => s.ph === 7, '**pH = 7 是中性**。酸加鹼會互相抵消，叫做**酸鹼中和**。', s => { s.ph = 7; }, '中性是 pH 7。'),
    M('繼續加鹼，做出 pH 10 的肥皂水', s => { s.ph = 7; }, s => s.ph === 10, '**pH 大於 7 是鹼性**，數字越大鹼性越強。', s => { s.ph = 10; }),
    M('這杯是強鹼（pH 12）！把它變成 pH 5 的弱酸', s => { s.ph = 12; }, s => s.ph === 5, '**pH 小於 7 是酸性**，數字越小酸性越強。', s => { s.ph = 5; })
  ]
};

const rate = s => (1 + (s.t - 10) / 20) * s.c * (s.p ? 2 : 1) * (s.k ? 2 : 1);
L.pc8b2 = {
  name: '反應加速器', intro: '同一個化學反應，有時很慢、有時很快。調整四個條件，看看反應完成要花多久！',
  init: () => ({ t: 10, c: 1, p: false, k: false }),
  ctrl: [{ k: 't', label: '溫度', min: 10, max: 80, step: 10, unit: '°C' }, { k: 'c', label: '濃度', min: 1, max: 5 }, { type: 'toggle', k: 'p', label: '把塊狀磨成粉末' }, { type: 'toggle', k: 'k', label: '加入催化劑' }],
  view: s => { const r = rate(s), tm = 120 / r; return `<div class="emo big">⚗️ ${rep('🫧', Math.min(14, Math.ceil(r)))}</div><div class="meter"><i style="width:${Math.min(100, tm / 120 * 100)}%"></i></div>`; },
  read: s => [['反應完成時間', R(120 / rate(s), 1) + ' 秒']],
  missions: [
    M('讓反應在 10 秒內完成', s => { s.t = 10; s.c = 1; s.p = false; s.k = false; }, s => 120 / rate(s) <= 10, '**溫度越高、濃度越大、顆粒越小（接觸面積越大）、加催化劑**，反應都會變快。', s => { s.t = 80; s.c = 5; }, '把溫度和濃度都調高。'),
    M('不加熱（溫度 20°C 以下），也要在 20 秒內完成', s => { s.t = 10; s.c = 1; s.p = false; s.k = false; }, s => s.t <= 20 && 120 / rate(s) <= 20, '不加熱也能加速：磨成粉、加催化劑、提高濃度都有效。', s => { s.t = 20; s.c = 1; s.p = true; s.k = true; }, '試試粉末和催化劑。'),
    M('回到最慢的狀態，只打開「磨成粉末」，看看快了多少', s => { s.t = 30; s.c = 2; s.p = false; s.k = false; }, s => s.t === 10 && s.c === 1 && s.p && !s.k, '同樣的東西磨成粉，**接觸面積變大**，反應就變快。', s => { s.t = 10; s.c = 1; s.p = true; s.k = false; }, '溫度 10、濃度 1、只開粉末。')
  ]
};

L.pc9a1 = {
  name: '火箭推進測試場', intro: '用力推一台車，它會越跑越快。**加速度 a = 力 F ÷ 質量 m**，速度 **v = a × t**。',
  init: () => ({ F: 4, m: 4, t: 1 }),
  ctrl: [{ k: 'F', label: '推力 F', min: 0, max: 20, unit: ' N' }, { k: 'm', label: '質量 m', min: 1, max: 10, unit: ' kg' }, { k: 't', label: '時間 t', min: 1, max: 10, unit: ' s' }],
  view: s => { const a = s.F / s.m, x = Math.min(270, 14 + a * s.t * s.t * 0.9); return svg(300, 70, '<line x1="6" y1="52" x2="294" y2="52" class="ax"/>' + T(x, 36, '🚗', 'font-size="24"') + (a * s.t > 0 ? T(Math.max(8, x - 22), 36, '💨', 'font-size="14"') : '')); },
  read: s => [['加速度 a', `${s.F} ÷ ${s.m} = ${R(s.F / s.m)} m/s²`], ['速度 v', `${R(s.F / s.m)} × ${s.t} = ${R(s.F / s.m * s.t)} m/s`]],
  missions: [
    M('質量 2 kg 的車，用 10 N 的力推，加速度是多少？', s => { s.F = 4; s.m = 4; s.t = 1; }, s => s.F === 10 && s.m === 2, 'a = 10 ÷ 2 = **5 m/s²**。這就是牛頓第二運動定律 **F = ma**。', s => { s.F = 10; s.m = 2; }),
    M('讓加速度剛好是 2 m/s²', s => { s.F = 4; s.m = 4; }, s => s.F / s.m === 2, '力變大或質量變小，加速度都會變大。', s => { s.F = 8; s.m = 4; }, '力要是質量的 2 倍。'),
    M('保持加速度 2 m/s²，讓車速達到 10 m/s', s => { s.t = 1; }, s => s.F / s.m === 2 && s.t === 5, 'v = a × t = 2 × 5 = **10 m/s**。', s => { s.F = 8; s.m = 4; s.t = 5; }, '10 ÷ 2 = 幾秒？')
  ]
};

L.pc9a2 = {
  name: '燈泡電路板', intro: '兩個燈泡有兩種接法。**點燈泡**可以把它拆下來或裝回去，看看另一個燈泡還亮不亮！',
  init: () => ({ mode: 's', b1: true, b2: true }),
  ctrl: [{ type: 'choice', k: 'mode', label: '接法', opts: [['s', '串聯'], ['p', '並聯']] }],
  view: s => { const on1 = s.mode === 's' ? s.b1 && s.b2 : s.b1, on2 = s.mode === 's' ? s.b1 && s.b2 : s.b2;
    const bulb = (id, x, y, ok, lit) => `<g data-tap="${id}" class="tapz"><circle cx="${x}" cy="${y}" r="22" class="hit"/><circle cx="${x}" cy="${y}" r="15" class="${!ok ? 'boff' : lit ? (s.mode === 's' ? 'bdim' : 'bon') : 'bdark'}"/>${T(x, y, ok ? '💡' : '✕', 'font-size="14" pointer-events="none"')}</g>`;
    const g = s.mode === 's' ? '<polyline points="30,70 30,25 230,25 230,145 30,145 30,100" class="wire"/>' + bulb('b1', 100, 25, s.b1, on1) + bulb('b2', 170, 25, s.b2, on2)
      : '<polyline points="30,70 30,25 220,25 220,145 30,145 30,100" class="wire"/><line x1="130" y1="25" x2="130" y2="145" class="wire"/>' + bulb('b1', 130, 85, s.b1, on1) + bulb('b2', 220, 85, s.b2, on2);
    return svg(260, 170, g + T(30, 85, '🔋', 'font-size="22"')); },
  read: s => { const n = (s.mode === 's' ? (s.b1 && s.b2 ? 2 : 0) : (s.b1 ? 1 : 0) + (s.b2 ? 1 : 0)); return [['接法', s.mode === 's' ? '串聯（只有一條路）' : '並聯（有兩條路）'], ['亮著的燈泡', n + ' 個']]; },
  tap: (s, id) => { s[id] = !s[id]; },
  missions: [
    M('在「串聯」電路裡拆掉一個燈泡，看看另一個', s => { s.mode = 's'; s.b1 = true; s.b2 = true; }, s => s.mode === 's' && s.b1 !== s.b2, '全滅了！串聯**只有一條通路**，一處斷路，整個電路都不通。', s => { s.b1 = false; }, '直接點其中一個燈泡。'),
    M('切到「並聯」，一樣只拆掉一個燈泡', s => { s.b1 = true; s.b2 = true; }, s => s.mode === 'p' && s.b1 !== s.b2, '另一個還亮著！並聯**每個燈泡有自己的路**，互不影響。家裡的電器就是並聯。', s => { s.mode = 'p'; s.b1 = false; }, '先按「並聯」，再點一個燈泡。'),
    M('把燈泡都裝回去，選出燈泡比較亮的接法', s => { s.mode = 's'; s.b1 = true; s.b2 = false; }, s => s.mode === 'p' && s.b1 && s.b2, '並聯時每個燈泡都得到完整的電壓，所以比串聯亮。', s => { s.mode = 'p'; s.b1 = true; s.b2 = true; })
  ]
};

L.pc9b1 = {
  name: '電費計算機', intro: '電器越「吃電」，功率 P 越大。**電流 I = P ÷ V**（臺灣的電壓是 110 V），**1 度電 = 1000 W 用 1 小時**。',
  init: () => ({ P: 100, h: 1 }),
  ctrl: [{ k: 'P', label: '電器功率', min: 100, max: 1500, step: 50, unit: ' W' }, { k: 'h', label: '使用時間', min: 1, max: 10, unit: ' 小時' }],
  view: s => `<div class="emo big">${s.P >= 1000 ? '🔥' : s.P >= 500 ? '🍚' : '💡'} <span class="mnote">${s.P >= 1000 ? '電暖器等級' : s.P >= 500 ? '電鍋等級' : '燈泡、電扇等級'}</span></div><div class="meter"><i style="width:${Math.min(100, s.P * s.h / 150)}%"></i></div>`,
  read: s => [['電流', `${s.P} ÷ 110 = ${R(s.P / 110, 1)} A`], ['用電量', `${s.P} W × ${s.h} 小時 = ${R(s.P * s.h / 1000)} 度`]],
  missions: [
    M('把電器調成 550 W，電流是多少？', s => { s.P = 100; s.h = 1; }, s => s.P === 550, 'I = P ÷ V = 550 ÷ 110 = **5 A**。', s => { s.P = 550; }),
    M('用 1000 W 的電器 1 小時，會用掉幾度電？', s => { s.P = 100; s.h = 3; }, s => s.P === 1000 && s.h === 1, '剛好 **1 度**。1 度電 = 1 千瓦小時（kW·h）。', s => { s.P = 1000; s.h = 1; }),
    M('讓用電量剛好是 5 度', s => { s.P = 100; s.h = 1; }, s => s.P * s.h === 5000, '功率越大、用越久，用電量就越多。', s => { s.P = 1000; s.h = 5; }, '例如 1000 W 用 5 小時。')
  ]
};

const clips = s => Math.floor(s.n * s.i * (s.core ? 3 : 1) / 10);
L.pc9b2 = {
  name: '電磁鐵起重機', intro: '把導線繞成線圈再通電，它就會變成磁鐵！調整條件，看能吸起幾個迴紋針。',
  init: () => ({ n: 10, i: 0, core: false }),
  ctrl: [{ k: 'n', label: '線圈匝數', min: 5, max: 50, step: 5 }, { k: 'i', label: '電流', min: 0, max: 5, unit: ' A' }, { type: 'toggle', k: 'core', label: '放入軟鐵棒' }],
  view: s => `<div class="emo big">🔋➰${s.core ? '🔩' : '　'}➰🧲</div><div class="emo">${rep('📎', clips(s)) || '（沒有吸到東西）'}</div>`,
  read: s => [['吸起的迴紋針', clips(s) + ' 個']],
  missions: [
    M('通上電流，讓它吸起迴紋針', s => { s.n = 10; s.i = 0; s.core = false; }, s => clips(s) > 0, '有電流就有磁性！這叫**電流的磁效應**，是厄斯特發現的。', s => { s.i = 2; }),
    M('把電流關掉，迴紋針會怎樣？', s => { s.i = 2; }, s => s.i === 0, '全部掉下來。電磁鐵**通電才有磁性**，斷電就消失，所以能用來吊運廢鐵。', s => { s.i = 0; }),
    M('想辦法吸起 30 個以上', s => { s.n = 10; s.i = 1; s.core = false; }, s => clips(s) >= 30, '**匝數越多、電流越大、放入軟鐵棒**，磁力就越強。', s => { s.n = 50; s.i = 5; s.core = true; }, '三個條件都加強。')
  ]
};

/* ======================= 生物 ======================= */
const CELL = { wall: ['細胞壁', '在最外層，支持和保護細胞。只有植物細胞才有。'], mem: ['細胞膜', '控制物質進出細胞，動植物細胞都有。'], nuc: ['細胞核', '裡面有遺傳物質，是細胞的指揮中心。'], mit: ['粒線體', '進行呼吸作用、產生能量，是細胞的發電廠。'], chl: ['葉綠體', '進行光合作用。只有植物的綠色部位才有。'], vac: ['液胞', '儲存水分和養分。植物細胞的液胞特別大。'] };
L.bi7a1 = {
  name: '細胞顯微鏡', intro: '你正透過顯微鏡看一個細胞。**點一點細胞裡的每個構造**，看看它們是做什麼的！',
  init: () => ({ mode: 'p', found: {}, last: '' }),
  ctrl: [{ type: 'choice', k: 'mode', label: '觀察', opts: [['p', '植物細胞'], ['a', '動物細胞']] }],
  view: s => { const f = id => s.found[s.mode + id] ? ' fd' : '', e = (id, cx, cy, rx, ry, c) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" class="${c}${f(id)}" data-tap="${id}"/>`;
    return svg(260, 190, s.mode === 'p'
      ? `<rect x="20" y="15" width="220" height="160" rx="12" class="cwall${f('wall')}" data-tap="wall"/><rect x="31" y="26" width="198" height="138" rx="8" class="cmem${f('mem')}" data-tap="mem"/><rect x="98" y="46" width="118" height="98" rx="20" class="cvac${f('vac')}" data-tap="vac"/>` + e('nuc', 62, 76, 20, 20, 'cnuc') + e('mit', 66, 142, 14, 8, 'cmit') + e('mit', 150, 154, 13, 7, 'cmit') + e('chl', 72, 40, 12, 7, 'cchl') + e('chl', 48, 108, 8, 13, 'cchl') + e('chl', 206, 154, 12, 7, 'cchl')
      : `<ellipse cx="130" cy="95" rx="106" ry="80" class="cmem2${f('mem')}" data-tap="mem"/>` + e('nuc', 122, 92, 26, 24, 'cnuc') + e('mit', 66, 74, 14, 8, 'cmit') + e('mit', 184, 124, 14, 8, 'cmit') + e('mit', 176, 58, 13, 7, 'cmit')); },
  read: s => [[s.last ? CELL[s.last][0] : '提示', s.last ? CELL[s.last][1] : '點細胞裡的構造看看'], ['這個細胞已發現', ['wall', 'mem', 'nuc', 'mit', 'chl', 'vac'].filter(k => s.found[s.mode + k]).length + ' 種']],
  tap: (s, id) => { s.last = id; s.found[s.mode + id] = 1; },
  missions: [
    M('把植物細胞的 6 種構造全部點出來', s => { s.mode = 'p'; s.found = {}; s.last = ''; }, s => ['wall', 'mem', 'nuc', 'mit', 'chl', 'vac'].every(k => s.found['p' + k]), '植物細胞有：細胞壁、細胞膜、細胞核、粒線體、葉綠體、液胞。', s => { ['wall', 'mem', 'nuc', 'mit', 'chl', 'vac'].forEach(k => s.found['p' + k] = 1); }, '最外面那一圈粗粗的綠色也可以點。'),
    M('切換成動物細胞，看看少了什麼', s => {}, s => s.mode === 'a', '動物細胞**沒有細胞壁和葉綠體**，也沒有大型液胞。', s => { s.mode = 'a'; }),
    M('回到植物細胞，點出負責「光合作用」的構造', s => { s.last = ''; }, s => s.mode === 'p' && s.last === 'chl', '**葉綠體**利用光能製造養分。', s => { s.mode = 'p'; s.last = 'chl'; }, '綠色的小顆粒。'),
    M('再點出負責「呼吸作用、產生能量」的構造', s => { s.last = ''; }, s => s.last === 'mit', '**粒線體**是細胞的發電廠，動植物細胞都有。', s => { s.last = 'mit'; }, '橘色的小顆粒。')
  ]
};

L.bi7a2 = {
  name: '光合作用工廠', intro: '植物的葉子是一座小工廠。打開正確的開關，讓它開始製造養分！',
  init: () => ({ light: false, co2: false, water: false }),
  ctrl: [{ type: 'toggle', k: 'light', label: '☀️ 陽光' }, { type: 'toggle', k: 'co2', label: '💨 二氧化碳' }, { type: 'toggle', k: 'water', label: '💧 水' }],
  view: s => { const ok = s.light && s.co2 && s.water; return `<div class="emo big">${s.light ? '☀️' : '🌑'} ${s.co2 ? '💨' : '　'} 🌿 ${s.water ? '💧' : '　'}</div><div class="emo">${ok ? '🍬 葡萄糖　🫧🫧 氧氣' : '😴 工廠停工中…'}</div>`; },
  read: s => { const miss = [!s.light && '陽光', !s.co2 && '二氧化碳', !s.water && '水'].filter(Boolean); return [['狀態', miss.length ? '缺少：' + miss.join('、') : '光合作用進行中！']]; },
  missions: [
    M('讓植物開始進行光合作用', s => { s.light = false; s.co2 = false; s.water = false; }, s => s.light && s.co2 && s.water, '**二氧化碳 + 水 →（光）→ 葡萄糖 + 氧氣**。三樣缺一不可。', s => { s.light = true; s.co2 = true; s.water = true; }),
    M('把陽光關掉，看看會怎樣', s => { s.light = true; s.co2 = true; s.water = true; }, s => !s.light && s.co2 && s.water, '沒有光就沒有能量，工廠停工。所以植物晚上不行光合作用。', s => { s.light = false; }),
    M('陽光充足，但是把水關掉', s => { s.light = true; s.co2 = true; s.water = true; }, s => s.light && s.co2 && !s.water, '水和二氧化碳是**原料**，少了原料也做不出葡萄糖。', s => { s.water = false; })
  ]
};

const kids = s => [s.f[0] + s.m[0], s.f[0] + s.m[1], s.f[1] + s.m[0], s.f[1] + s.m[1]].map(g => g[0] > g[1] ? g[1] + g[0] : g);
const rec = s => kids(s).filter(g => g === 'aa').length;
L.bi7b1 = {
  name: '遺傳方格機', intro: '**A** 是顯性基因（紫花），**a** 是隱性基因（白花）。只要有一個 A 就開紫花。選爸爸媽媽的基因，看看孩子會怎樣！',
  init: () => ({ f: 'AA', m: 'AA' }),
  ctrl: [{ type: 'choice', k: 'f', label: '爸爸', opts: [['AA', 'AA'], ['Aa', 'Aa'], ['aa', 'aa']] }, { type: 'choice', k: 'm', label: '媽媽', opts: [['AA', 'AA'], ['Aa', 'Aa'], ['aa', 'aa']] }],
  view: s => { const k = kids(s), c = g => `<td class="${g === 'aa' ? 'r' : 'd'}">${g === 'aa' ? '⚪' : '🟣'}<br>${g}</td>`;
    return `<table class="pun"><tr><th></th><th>${s.m[0]}</th><th>${s.m[1]}</th></tr><tr><th>${s.f[0]}</th>${c(k[0])}${c(k[1])}</tr><tr><th>${s.f[1]}</th>${c(k[2])}${c(k[3])}</tr></table>`; },
  read: s => [['顯性（紫）：隱性（白）', `${4 - rec(s)} : ${rec(s)}`], ['孩子開白花的機率', rec(s) + '/4']],
  missions: [
    M('讓爸爸和媽媽都是 Aa', s => { s.f = 'AA'; s.m = 'AA'; }, s => s.f === 'Aa' && s.m === 'Aa', '爸媽都開紫花，孩子卻有 **1/4** 的機率開白花！AA : Aa : aa = 1 : 2 : 1。', s => { s.f = 'Aa'; s.m = 'Aa'; }),
    M('找出讓孩子「全部開白花」的組合', s => { s.f = 'AA'; s.m = 'AA'; }, s => rec(s) === 4, '只有 **aa × aa**。隱性性狀要兩個隱性基因湊在一起才會表現。', s => { s.f = 'aa'; s.m = 'aa'; }, '白花是 aa。'),
    M('找出紫花和白花「一半一半」的組合', s => { s.f = 'AA'; s.m = 'AA'; }, s => rec(s) === 2, '**Aa × aa**，孩子顯性：隱性 = 1 : 1。', s => { s.f = 'Aa'; s.m = 'aa'; }, '其中一方是 aa。')
  ]
};

const ECO = { '': [0, 0, 0, 0], grass: [-2, -1, -1, -1], hopper: [1, -2, -1, -1], frog: [-1, 1, -2, -1], snake: [1, -1, 1, -2] };
L.bi7b2 = {
  name: '生態平衡模擬器', intro: '草原上有一條食物鏈：草 → 蚱蜢 → 青蛙 → 蛇。如果其中一種生物消失了，其他生物會怎樣？',
  init: () => ({ rm: '' }),
  ctrl: [{ type: 'choice', k: 'rm', label: '移走', opts: [['', '都不移走'], ['grass', '草'], ['hopper', '蚱蜢'], ['frog', '青蛙'], ['snake', '蛇']] }],
  view: s => { const e = ['🌿', '🦗', '🐸', '🐍'], n = ['草', '蚱蜢', '青蛙', '蛇'], d = ECO[s.rm];
    return '<div class="eco">' + e.map((x, i) => `<div class="ec ${d[i] === -2 ? 'gone' : ''}"><div class="emo">${d[i] === -2 ? '🚫' : rep(x, d[i] > 0 ? 5 : d[i] < 0 ? 1 : 3)}</div><b>${n[i]}</b><small>${d[i] === -2 ? '被移走' : d[i] > 0 ? '⬆ 變多' : d[i] < 0 ? '⬇ 變少' : '穩定'}</small></div>`).join('<span class="ea">→</span>') + '</div>'; },
  missions: [
    M('把青蛙移走，蚱蜢會變多還是變少？', s => { s.rm = ''; }, s => s.rm === 'frog', '沒有青蛙吃蚱蜢，**蚱蜢變多**，結果草被吃光；蛇沒有食物也變少。', s => { s.rm = 'frog'; }),
    M('把最上層的蛇移走', s => { s.rm = ''; }, s => s.rm === 'snake', '青蛙變多 → 蚱蜢變少 → 草變多。一種生物的改變會沿著食物鏈傳下去。', s => { s.rm = 'snake'; }),
    M('把草移走', s => { s.rm = ''; }, s => s.rm === 'grass', '全部變少！**生產者**是整條食物鏈的基礎。', s => { s.rm = 'grass'; })
  ]
};

/* ======================= 地球科學 ======================= */
L.es9a1 = {
  name: '板塊推推樂', intro: '地球表面是由好幾塊「板塊」拼起來的，它們會慢慢移動。選一種移動方式，看看邊界會出現什麼！',
  init: () => ({ t: '' }),
  ctrl: [{ type: 'choice', k: 't', label: '兩個板塊', opts: [['con', '互相擠壓'], ['div', '互相分開'], ['tra', '擦身錯開']] }],
  view: s => { const dx = s.t === 'con' ? 14 : s.t === 'div' ? -16 : 0, dy = s.t === 'tra' ? 14 : 0;
    return svg(260, 130, rc(24 + dx, 62 - dy, 100, 40, 'plateA') + rc(136 - dx, 62 + dy, 100, 40, 'plateB') + T(130, 34, s.t === 'con' ? '🏔️' : s.t === 'div' ? '🌋' : s.t === 'tra' ? '⚡' : '❔', 'font-size="28"') + T(74 + dx, 82 - dy, s.t === 'con' ? '→' : s.t === 'div' ? '←' : s.t === 'tra' ? '↑' : '', 'font-size="18"') + T(186 - dx, 82 + dy, s.t === 'con' ? '←' : s.t === 'div' ? '→' : s.t === 'tra' ? '↓' : '', 'font-size="18"')); },
  read: s => [['邊界類型', s.t === 'con' ? '聚合性板塊邊界' : s.t === 'div' ? '張裂性板塊邊界' : s.t === 'tra' ? '錯動性板塊邊界' : '（請選擇）'], ['會出現', s.t === 'con' ? '高山、海溝，地震多' : s.t === 'div' ? '中洋脊，新的海洋地殼在這裡生成' : s.t === 'tra' ? '大斷層，地震多' : '—']],
  missions: [
    M('做出像臺灣這樣被「擠」出來的高山', s => { s.t = ''; }, s => s.t === 'con', '臺灣在**歐亞板塊**和**菲律賓海板塊**的聚合邊界，山脈被擠得越來越高，地震也很多。', s => { s.t = 'con'; }),
    M('做出海底的「中洋脊」', s => { s.t = ''; }, s => s.t === 'div', '板塊分開時岩漿湧出，形成中洋脊，這是**張裂性**邊界。', s => { s.t = 'div'; }),
    M('讓兩個板塊擦身而過', s => { s.t = ''; }, s => s.t === 'tra', '這是**錯動性**邊界，會形成大斷層並引發地震。', s => { s.t = 'tra'; })
  ]
};

const MPH = d => d === 1 || d === 30 ? '新月（朔）' : d <= 6 ? '眉月' : d <= 9 ? '上弦月' : d <= 13 ? '盈凸月' : d <= 16 ? '滿月（望）' : d <= 21 ? '虧凸月' : d <= 24 ? '下弦月' : '殘月';
L.es9a2 = {
  name: '月相軌道儀', intro: '太陽在左邊照過來。月球繞著地球轉，我們從地球看到的亮面就會改變。拉動日期看看！',
  init: () => ({ d: 1 }),
  ctrl: [{ k: 'd', label: '農曆日期', min: 1, max: 30 }],
  view: s => { const th = (s.d - 1) / 29.5 * 2 * Math.PI, cx = 108, cy = 85, mx = cx - 54 * Math.cos(th), my = cy + 54 * Math.sin(th), c = Math.cos(th), wax = th <= Math.PI, r = 30;
    const lit = `M0 ${-r} A${r} ${r} 0 0 ${wax ? 1 : 0} 0 ${r} A${Math.abs(c) * r} ${r} 0 0 ${wax ? (c > 0 ? 0 : 1) : (c > 0 ? 1 : 0)} 0 ${-r}Z`;
    return svg(310, 170, T(20, 85, '☀️', 'font-size="26"') + `<circle cx="${cx}" cy="${cy}" r="54" class="orbit"/>` + T(cx, cy, '🌍', 'font-size="24"') + `<circle cx="${mx}" cy="${my}" r="8" class="mlit"/><g transform="translate(252 78)"><circle r="${r}" class="mdark"/><path d="${lit}" class="mlit"/></g>` + T(252, 126, '從地球看到的月亮', 'class="tk"')); },
  read: s => [['農曆', s.d + ' 日'], ['月相', MPH(s.d)]],
  missions: [
    M('找出「滿月」的日子', s => { s.d = 1; }, s => s.d === 15 || s.d === 16, '農曆**十五、十六**，地球在太陽和月球中間，我們看到整個亮面。月食只會發生在這時候。', s => { s.d = 15; }),
    M('找出「上弦月」的日子（右半邊亮）', s => { s.d = 1; }, s => s.d >= 7 && s.d <= 9, '農曆**初七、初八**是上弦月；廿二、廿三則是下弦月（左半邊亮）。', s => { s.d = 8; }),
    M('日食發生時，月球會擋在太陽和地球中間。把月球移到那個位置', s => { s.d = 12; }, s => s.d === 1 || s.d === 30, '這時是農曆**初一**（新月），所以日食只會發生在初一前後。', s => { s.d = 1; })
  ]
};

const LAY = h => h <= 12 ? ['對流層', '雲、雨、雷電等天氣現象都在這裡；越高越冷'] : h <= 50 ? ['平流層', '臭氧層在這一層，能吸收紫外線；氣流平穩，適合飛機飛行'] : h <= 85 ? ['中氣層', '越高越冷，流星多半在這裡燃燒'] : ['增溫層', '空氣非常稀薄，溫度隨高度上升；極光出現在這裡'];
L.es9b1 = {
  name: '探空氣球', intro: '放一顆氣球往上飛，穿過大氣的每一層。拉高度看看每一層有什麼！',
  init: () => ({ h: 2 }),
  ctrl: [{ k: 'h', label: '高度', min: 0, max: 120, step: 2, unit: ' 公里' }],
  view: s => { const y = h => 250 - h * 2; return svg(220, 260, rc(0, y(12), 220, y(0) - y(12), 'la1') + rc(0, y(50), 220, y(12) - y(50), 'la2') + rc(0, y(85), 220, y(50) - y(85), 'la3') + rc(0, y(120), 220, y(85) - y(120), 'la4') + T(48, 240, '☁️🌧️', 'font-size="14"') + T(48, 190, '✈️ 臭氧層', 'class="tk"') + T(48, 116, '☄️ 流星', 'class="tk"') + T(48, 44, '🌌 極光', 'class="tk"') + T(160, y(s.h) - 6, '🎈', 'font-size="24"')); },
  read: s => { const l = LAY(s.h); return [['高度', s.h + ' 公里'], [l[0], l[1]]]; },
  missions: [
    M('把氣球升到「臭氧層」所在的那一層', s => { s.h = 2; }, s => s.h > 12 && s.h <= 50, '**平流層**裡有臭氧層，幫我們擋掉大部分的紫外線。', s => { s.h = 30; }),
    M('繼續升到流星燃燒的那一層', s => {}, s => s.h > 50 && s.h <= 85, '這裡是**中氣層**。再往上就是增溫層。', s => { s.h = 70; }),
    M('回到會颳風下雨的那一層', s => {}, s => s.h <= 12, '**對流層**最靠近地面，水氣最多，所有天氣現象都在這裡。', s => { s.h = 4; })
  ]
};

L.es9b2 = {
  name: '地球體溫計', intro: '二氧化碳像地球的棉被，蓋太厚地球就會發燒。調整大氣裡的二氧化碳濃度，看看地球的變化（數值為示意）。',
  init: () => ({ c: 280 }),
  ctrl: [{ k: 'c', label: '二氧化碳濃度', min: 280, max: 800, step: 10, unit: ' ppm' }],
  view: s => { const dt = (s.c - 280) / 100 * 0.7, ice = Math.max(0, 6 - Math.floor(dt / 0.6)); return `<div class="emo big">🌡️ ${dt < 0.5 ? '🙂' : dt < 1.5 ? '😓' : dt < 2.5 ? '🥵' : '🔥'}</div><div class="emo">${rep('🧊', ice) || '（冰都融化了）'}</div><div class="emo">${rep('🌊', 2 + Math.floor(dt * 2))}</div>`; },
  read: s => [['升溫（示意）', '+' + R((s.c - 280) / 100 * 0.7, 1) + '°C'], ['說明', s.c <= 300 ? '工業革命前的水準' : s.c < 500 ? '冰川開始融化、海平面上升' : '極端氣候變多，冰層大量消失']],
  missions: [
    M('調到近年的濃度（大約 420 ppm）', s => { s.c = 280; }, s => s.c >= 410 && s.c <= 430, '工業革命後人類大量燃燒化石燃料，二氧化碳從約 280 增加到 420 以上，**溫室效應增強**，造成全球暖化。', s => { s.c = 420; }),
    M('如果繼續排放到 700 ppm 以上，會怎樣？', s => {}, s => s.c >= 700, '冰層融化、海平面上升、極端氣候更頻繁。', s => { s.c = 700; }),
    M('把濃度調回 280 ppm', s => {}, s => s.c === 280, '適度的溫室效應本來就存在，讓地球保持溫暖；問題在於人類讓它**變得太強**。', s => { s.c = 280; })
  ]
};

/* ======================= 臺灣地圖（地理、歷史共用） ======================= */
const TWP = 'M128,16 C140,18 152,26 152,34 C150,44 138,52 140,64 C142,76 148,74 146,86 C142,110 138,128 132,150 C126,178 118,200 110,222 C104,244 96,268 90,286 C86,290 82,286 80,276 C78,262 70,250 62,238 C52,224 44,210 42,192 C38,172 40,152 44,134 C48,112 58,96 68,80 C78,62 90,46 102,34 C110,24 118,16 128,16 Z';
const tw = inner => svg(200, 300, `<defs><clipPath id="twc"><path d="${TWP}"/></clipPath></defs><path d="${TWP}" class="land"/>${inner}`);
function mapLab(name, intro, pts, missions) {
  return { name, intro, init: () => ({ p: '' }),
    view: s => tw(pts.map(p => `<g data-tap="${p.id}" class="pin${s.p === p.id ? ' on' : ''}"><circle cx="${p.x}" cy="${p.y}" r="14" class="hit"/><circle cx="${p.x}" cy="${p.y}" r="6" class="dot"/>${T(p.x + (p.dx || 0), p.y + (p.dy === undefined ? -13 : p.dy), p.n, 'class="plb"')}</g>`).join('')),
    read: s => { const p = pts.find(q => q.id === s.p); return p ? [[p.n, p.f]] : [['提示', '點地圖上的圓點，看看那裡發生過什麼事']]; },
    tap: (s, id) => { s.p = id; },
    missions: missions.map(([t, ids, say]) => M(t, s => { s.p = ''; }, s => ids.includes(s.p), say, s => { s.p = ids[0]; }, '每個圓點都點點看，讀一下說明。')) };
}
L.hi7a1 = mapLab('時光挖掘地圖', '這是四百年前的臺灣。**點地圖上的圓點**，挖出藏在各地的歷史！', [
  { id: 'chang', x: 118, y: 196, n: '臺東長濱', dx: 30, dy: 2, f: '長濱文化：臺灣目前發現最早的舊石器時代文化，使用打製石器。' },
  { id: 'shisan', x: 108, y: 30, n: '新北八里', dx: -30, dy: 2, f: '十三行文化：已經會煉鐵，屬於金屬器時代。' },
  { id: 'yuan', x: 124, y: 44, n: '臺北圓山', dx: -4, dy: 16, f: '圓山文化：新石器時代，留下貝塚。' },
  { id: 'zeel', x: 46, y: 200, n: '臺南安平', dx: 34, dy: 2, f: '1624 年荷蘭人在這裡建熱蘭遮城，作為統治中心。1662 年被鄭成功攻下。' },
  { id: 'kee', x: 148, y: 28, n: '基隆', dx: 22, dy: 2, f: '舊稱雞籠。1626 年西班牙人占領這裡，後來被荷蘭人趕走。' }
], [
  ['荷蘭人蓋「熱蘭遮城」的地方在哪裡？', ['zeel'], '在今天的**臺南安平**。荷蘭人統治南臺灣 38 年。'],
  ['西班牙人占領的「雞籠」在哪裡？', ['kee'], '就是今天的**基隆**。西班牙占北部、荷蘭占南部。'],
  ['臺灣最早的舊石器時代文化在哪裡被發現？', ['chang'], '臺東的**長濱文化**。'],
  ['哪裡的史前居民已經會煉鐵？', ['shisan'], '新北八里的**十三行文化**。']
]);
L.hi7a2 = mapLab('清代港口巡航', '清代臺灣最熱鬧的地方都在港口。**點地圖上的圓點**，看看每個地方的故事！', [
  { id: 'fu', x: 46, y: 200, n: '臺南', dx: 24, dy: 2, f: '臺灣府城，清代前期的政治、經濟中心。俗諺中的「一府」。' },
  { id: 'lu', x: 50, y: 128, n: '鹿港', dx: 24, dy: 2, f: '中部最重要的港口，俗諺中的「二鹿」。' },
  { id: 'meng', x: 124, y: 44, n: '艋舺', dx: -4, dy: 16, f: '今天的臺北萬華，北部的商業中心，俗諺中的「三艋舺」。' },
  { id: 'tam', x: 108, y: 28, n: '淡水', dx: -24, dy: 2, f: '開港通商後，北部的茶和樟腦從這裡出口，經濟重心逐漸北移。' },
  { id: 'mu', x: 88, y: 268, n: '恆春半島', dx: 34, dy: 2, f: '1874 年牡丹社事件：日本出兵這裡，清廷才改為積極治理臺灣。' }
], [
  ['「一府、二鹿、三艋舺」的「一府」在哪裡？', ['fu'], '**臺南**府城。這句話說的是清代最繁榮的三個港口市鎮。'],
  ['「二鹿」在哪裡？', ['lu'], '彰化的**鹿港**。'],
  ['開港通商後，北部的茶葉主要從哪裡出口？', ['tam'], '**淡水**。茶、糖、樟腦是三大出口品，讓經濟重心往北移。'],
  ['1874 年讓清廷改採積極治臺的「牡丹社事件」發生在哪裡？', ['mu'], '在南部的**恆春半島**。事後清廷派沈葆楨來臺建設。']
]);
L.ge9b1 = mapLab('地名解碼地圖', '每個地名都藏著一段故事。**點地圖上的圓點**，解開地名的密碼！', [
  { id: 'xin', x: 50, y: 182, n: '新營', dx: 24, dy: 2, f: '鄭氏時期軍隊屯墾的地方，所以有「營」字。' },
  { id: 'zuo', x: 60, y: 232, n: '左營', dx: 24, dy: -6, f: '鄭氏時期軍隊駐紮屯墾的地方。' },
  { id: 'kao', x: 62, y: 246, n: '高雄', dx: 24, dy: 8, f: '舊稱「打狗」。日治時期依日語發音改成「高雄」。' },
  { id: 'meng', x: 124, y: 46, n: '艋舺', dx: -4, dy: 16, f: '原住民族語的音譯，原意是「獨木舟」。' },
  { id: 'bei', x: 122, y: 28, n: '北投', dx: -24, dy: 2, f: '原住民族語的音譯，原意和「女巫」有關。' }
], [
  ['哪個地名是「鄭氏軍隊屯墾」留下來的？（選一個）', ['xin', 'zuo'], '地名有**營、鎮**（新營、左營、前鎮）多半和鄭氏時期的軍屯有關。'],
  ['哪個地名是「原住民族語的音譯」？（選一個）', ['meng', 'bei'], '**艋舺**（獨木舟）、**北投**（女巫）都是原住民族語音譯。'],
  ['哪個地名是日治時期被「改名」的？', ['kao'], '「打狗」被改成日語發音相近的**高雄**。']
]);

const REG = { n: ['北部區域', '臺北、新北、桃園、新竹等。政治與經濟中心，人口最多；新竹科學園區帶動高科技產業。', '60,0 200,0 200,92 122,80 60,88', 118, 58], c: ['中部區域', '臺中、彰化、南投等。以工具機、精密機械和農業聞名。', '0,88 122,80 112,150 106,178 0,178', 74, 132], s: ['南部區域', '臺南、高雄、屏東等。高雄有石化、鋼鐵、造船等重化工業。', '0,178 106,178 100,226 94,300 0,300', 70, 218], e: ['東部區域', '花蓮、臺東。人口最少，保有豐富的自然景觀與原住民族文化。', '122,80 200,92 200,300 94,300 100,226 106,178 112,150', 124, 168] };
L.ge7b2 = {
  name: '臺灣區域探險圖', intro: '臺灣可以分成北、中、南、東四個區域。**點地圖上的區域**，認識它們的特色！',
  init: () => ({ r: '' }),
  view: s => tw(Object.keys(REG).map(k => `<polygon points="${REG[k][2]}" class="reg r${k}${s.r === k ? ' on' : ''}" clip-path="url(#twc)" data-tap="${k}"/>`).join('') + Object.keys(REG).map(k => T(REG[k][3], REG[k][4], REG[k][0][0], 'class="plb" pointer-events="none"')).join('')),
  read: s => s.r ? [[REG[s.r][0], REG[s.r][1]]] : [['提示', '點一個區域看看']],
  tap: (s, id) => { s.r = id; },
  missions: [['哪個區域是政治、經濟中心，人口最多？', 'n', '**北部區域**。'], ['哪個區域有高雄的石化、鋼鐵等重化工業？', 's', '**南部區域**。'], ['哪個區域人口最少，卻保有最多自然景觀？', 'e', '**東部區域**（花蓮、臺東）。'], ['哪個區域以工具機、精密機械聞名？', 'c', '**中部區域**。']]
    .map(([t, k, say]) => M(t, s => { s.r = ''; }, s => s.r === k, say, s => { s.r = k; }, '每個區域都點點看。'))
};

L.ge7a2 = {
  name: '季風開關', intro: '臺灣中央有高高的山脈。風從海上吹來，撞到山的那一面（**迎風面**）就會下雨。切換季節看看！',
  init: () => ({ se: '' }),
  ctrl: [{ type: 'choice', k: 'se', label: '季節', opts: [['w', '冬季'], ['s', '夏季']] }],
  view: s => tw([[112, 70], [104, 110], [96, 150], [90, 190], [86, 230]].map(p => T(p[0], p[1], '⛰️', 'font-size="15"')).join('') + (s.se === 'w' ? T(176, 22, '↙', 'class="wind"') + T(182, 58, '↙', 'class="wind"') + T(146, 40, '🌧️', 'font-size="18"') + T(150, 74, '🌧️', 'font-size="18"') + T(52, 216, '☀️', 'font-size="18"') : s.se === 's' ? T(18, 262, '↗', 'class="wind"') + T(14, 220, '↗', 'class="wind"') + T(56, 214, '⛈️', 'font-size="18"') + T(64, 250, '⛈️', 'font-size="18"') + T(132, 44, '⛅', 'font-size="18"') : '')),
  read: s => [['盛行風', s.se === 'w' ? '東北季風' : s.se === 's' ? '西南季風' : '（請選擇季節）'], ['多雨的地方', s.se === 'w' ? '北部、東北部（迎風面）；西南部乾燥' : s.se === 's' ? '西南部多午後雷陣雨，也是颱風季' : '—']],
  missions: [
    M('讓基隆、宜蘭下雨', s => { s.se = ''; }, s => s.se === 'w', '冬季吹**東北季風**，北部和東北部在迎風面所以多雨；西南部在背風面，又乾又晴。', s => { s.se = 'w'; }),
    M('讓高雄、屏東下起午後雷陣雨', s => { s.se = ''; }, s => s.se === 's', '夏季吹**西南季風**，西南部多雨。梅雨和颱風也在夏半年。', s => { s.se = 's'; })
  ]
};

/* ======================= 地理 ======================= */
L.ge7a1 = {
  name: '時區轉盤', intro: '地球 24 小時自轉一圈 360 度，所以**經度每差 15 度，時間就差 1 小時**。越往東，時間越早到。',
  init: () => ({ lon: 0 }),
  ctrl: [{ k: 'lon', label: '經度（負數是西經）', min: -180, max: 180, step: 15, unit: '°' }],
  view: s => { let g = rc(10, 30, 280, 30, 'water'); for (let d = -180; d <= 180; d += 30) { const x = 150 + d * 140 / 180; g += `<line x1="${x}" y1="30" x2="${x}" y2="60" class="gl"/>` + T(x, 70, Math.abs(d) + (d < 0 ? 'W' : d > 0 ? 'E' : '°'), 'class="tk"'); }
    return svg(300, 80, g + '<line x1="150" y1="24" x2="150" y2="62" class="ln2"/>' + T(150 + s.lon * 140 / 180, 18, '📍', 'font-size="18"')); },
  read: s => { const h = s.lon / 15, t = ((12 + h) % 24 + 24) % 24; return [['位置', s.lon === 0 ? '經度 0°（倫敦）' : (s.lon > 0 ? '東經 ' : '西經 ') + Math.abs(s.lon) + '°'], ['和倫敦的時差', (h > 0 ? '快 ' : h < 0 ? '慢 ' : '') + Math.abs(h) + ' 小時'], ['倫敦中午 12:00 時，這裡是', t + ':00' + (12 + h >= 24 ? '（隔天）' : 12 + h < 0 ? '（前一天）' : '')]]; },
  missions: [
    M('臺灣使用東經 120 度的時間。調過去，看看比倫敦快幾小時', s => { s.lon = 0; }, s => s.lon === 120, '120 ÷ 15 = **8**，臺灣比倫敦快 8 小時。', s => { s.lon = 120; }),
    M('找出比倫敦「慢 5 小時」的經度（美國紐約附近）', s => { s.lon = 0; }, s => s.lon === -75, '**西經 75 度**。往西時間比較晚，5 × 15 = 75。', s => { s.lon = -75; }, '往西邊（負數）找，5 × 15 度。'),
    M('日本使用東經 135 度的時間。調過去，和臺灣比比看', s => { s.lon = 0; }, s => s.lon === 135, '日本比倫敦快 9 小時，所以比臺灣**快 1 小時**（差 15 度）。', s => { s.lon = 135; })
  ]
};

const SOC = o => o >= 20 ? '超高齡社會' : o >= 14 ? '高齡社會' : o >= 7 ? '高齡化社會' : '年輕型社會';
L.ge7b1 = {
  name: '人口金字塔工坊', intro: '人口金字塔把人分成幼年、青壯年、老年三層。調整比例，看看金字塔的形狀和社會的名稱！',
  init: () => ({ y: 20, o: 5 }),
  ctrl: [{ k: 'y', label: '幼年人口（0–14 歲）', min: 5, max: 40, unit: '%' }, { k: 'o', label: '老年人口（65 歲以上）', min: 3, max: 30, unit: '%' }],
  view: s => { const m = 100 - s.y - s.o, b = (v, y, c) => rc(130 - v * 2.2, y, v * 4.4, 34, c); return svg(260, 130, b(Math.min(55, s.o * 1.6), 8, 'fillC') + b(Math.min(55, m * 0.75), 46, 'fillA') + b(Math.min(55, s.y * 1.6), 84, 'fillB') + T(130, 25, '老年 ' + s.o + '%') + T(130, 63, '青壯年 ' + m + '%') + T(130, 101, '幼年 ' + s.y + '%')); },
  read: s => [['這是', SOC(s.o)], ['形狀', s.y <= 12 && s.o >= 14 ? '底部窄、頂部寬 → 少子化＋高齡化' : s.y >= 30 ? '底部寬 → 年輕人口多' : '中間寬']],
  missions: [
    M('做出「高齡化社會」（老年人口 7% 以上、未滿 14%）', s => { s.y = 20; s.o = 5; }, s => s.o >= 7 && s.o < 14, '老年人口達 **7%** 就是高齡化社會。', s => { s.o = 8; }),
    M('做出「高齡社會」（14% 以上、未滿 20%）', s => {}, s => s.o >= 14 && s.o < 20, '達 **14%** 是高齡社會。', s => { s.o = 15; }),
    M('做出「超高齡社會」，而且幼年人口在 12% 以下', s => { s.y = 20; s.o = 5; }, s => s.o >= 20 && s.y <= 12, '達 **20%** 是超高齡社會。金字塔**底部窄、頂部寬**，代表少子化加上高齡化。', s => { s.o = 21; s.y = 11; })
  ]
};

const STEP = x => x < 34 ? ['第一級階梯', '青藏高原，平均海拔 4000 公尺以上，有「世界屋脊」之稱'] : x < 67 ? ['第二級階梯', '高原與盆地，海拔約 1000–2000 公尺'] : ['第三級階梯', '平原與丘陵，海拔多在 500 公尺以下，人口最稠密'];
L.ge8a1 = {
  name: '橫越中國列車', intro: '中國的地形**西高東低**，像三級大階梯。開著火車從西邊一路往東，看看窗外的變化！',
  init: () => ({ x: 50 }),
  ctrl: [{ k: 'x', label: '火車位置（西 ← → 東）', min: 0, max: 100, step: 2 }],
  view: s => { const y = s.x < 34 ? 28 : s.x < 67 ? 74 : 116; return svg(300, 150, '<polygon points="0,150 0,40 100,40 100,86 200,86 200,128 300,128 300,150" class="land"/>' + T(50, 100, '一', 'class="tk"') + T(150, 116, '二', 'class="tk"') + T(250, 141, '三', 'class="tk"') + T(8, 12, '西', 'class="tk"') + T(292, 12, '東', 'class="tk"') + T(8 + s.x * 2.84, y, '🚆', 'font-size="22"')); },
  read: s => { const t = STEP(s.x); return [[t[0], t[1]]]; },
  missions: [
    M('把火車開到最高的那一級階梯', s => { s.x = 50; }, s => s.x < 34, '最西邊的**青藏高原**是第一級階梯。河流因此多半由西向東流。', s => { s.x = 10; }),
    M('把火車開到人口最多、平原最多的那一級', s => {}, s => s.x >= 67, '**第三級階梯**地勢低平、靠近海洋，是人口和經濟的重心。', s => { s.x = 90; })
  ]
};

/* ======================= 公民 ======================= */
L.ci9a1 = {
  name: '園遊會定價機', intro: '你在園遊會賣飲料。價格太貴沒人買，太便宜又不夠賣。拉動價格，找出最剛好的價錢！',
  init: () => ({ p: 55 }),
  ctrl: [{ k: 'p', label: '一杯的價格', min: 10, max: 100, step: 5, unit: ' 元' }],
  view: s => { const D = 110 - s.p, S = s.p, y = 150 - s.p * 1.3; return svg(260, 165, '<line x1="24" y1="150" x2="250" y2="150" class="ax"/><line x1="24" y1="10" x2="24" y2="150" class="ax"/><line x1="44" y1="20" x2="224" y2="137" class="ln"/><line x1="44" y1="137" x2="224" y2="20" class="ln2"/>' + T(232, 140, '需求', 'class="tk"') + T(232, 18, '供給', 'class="tk"') + `<line x1="24" y1="${y}" x2="250" y2="${y}" class="dash"/>` + T(12, y, s.p, 'class="tk"')) + `<div class="emo">想買 🧑×${Math.round(D / 10)}　想賣 🥤×${Math.round(S / 10)}</div>`; },
  read: s => { const D = 110 - s.p, S = s.p; return [['需求量（想買）', D + ' 杯'], ['供給量（想賣）', S + ' 杯'], ['市場狀態', D > S ? '供不應求 → 價格會上漲' : D < S ? '供過於求 → 價格會下跌' : '供需均衡 👍']]; },
  missions: [
    M('把價格降到 30 元以下，會發生什麼事？', s => { s.p = 55; }, s => s.p <= 30, '太便宜，想買的人很多、想賣的很少：**供不應求**，價格會上漲。這就是**需求法則**：價格越低，需求量越大。', s => { s.p = 20; }),
    M('把價格調到 80 元以上', s => {}, s => s.p >= 80, '太貴，買的人變少：**供過於求**，東西賣不完，價格會下跌。', s => { s.p = 90; }),
    M('找出需求量和供給量「剛好相等」的價格', s => {}, s => s.p === 55, '55 元時想買和想賣的一樣多，這就是**均衡價格**。', s => { s.p = 55; }, '在 50 和 60 之間。')
  ]
};

function ageLab(missions) {
  return { name: '人生年齡滑桿', intro: '法律用年齡劃了好幾條線。拉動年齡，看看這個人在法律上可以做什麼、要負什麼責任！',
    init: () => ({ age: 10 }),
    ctrl: [{ k: 'age', label: '年齡', min: 0, max: 25, unit: ' 歲' }],
    view: s => { let g = '<line x1="14" y1="40" x2="286" y2="40" class="ax"/>'; [7, 12, 14, 18, 20].forEach(a => { const x = 14 + a * 10.88; g += `<line x1="${x}" y1="32" x2="${x}" y2="48" class="ln2"/>` + T(x, 58, a, 'class="tk"'); });
      return svg(300, 66, g + T(14 + s.age * 10.88, 22, s.age < 7 ? '👶' : s.age < 14 ? '🧒' : s.age < 18 ? '🧑‍🎓' : '🧑‍💼', 'font-size="22"')); },
    read: s => [['民法（買賣、簽約）', s.age < 7 ? '無行為能力：由法定代理人代為' : s.age < 18 ? '限制行為能力：要法定代理人同意' : '完全行為能力：成年，可以自己決定'],
      ['刑法（犯罪責任）', s.age < 14 ? '行為不罰' : s.age < 18 ? '得減輕其刑' : '負完全責任'],
      ['少年事件處理法', s.age >= 12 && s.age < 18 ? '適用（12 歲以上未滿 18 歲）' : '不適用'],
      ['投票', s.age >= 20 ? '可投公民投票，也可以選舉投票' : s.age >= 18 ? '可投公民投票（選舉要滿 20 歲）' : '還不能投票']],
    missions: missions.map(([t, a, say]) => M(t, s => { s.age = 10; }, s => s.age === a, say, s => { s.age = a; }, '慢慢拉，看每一欄什麼時候改變。')) };
}
L.ci8b1 = ageLab([['找出「完全行為能力」的最小年齡', 18, '民法規定滿 **18 歲**成年，可以獨立簽約。'], ['找出「無行為能力」的最大年齡', 6, '**未滿 7 歲**是無行為能力人。'], ['15 歲的國中生想買手機。調到 15 歲看看', 15, '15 歲是**限制行為能力人**，契約要法定代理人同意或承認才有效。']]);
L.ci8b2 = ageLab([['找出刑法上「行為不罰」的最大年齡', 13, '**未滿 14 歲**的人行為不罰。'], ['找出「得減輕其刑」的最小年齡', 14, '**14 歲以上未滿 18 歲**得減輕其刑。'], ['找出適用少年事件處理法的最大年齡', 17, '**12 歲以上未滿 18 歲**的少年適用，以保護和教育為主。']]);
L.ci8a2 = ageLab([['找出可以投「公民投票」的最小年齡', 18, '滿 **18 歲**有公民投票權。'], ['找出可以投票「選總統」的最小年齡', 20, '選舉權要滿 **20 歲**。']]);

/* ======================= 英語：句子機器 ======================= */
function machine(name, intro, slots, out, missions) {
  return { name, intro, init: () => Object.fromEntries(slots.map(x => [x.k, x.opts[0]])),
    ctrl: slots.map(x => ({ type: 'choice', k: x.k, label: x.label, opts: x.opts.map(o => [o, o]) })),
    view: s => { const o = out(s); return `<div class="mach"><div class="mout">${o.s}</div>${o.n ? `<div class="mnote">${o.n}</div>` : ''}</div>`; },
    missions: missions.map(m => M(m[0], m[1], m[2], m[3], m[4], m[5])) };
}
const be = x => x === 'I' ? 'am' : ['He', 'She', 'It', 'Tom'].includes(x) ? 'is' : 'are';
L.en7a1 = machine('be 動詞機器', '把不同的主詞丟進機器，機器會吐出正確的 be 動詞。找出它的規則！',
  [{ k: 'sub', label: '主詞', opts: ['You', 'I', 'He', 'She', 'It', 'Tom', 'We', 'They', 'Tom and I'] }],
  s => ({ s: `${s.sub} <b>${be(s.sub)}</b> happy.`, n: be(s.sub) === 'am' ? '只有 I 用 am' : be(s.sub) === 'is' ? '一個人或一樣東西（he / she / it）用 is' : 'you 和兩個以上（複數）用 are' }),
  [['讓機器吐出 am', s => { s.sub = 'You'; }, s => be(s.sub) === 'am', '只有 **I** 配 **am**。', s => { s.sub = 'I'; }],
   ['讓機器吐出 is', s => { s.sub = 'You'; }, s => be(s.sub) === 'is', '**he / she / it / 單數名詞** 配 **is**。', s => { s.sub = 'She'; }],
   ['選一個「兩個人」的主詞，看看用哪個', s => { s.sub = 'I'; }, s => ['We', 'They', 'Tom and I'].includes(s.sub), '兩個以上是複數，用 **are**。Tom and I 也是兩個人喔！', s => { s.sub = 'Tom and I'; }]]);

const ING = { play: ['playing', '直接加 ing'], write: ['writing', '字尾是 e：去 e 再加 ing'], swim: ['swimming', '短母音＋單子音：重複字尾再加 ing'], run: ['running', '短母音＋單子音：重複字尾再加 ing'], dance: ['dancing', '字尾是 e：去 e 再加 ing'], read: ['reading', '直接加 ing'] };
L.en7a2 = machine('現在進行式機器', '「正在做」要用 **be + 動詞 ing**。把動詞丟進機器，看 ing 怎麼加！',
  [{ k: 'v', label: '動詞', opts: ['play', 'write', 'swim', 'run', 'dance', 'read'] }],
  s => ({ s: `They are <b>${ING[s.v][0]}</b> now.`, n: ING[s.v][1] }),
  [['做出 swimming', s => { s.v = 'play'; }, s => s.v === 'swim', 'swim → swim**m**ing：短母音加單子音結尾，要**重複字尾**。', s => { s.v = 'swim'; }],
   ['找一個「去 e 加 ing」的動詞', s => { s.v = 'play'; }, s => ['write', 'dance'].includes(s.v), 'write → writing、dance → dancing。', s => { s.v = 'write'; }],
   ['再找一個要「重複字尾」的動詞', s => { s.v = 'play'; }, s => s.v === 'run', 'run → run**n**ing。', s => { s.v = 'run'; }]]);

const V3 = { go: ['goes', 'to school'], study: ['studies', 'English'], play: ['plays', 'basketball'], have: ['has', 'breakfast'], watch: ['watches', 'TV'] };
const third = x => ['He', 'She', 'My father'].includes(x);
L.en7b1 = machine('第三人稱變身機', '主詞是 he、she 或「一個人」的時候，現在式的動詞要變身！換主詞和動詞看看。',
  [{ k: 'sub', label: '主詞', opts: ['I', 'You', 'He', 'She', 'My father', 'They'] }, { k: 'v', label: '動詞', opts: ['play', 'go', 'study', 'have', 'watch'] }],
  s => ({ s: `${s.sub} <b>${third(s.sub) ? V3[s.v][0] : s.v}</b> ${V3[s.v][1]} every day.`, n: third(s.sub) ? '第三人稱單數：動詞要加 s / es' : '不是第三人稱單數：動詞用原形' }),
  [['做出 goes', s => { s.sub = 'I'; s.v = 'play'; }, s => third(s.sub) && s.v === 'go', 'o 結尾加 **es**：go → goes。', s => { s.sub = 'He'; s.v = 'go'; }],
   ['做出 studies', s => { s.sub = 'I'; s.v = 'play'; }, s => third(s.sub) && s.v === 'study', '子音 + y：**去 y 加 ies**。', s => { s.sub = 'She'; s.v = 'study'; }],
   ['做出 has', s => { s.sub = 'I'; s.v = 'play'; }, s => third(s.sub) && s.v === 'have', 'have 的第三人稱單數是不規則的 **has**。', s => { s.sub = 'He'; s.v = 'have'; }]]);

const PAST = { go: ['went', 'to the park'], buy: ['bought', 'a book'], write: ['wrote', 'a letter'], see: ['saw', 'a movie'], eat: ['ate', 'an apple'], watch: ['watched', 'TV'] };
L.en7b2 = machine('時光動詞機', '把時間切到 yesterday（昨天），動詞就會穿越到過去式！',
  [{ k: 't', label: '時間', opts: ['every day', 'yesterday'] }, { k: 'v', label: '動詞', opts: ['go', 'buy', 'write', 'see', 'eat', 'watch'] }],
  s => ({ s: `I <b>${s.t === 'yesterday' ? PAST[s.v][0] : s.v}</b> ${PAST[s.v][1]} ${s.t}.`, n: s.t === 'yesterday' ? (s.v === 'watch' ? '規則動詞：加 ed' : '不規則動詞：要背起來') : '現在式：用原形' }),
  [['切到 yesterday，看看 go 變成什麼', s => { s.t = 'every day'; s.v = 'buy'; }, s => s.t === 'yesterday' && s.v === 'go', 'go 的過去式是 **went**（不規則）。', s => { s.t = 'yesterday'; s.v = 'go'; }],
   ['做出 bought', s => { s.t = 'every day'; s.v = 'go'; }, s => s.t === 'yesterday' && s.v === 'buy', 'buy → **bought**。', s => { s.t = 'yesterday'; s.v = 'buy'; }],
   ['找出唯一一個「直接加 ed」的規則動詞', s => { s.t = 'yesterday'; s.v = 'go'; }, s => s.t === 'yesterday' && s.v === 'watch', 'watch → watch**ed**。大部分動詞都是加 ed。', s => { s.v = 'watch'; }]]);

const SZ = { ant: [1, '🐜'], cat: [2, '🐈'], elephant: [3, '🐘'] };
L.en8a1 = machine('比大小擂台', '選兩種動物上擂台比大小，看機器怎麼用英文說！',
  [{ k: 'a', label: '左邊', opts: ['ant', 'cat', 'elephant'] }, { k: 'b', label: '右邊', opts: ['cat', 'ant', 'elephant'] }],
  s => { const d = SZ[s.a][0] - SZ[s.b][0]; return { s: `${SZ[s.a][1]} The ${s.a} is <b>${d > 0 ? 'bigger than' : d < 0 ? 'smaller than' : 'as big as'}</b> the ${s.b}. ${SZ[s.b][1]}`, n: 'The elephant is <b>the biggest</b> of the three.（三個裡面最大）' }; },
  [['讓機器說出 bigger than', s => { s.a = 'ant'; s.b = 'cat'; }, s => SZ[s.a][0] > SZ[s.b][0], '比較級：形容詞 + **er** + **than**。big 要重複 g：bi**gg**er。', s => { s.a = 'elephant'; s.b = 'cat'; }],
   ['讓機器說出 smaller than', s => { s.a = 'elephant'; s.b = 'cat'; }, s => SZ[s.a][0] < SZ[s.b][0], 'small → small**er**。', s => { s.a = 'ant'; s.b = 'cat'; }],
   ['兩邊放一樣的動物，看看怎麼說', s => { s.a = 'ant'; s.b = 'cat'; }, s => s.a === s.b, '一樣大用 **as + 形容詞 + as**。', s => { s.a = 'cat'; s.b = 'cat'; }]]);

const GI = { enjoy: 0, finish: 0, practice: 0, want: 1, hope: 1, decide: 1 };
L.en8a2 = machine('動詞接龍機', '有些動詞後面愛接 **V-ing**，有些愛接 **to V**。換動詞看看機器怎麼接！',
  [{ k: 'v', label: '動詞', opts: ['enjoy', 'want', 'finish', 'hope', 'practice', 'decide'] }],
  s => ({ s: `I ${s.v} <b>${GI[s.v] ? 'to play' : 'playing'}</b> basketball.`, n: GI[s.v] ? 'want / hope / decide + to V' : 'enjoy / finish / practice + V-ing' }),
  [['找一個後面接 to play 的動詞', s => { s.v = 'enjoy'; }, s => GI[s.v] === 1, '**want、hope、decide** 後面接 **to + 原形動詞**。', s => { s.v = 'want'; }],
   ['找一個後面接 playing 的動詞（不能用 enjoy）', s => { s.v = 'want'; }, s => ['finish', 'practice'].includes(s.v), '**enjoy、finish、practice** 後面接 **V-ing**。', s => { s.v = 'finish'; }]]);

const TAG = { 'You are a student': "aren't you", "Tom doesn't like fish": 'does he', 'She can swim': "can't she", 'They went home': "didn't they" };
L.en8b2 = machine('附加問句鏡子', '附加問句像照鏡子：前面是肯定，後面就變否定；前面是否定，後面就變肯定。',
  [{ k: 's', label: '句子', opts: Object.keys(TAG) }],
  s => ({ s: `${s.s}, <b>${TAG[s.s]}</b>?`, n: s.s.includes("n't") ? '前面否定 → 後面肯定' : '前面肯定 → 後面否定' }),
  [['找出唯一「前面是否定句」的句子', s => { s.s = 'You are a student'; }, s => s.s === "Tom doesn't like fish", "前面否定（doesn't），附加問句就用肯定：**does he**?", s => { s.s = "Tom doesn't like fish"; }],
   ["做出 didn't they", s => { s.s = 'You are a student'; }, s => s.s === 'They went home', 'went 是過去式的一般動詞，所以用 **did** 來問。', s => { s.s = 'They went home'; }],
   ["做出 can't she", s => { s.s = 'You are a student'; }, s => s.s === 'She can swim', '有助動詞 can，就直接用它：**can\'t she**?', s => { s.s = 'She can swim'; }]]);

const FS = { 'ten years': 'for', '2020': 'since', 'two hours': 'for', 'last Monday': 'since', 'three days': 'for', 'I was a child': 'since' };
L.en9a1 = machine('for / since 分類機', '現在完成式常搭配 for 和 since。換時間看看機器選哪一個！',
  [{ k: 't', label: '時間', opts: Object.keys(FS) }],
  s => ({ s: `I have lived here <b>${FS[s.t]}</b> ${s.t}.`, n: FS[s.t] === 'for' ? 'for + 一段時間（多久）' : 'since + 開始的時間點（從什麼時候）' }),
  [['找一個要用 since 的時間', s => { s.t = 'ten years'; }, s => FS[s.t] === 'since', '**since + 起點**：since 2020、since last Monday。', s => { s.t = '2020'; }],
   ['再找一個要用 for 的時間（不能用 ten years）', s => { s.t = '2020'; }, s => FS[s.t] === 'for' && s.t !== 'ten years', '**for + 一段時間**：for two hours、for three days。', s => { s.t = 'two hours'; }]]);

const PV = { break: ['broke', 'was broken', 'the window'], build: ['built', 'was built', 'the house'], write: ['wrote', 'was written', 'the letter'] };
L.en9a2 = machine('主動被動翻轉機', '同一件事，可以讓「做的人」當主角（主動），也可以讓「被做的東西」當主角（被動）。',
  [{ k: 'voice', label: '語態', opts: ['主動', '被動'] }, { k: 'v', label: '動詞', opts: ['break', 'build', 'write'] }],
  s => ({ s: s.voice === '主動' ? `Tom <b>${PV[s.v][0]}</b> ${PV[s.v][2]}.` : `${PV[s.v][2][0].toUpperCase() + PV[s.v][2].slice(1)} <b>${PV[s.v][1]}</b> by Tom.`, n: s.voice === '主動' ? '主動：做的人 + 動詞' : '被動：be 動詞 + 過去分詞（+ by 做的人）' }),
  [['切換成被動語態', s => { s.voice = '主動'; s.v = 'break'; }, s => s.voice === '被動', '被動語態：**be + 過去分詞**。主角變成 the window。', s => { s.voice = '被動'; }],
   ['做出 was built', s => { s.voice = '主動'; s.v = 'break'; }, s => s.voice === '被動' && s.v === 'build', 'build 的過去分詞是 **built**。', s => { s.voice = '被動'; s.v = 'build'; }],
   ['做出 was written', s => { s.voice = '主動'; s.v = 'break'; }, s => s.voice === '被動' && s.v === 'write', 'write – wrote – **written**。', s => { s.voice = '被動'; s.v = 'write'; }]]);

const RW = { 'the girl': 'who', 'the book': 'which', 'the teacher': 'who', 'the car': 'which', 'the dog': 'which' };
L.en9b1 = machine('關係代名詞放大鏡', '想多介紹一下前面的名詞，就接一個關係代名詞。換名詞看看要用 who 還是 which！',
  [{ k: 'n', label: '名詞', opts: Object.keys(RW) }],
  s => ({ s: `This is ${s.n} <b>${RW[s.n]}</b> I like.`, n: RW[s.n] === 'who' ? '人 → who（也可以用 that）' : '物或動物 → which（也可以用 that）' }),
  [['找一個要用 which 的名詞', s => { s.n = 'the girl'; }, s => RW[s.n] === 'which', '先行詞是**物或動物**，用 **which**。', s => { s.n = 'the book'; }],
   ['找另一個要用 who 的名詞（不能用 the girl）', s => { s.n = 'the book'; }, s => s.n === 'the teacher', '先行詞是**人**，用 **who**。', s => { s.n = 'the teacher'; }]]);

/* ======================= 國文 ======================= */
const TYPO = [['他做事總是按步就班，遇到難題也不會一愁莫展。', { 步: '部', 愁: '籌' }], ['哥哥金榜提名，全家人都迫不急待想幫他慶祝。', { 提: '題', 急: '及' }], ['兩位老朋友談笑風聲，輸的人也甘敗下風。', { 聲: '生', 敗: '拜' }]];
L.ch7a1 = {
  name: '錯字獵人', intro: '迷霧怪把句子裡的字偷偷換掉了！**點出寫錯的字**，把它修好。每句有 2 個錯字。',
  init: () => ({ i: 0, found: {}, msg: '' }),
  view: s => { const [t, w] = TYPO[s.i]; return '<div class="typo">' + [...t].map((c, k) => w[c] ? (s.found[c] ? `<span class="fix">${w[c]}</span>` : `<span data-tap="${k}">${c}</span>`) : `<span data-tap="${k}">${c}</span>`).join('') + '</div>' + (s.msg ? `<p class="labnote"><b>${s.msg}</b></p>` : ''); },
  read: s => [['已修好', Object.keys(s.found).length + ' / 2']],
  tap: (s, id) => { const c = [...TYPO[s.i][0]][+id]; if (TYPO[s.i][1][c]) { s.found[c] = 1; s.msg = `「${c}」→「${TYPO[s.i][1][c]}」修好了！`; } else s.msg = `「${c}」沒有寫錯喔，再找找。`; },
  missions: TYPO.map((x, i) => M('找出這句話裡的 2 個錯字', s => { s.i = i; s.found = {}; s.msg = ''; }, s => Object.keys(s.found).length === 2,
    ['**按部就班**（按照部門次序）、**一籌莫展**（籌是竹籌，想不出辦法）。', '**金榜題名**（把名字題在榜上）、**迫不及待**（來不及等）。', '**談笑風生**（氣氛生動）、**甘拜下風**（拜服對方）。'][i], s => { Object.keys(x[1]).forEach(c => s.found[c] = 1); }, '看看成語裡的字，想想它的意思。'))
};

const COMBO = { '氵工': ['江', '形聲', '「氵」表示和水有關（形符），「工」表示讀音（聲符）'], '氵可': ['河', '形聲', '「氵」表意，「可」表音'], '日月': ['明', '會意', '太陽和月亮合在一起，非常明亮'], '人木': ['休', '會意', '人靠在樹旁休息'], '木木': ['林', '會意', '兩棵樹在一起，成了樹林'] };
const combo = s => COMBO[s.a + s.b] || COMBO[s.b + s.a];
const put = c => s => { if (!s.a) s.a = c; else if (!s.b) s.b = c; else { s.a = c; s.b = ''; } };
L.ch8b1 = {
  name: '造字熔爐', intro: '古人用幾種方法造字。把兩個部件丟進熔爐，看看能合出什麼字、屬於哪一種造字法！',
  init: () => ({ a: '', b: '' }),
  ctrl: ['氵', '工', '可', '日', '月', '人', '木'].map(c => ({ type: 'btn', label: c, run: put(c) })).concat([{ type: 'btn', label: '清空', run: s => { s.a = ''; s.b = ''; } }]),
  view: s => { const r = s.a && s.b ? combo(s) : null; return `<div class="forge"><span class="fs">${s.a || '？'}</span>＋<span class="fs">${s.b || '？'}</span>＝<span class="fr ${r ? 'ok' : ''}">${r ? r[0] : s.a && s.b ? '✕' : '？'}</span></div>` + (r ? `<p class="labnote"><b>${r[1]}字</b>：${r[2]}</p>` : s.a && s.b ? '<p class="labnote">這兩個合不出字，換一組試試。</p>' : ''); },
  missions: [
    M('合出一個「會意字」', s => { s.a = ''; s.b = ''; }, s => !!(s.a && s.b && combo(s) && combo(s)[1] === '會意'), '**會意**：把兩個字的意思合起來，產生新的意思。', s => { s.a = '日'; s.b = '月'; }, '試試「日」和「月」。'),
    M('合出一個有水部的「形聲字」', s => { s.a = ''; s.b = ''; }, s => !!(s.a && s.b && combo(s) && combo(s)[1] === '形聲'), '**形聲**：一半表示意思、一半表示讀音。漢字有八成以上是形聲字。', s => { s.a = '氵'; s.b = '工'; }, '「氵」加上一個表示讀音的部件。'),
    M('用兩個「一模一樣」的部件合出一個字', s => { s.a = ''; s.b = ''; }, s => s.a === '木' && s.b === '木', '兩個木是「林」，三個木是「森」，都是會意字。', s => { s.a = '木'; s.b = '木'; })
  ]
};

const POEM = [['登鸛雀樓（王之渙）', ['白日依山盡', '黃河入海流', '欲窮千里目', '更上一層樓']], ['春望（杜甫）', ['國破山河在', '城春草木深', '感時花濺淚', '恨別鳥驚心', '烽火連三月', '家書抵萬金', '白頭搔更短', '渾欲不勝簪']]];
const sel = s => Object.keys(s.sel).filter(k => s.sel[k]).map(Number).sort((a, b) => a - b).join(',');
L.ch8a1 = {
  name: '詩句解剖臺', intro: '把一首唐詩放上解剖臺。**點詩句**把它選起來（再點一次取消），找出格律的祕密！',
  init: () => ({ p: 0, sel: {} }),
  view: s => `<div class="poem"><div class="pt">${POEM[s.p][0]}</div>${POEM[s.p][1].map((l, i) => `<div class="pl2 ${s.sel[i] ? 'on' : ''}" data-tap="${i}"><i>${i + 1}</i>${l.slice(0, -1)}<b>${l.slice(-1)}</b></div>`).join('')}</div>`,
  read: s => { const n = POEM[s.p][1].length; return [['句數', n + ' 句 → ' + (n === 4 ? '絕句' : '律詩')], ['每句', '5 個字（五言），全詩 ' + n * 5 + ' 字']]; },
  tap: (s, id) => { s.sel[id] = !s.sel[id]; },
  missions: [
    M('這首絕句裡，哪幾句有押韻？把它們選起來（看每句最後一個字）', s => { s.p = 0; s.sel = {}; }, s => sel(s) === '1,3', '「流」和「樓」押韻。近體詩**偶數句押韻**。', s => { s.sel = { 1: true, 3: true }; }, '唸唸看：流、樓。'),
    M('換成律詩。一樣把押韻的句子選起來', s => { s.p = 1; s.sel = {}; }, s => sel(s) === '1,3,5,7', '深、心、金、簪押韻，也是偶數句。律詩有 **8 句**。', s => { s.sel = { 1: true, 3: true, 5: true, 7: true }; }, '第 2、4、6、8 句。'),
    M('律詩中間有兩聯必須「對仗」。把那四句選起來', s => { s.sel = {}; }, s => sel(s) === '2,3,4,5', '第 3、4 句（**頷聯**）和第 5、6 句（**頸聯**）必須對仗，例如「感時」對「恨別」、「花濺淚」對「鳥驚心」。', s => { s.sel = { 2: true, 3: true, 4: true, 5: true }; }, '不是頭兩句，也不是最後兩句。')
  ]
};
G.LABKIT = { svg, T, rc, M, R, rep, machine };      // 給第二批實驗室（labs2.js）共用
})(typeof globalThis !== 'undefined' ? globalThis : window);

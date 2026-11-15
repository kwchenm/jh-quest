/* 互動實驗室（第三批）：地理 6 個、英語 2 個
   共用 labs.js（LABKIT）與 labs2.js（LABKIT2）的工具與引擎。
   同一個實驗裡，不同任務可以換不同的畫面與控制項（依 s.mi 決定）。 */
(function (G) {
'use strict';
const L = G.LABS;
const { svg, T, rc, M, R } = G.LABKIT;
const { huntLab, world } = G.LABKIT2;
const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const bars = (data, cur, x0, y0, w, h) => { const mx = Math.max(...data), bw = w / data.length;
  return data.map((v, i) => { const bh = Math.max(1, v / mx * h), x = x0 + i * bw;
    return `<rect x="${x + 1}" y="${y0 + h - bh}" width="${bw - 2}" height="${bh}" class="${i + 1 === cur ? 'barOn' : 'barOff'}"/>` + T(x + bw / 2, y0 + h + 9, i + 1, 'class="tk"'); }).join(''); };
const pins = (pts, sel) => pts.map(p => `<g data-tap="${p.id}" class="pin${sel === p.id ? ' on' : ''}"><circle cx="${p.x}" cy="${p.y}" r="12" class="hit"/><circle cx="${p.x}" cy="${p.y}" r="5" class="dot"/>${T(p.x + (p.dx || 0), p.y + (p.dy === undefined ? -11 : p.dy), p.n, 'class="plb"')}</g>`).join('');

/* ======================= 地理：東北亞 ======================= */
const JZ = { sea: ['日本海沿岸', 70, [2, 2, 1], '面向日本海，冬天多大雪，離太平洋航線較遠'], mtn: ['中央山地', 150, [1, 1, 1], '山多、交通不便，原料和產品都很難運送'], pac: ['太平洋沿岸平原', 235, [3, 3, 3], '有大港口、平原和大城市，進口原料、出口產品都方便'] };
const KR_S = [[100, 104], [96, 114], [110, 120], [120, 150], [104, 170], [116, 132], [126, 110], [92, 140], [112, 98], [132, 124], [118, 176], [98, 160], [108, 144], [124, 92]];
const KR = '70,20 110,14 140,26 146,60 138,100 128,140 112,180 92,186 80,160 84,120 76,80 64,48';
function japanView(s) {
  let g = '<rect width="320" height="170" class="sky"/>' + rc(0, 95, 40, 75, 'water') + '<polygon points="40,95 100,95 100,170 40,170" class="land"/>' +
    '<polygon points="100,95 122,48 140,72 165,30 186,62 200,95 200,170 100,170" class="mtn"/>' + '<polygon points="200,95 270,95 270,170 200,170" class="land"/>' + rc(270, 95, 50, 75, 'water') +
    T(20, 86, '日本海', 'class="tk"') + T(300, 86, '太平洋', 'class="tk"') + T(70, 108, '🏘️', 'font-size="13"') + T(235, 108, '🏙️🏙️', 'font-size="13"') + T(295, 108, '🚢', 'font-size="15"');
  Object.keys(JZ).forEach(k => { const [n, x] = JZ[k]; g += `<rect x="${x - (k === 'mtn' ? 50 : 32)}" y="10" width="${k === 'mtn' ? 100 : 64}" height="160" class="hit" data-tap="${k}"/>` + T(x, 158, n, 'class="plb" pointer-events="none"'); });
  if (s.p && JZ[s.p]) g += T(JZ[s.p][1], s.p === 'mtn' ? 22 : 78, '🏭', 'font-size="20" pointer-events="none"');
  if (s.plate) g += '<path d="M320,128 L200,128 Q150,128 110,168" class="plateLine"/>' + T(262, 122, '← 太平洋板塊', 'class="plb"') + T(165, 18, '🌋', 'font-size="16"') + T(215, 140, '⚡地震', 'class="plb"') + T(60, 136, '大陸板塊', 'class="plb"');
  return svg(320, 170, g);
}
function koreaView(s) {
  const n = s.night;
  let g = `<rect width="220" height="200" fill="${n ? '#05070f' : '#10264a'}"/><defs><clipPath id="krc"><polygon points="${KR}"/></clipPath></defs><polygon points="${KR}" class="${n ? 'nightland' : 'land'}"/>`;
  if (n) g += KR_S.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.2" class="glow"/>`).join('') + '<circle cx="90" cy="66" r="2.5" class="glow"/>';
  ['north', 'south'].forEach(k => { g += `<rect x="0" y="${k === 'north' ? 0 : 86}" width="220" height="${k === 'north' ? 86 : 114}" clip-path="url(#krc)" data-tap="${k}" class="${s.p === k ? 'selhalf' : 'hit'}"/>`; });
  return svg(220, 200, g + '<line x1="60" y1="86" x2="152" y2="86" class="dline"/>' + T(186, 80, '軍事分界線', 'class="plb"') + T(186, 92, '（約北緯 38 度）', 'class="tk"') + T(104, 50, '北韓', 'class="plb" pointer-events="none"') + T(110, 132, '南韓', 'class="plb" pointer-events="none"'));
}
L.ge8a2 = {
  name: '東北亞觀測站', intro: '我們從兩個角度觀察東北亞：先看**日本的地形剖面**（點不同地方試試看），再看**朝鮮半島的衛星照片**。',
  init: () => ({ p: '', plate: false, night: false }),
  ctrl: s => s.mi === 1 ? [{ type: 'toggle', k: 'plate', label: '顯示地底的板塊' }] : s.mi === 2 ? [{ type: 'toggle', k: 'night', label: '切換成夜晚的衛星照片' }] : [],
  view: s => s.mi === 2 ? koreaView(s) : japanView(s),
  read: s => {
    if (s.mi === 2) return s.p === 'south' ? [['南韓', '工商業與高科技發達：電子、汽車、文化產業出口全世界']] : s.p === 'north' ? [['北韓', '經濟封閉、電力不足，發展相對落後']] : [['提示', s.night ? '點朝鮮半島的北半部或南半部' : '先切換成夜晚的衛星照片']];
    if (s.mi === 1) return [['日本底下', s.plate ? '太平洋板塊往下擠進大陸板塊底下' : '（打開看看）'], ['所以', s.plate ? '多火山、多地震：位在環太平洋地震帶' : '—']];
    const z = JZ[s.p]; return z ? [['工廠蓋在', z[0]], ['進口原料', stars(z[2][0])], ['出口產品', stars(z[2][1])], ['工人和市場', stars(z[2][2])], ['說明', z[3]]] : [['提示', '點地形剖面上的一個地方，看看適不適合蓋工廠']];
  },
  tap: (s, id) => { s.p = id; },
  missions: [
    M('日本缺乏礦產和能源，原料要靠船從國外運進來。幫汽車公司選一個蓋工廠的地方', s => { s.p = ''; }, s => s.p === 'pac', '日本的工業區集中在**太平洋沿岸**：港口方便進口原料、出口產品，人口和市場也多。', s => { s.p = 'pac'; }, '原料從海上運來，產品也要靠船出口。'),
    M('日本為什麼常有地震和火山？打開「顯示地底的板塊」看看', s => { s.plate = false; s.p = 'pac'; }, s => s.plate, '日本位在**環太平洋地震帶**，板塊互相擠壓，所以**多火山、多地震**。', s => { s.plate = true; }),
    M('朝鮮半島大約以北緯 38 度分成兩國。切換成夜晚的衛星照片，點出燈光比較多、經濟比較發達的那一邊', s => { s.night = false; s.p = ''; }, s => s.night && s.p === 'south',
      '**南韓**發展出口導向的工業，夜晚燈火通明；**北韓**經濟封閉，夜晚幾乎一片漆黑。', s => { s.night = true; s.p = 'south'; }, '先打開夜晚的照片，再比比看哪一邊比較亮。')
  ]
};

/* ======================= 地理：南亞與東南亞 ======================= */
const RAIN = [1, 1, 0, 1, 15, 520, 840, 580, 330, 70, 15, 3];          // 孟買各月雨量（毫米，示意）
const wind = m => m >= 6 && m <= 9 ? 'sw' : [11, 12, 1, 2, 3].includes(m) ? 'ne' : '';
const CROPS = [['稻米', '🌾 稻米'], ['橡膠', '🌳 橡膠'], ['油棕', '🌴 油棕']];
const isPlant = s => s.crop !== '稻米' && s.big && s.exp;
L.ge8b1 = {
  name: '南亞季風雨量站', intro: '印度孟買每個月的雨量差非常多！拉動月份，看看**風從哪裡吹來**、雨下得多不多。',
  init: () => ({ m: 1, crop: '稻米', big: false, exp: false }),
  ctrl: s => s.mi === 2 ? [{ type: 'choice', k: 'crop', label: '種什麼', opts: CROPS }, { type: 'toggle', k: 'big', label: '大面積只種一種作物' }, { type: 'toggle', k: 'exp', label: '主要賣到國外' }]
    : [{ k: 'm', label: '月份', min: 1, max: 12, fmt: m => m + ' 月' }],
  view: s => {
    if (s.mi === 2) { const e = CROPS.find(c => c[0] === s.crop)[1].split(' ')[0];
      return `<div class="emo big">${e.repeat(s.big ? 6 : 2)}</div><div class="emo">${s.exp ? '🚢 ➜ 🌍 歐美市場' : '🏠 自己和當地人吃'}</div><div class="mout">${isPlant(s) ? '<b>熱帶栽培業</b>' : '一般農業'}</div>`; }
    const w = wind(s.m), r = RAIN[s.m - 1];
    let g = rc(0, 0, 150, 160, 'water') + '<polygon points="22,18 132,18 118,60 92,118 76,150 60,112 38,64" class="land"/>' + T(80, 60, '印度', 'class="plb"') + T(64, 92, '孟買', 'class="tk"') + '<circle cx="56" cy="86" r="3" class="dot"/>';
    if (w === 'sw') g += '<line x1="10" y1="150" x2="58" y2="96" class="windA"/>' + T(26, 150, '西南季風', 'class="plb"') + T(92, 40, '🌧️🌧️', 'font-size="14"');
    else if (w === 'ne') g += '<line x1="140" y1="10" x2="96" y2="56" class="windA"/>' + T(120, 76, '東北季風', 'class="plb"') + T(80, 40, '☀️', 'font-size="14"');
    else g += T(80, 40, r > 50 ? '⛅' : '🌤️', 'font-size="14"');
    return svg(320, 168, g + bars(RAIN, s.m, 160, 20, 155, 120) + T(238, 12, '孟買各月雨量（示意）', 'class="tk"'));
  },
  read: s => s.mi === 2 ? [['作物', s.crop], ['經營方式', (s.big ? '大面積單一作物' : '小面積') + '、' + (s.exp ? '外銷' : '自給')], ['這是', isPlant(s) ? '熱帶栽培業' : '一般農業']]
    : [['風向', wind(s.m) === 'sw' ? '西南季風：從印度洋吹向陸地' : wind(s.m) === 'ne' ? '東北季風：從陸地吹向海洋' : '季風轉換期'], ['雨量', RAIN[s.m - 1] + ' 毫米'], ['季節', RAIN[s.m - 1] > 100 ? '雨季 🌧️' : '乾季 ☀️']],
  missions: [
    M('找出孟買一年中雨下得最多的月份', s => { s.m = 1; }, s => s.m === 7, '夏季吹**西南季風**，從印度洋帶來大量水氣，6～9 月是雨季，7 月最多。', s => { s.m = 7; }, '看右邊的長條圖哪一根最高。'),
    M('找一個吹「東北季風」、幾乎不下雨的月份', s => { s.m = 7; }, s => [11, 12, 1, 2, 3].includes(s.m), '冬季吹**東北季風**，從乾燥的陸地吹來，所以幾乎不下雨。', s => { s.m = 1; }),
    M('殖民時期，歐洲人在東南亞開了很多大農場。把這座農場設定成「熱帶栽培業」', s => { s.crop = '稻米'; s.big = false; s.exp = false; }, isPlant,
      '**熱帶栽培業**：種橡膠、油棕、咖啡等作物，特色是**單一作物、大面積、外銷**。', s => { s.crop = '橡膠'; s.big = true; s.exp = true; }, '不是種來自己吃的喔。')
  ]
};

/* ======================= 地理：西亞、北非與漠南非洲 ======================= */
const inc = s => Math.round((s.div ? 0.7 + 0.3 * s.p / 100 : 0.2 + 0.8 * s.p / 100) * 100);
const OIL = [{ id: 'gulf', x: 222, y: 80, n: '波斯灣', dx: 18, dy: -8, f: '沿岸蘊藏豐富石油，是世界重要的產油區。' }, { id: 'sah', x: 166, y: 84, n: '撒哈拉沙漠', dx: -24, dy: 12, f: '世界最大的熱沙漠，氣候非常乾燥。' },
  { id: 'nile', x: 190, y: 86, n: '尼羅河', dx: 8, dy: 14, f: '流經沙漠的大河，沿岸是古埃及文明的發源地。' }, { id: 'cong', x: 180, y: 120, n: '剛果雨林', dy: 14, f: '赤道附近的熱帶雨林，在漠南非洲。' }];
L.ge8b2 = {
  name: '非洲經濟與國界實驗', intro: '漠南非洲有些國家的出口幾乎只靠「可可」。我們來看看國際價格一變，這個國家會怎樣。',
  init: () => ({ p: 100, div: false, eth: false, pin: '' }),
  ctrl: s => s.mi === 0 ? [{ k: 'p', label: '國際可可價格', min: 30, max: 150, step: 10, unit: '%' }]
    : s.mi === 1 ? [{ k: 'p', label: '國際可可價格', min: 30, max: 150, step: 10, unit: '%' }, { type: 'toggle', k: 'div', label: '發展多元產業（觀光、製造業…）' }]
    : s.mi === 2 ? [{ type: 'toggle', k: 'eth', label: '顯示族群分布' }] : [],
  view: s => {
    if (s.mi === 3) return world(pins(OIL, s.pin));
    if (s.mi === 2) { let g = rc(10, 10, 240, 150, 'sand', 'rx="8"');
      if (s.eth) g += '<ellipse cx="80" cy="70" rx="52" ry="36" fill="#f8717199"/><ellipse cx="172" cy="58" rx="46" ry="30" fill="#60a5fa99"/><ellipse cx="132" cy="126" rx="62" ry="26" fill="#4ade8099"/>' + T(80, 70, '甲族', 'class="plb"') + T(172, 58, '乙族', 'class="plb"') + T(132, 128, '丙族', 'class="plb"');
      return svg(260, 170, g + '<line x1="125" y1="10" x2="125" y2="160" class="border"/><line x1="10" y1="95" x2="250" y2="95" class="border"/>' + T(40, 24, 'A 國', 'class="tk"') + T(220, 24, 'B 國', 'class="tk"') + T(40, 150, 'C 國', 'class="tk"') + T(220, 150, 'D 國', 'class="tk"') + T(150, 104, '📏 直線國界', 'class="tk"')); }
    const v = inc(s);
    return `<div class="emo big">🍫${s.div ? ' 🏨🏭' : ''}</div><div class="incbar"><span>國家收入</span><div class="meter"><i style="width:${Math.min(100, v / 1.3)}%"></i></div><b>${v}%</b></div><p class="labnote">（以價格正常時的收入為 100%，數字為示意）</p>`;
  },
  read: s => s.mi === 3 ? (OIL.find(o => o.id === s.pin) ? [[OIL.find(o => o.id === s.pin).n, OIL.find(o => o.id === s.pin).f]] : [['提示', '點地圖上的圓點']])
    : s.mi === 2 ? [['國界', s.eth ? '一個族群被直線切成兩半，不同族群被劃進同一國' : '國界是一條條直線']]
    : [['可可價格', s.p + '%'], ['出口結構', s.div ? '可可＋觀光＋製造業' : '幾乎只靠可可'], ['國家收入', inc(s) + '%' + (inc(s) < 70 ? '　😟' : '')]],
  tap: (s, id) => { s.pin = id; },
  missions: [
    M('國際可可價格暴跌到一半（50%），看看這個國家的收入會變多少', s => { s.p = 100; s.div = false; }, s => s.p === 50, '收入只剩 6 成！過度依賴少數農礦產品出口，叫做**單一經濟**，很容易受國際價格影響。', s => { s.p = 50; }),
    M('想辦法讓這個國家在可可價格只有一半時，收入還能保持八成以上', s => { s.p = 50; s.div = false; }, s => s.div && s.p <= 50 && inc(s) >= 80, '發展**多元產業**，降低對單一作物的依賴，價格波動的影響就變小了。', s => { s.div = true; }, '價格我們管不了，能改變的是國家自己的產業。'),
    M('很多漠南非洲國家的國界是直線。打開「顯示族群分布」，看看直線把什麼切開了', s => { s.eth = false; }, s => s.eth, '殖民時期歐洲列強**任意劃分國界**，沒有考慮族群分布，同一族群被拆散、不同族群被劃在一起，容易引發衝突。', s => { s.eth = true; }),
    M('點出世界重要的產油區', s => { s.pin = ''; }, s => s.pin === 'gulf', '**波斯灣**沿岸蘊藏豐富的石油。西亞北非乾燥，居民多信仰伊斯蘭教。', s => { s.pin = 'gulf'; }, '在阿拉伯半島旁邊的海灣。')
  ]
};

/* ======================= 地理：歐洲與俄羅斯 ======================= */
const ROME = [67, 73, 58, 81, 53, 34, 19, 37, 73, 113, 112, 82];        // 羅馬各月雨量（毫米，示意）
const lon = s => s.cur && s.wind ? 5 : s.cur ? -4 : s.wind ? -6 : -12;
L.ge9a1 = {
  name: '歐洲氣候實驗室', intro: '倫敦和加拿大東岸差不多在同一個緯度，冬天卻差很多。打開不同的開關，看看是什麼讓西歐比較溫暖！',
  init: () => ({ cur: false, wind: false, m: 1, pin: '' }),
  ctrl: s => s.mi === 0 ? [{ type: 'toggle', k: 'cur', label: '北大西洋暖流' }, { type: 'toggle', k: 'wind', label: '西風' }] : s.mi === 1 ? [{ k: 'm', label: '月份', min: 1, max: 12, fmt: m => m + ' 月' }] : [],
  view: s => {
    if (s.mi === 2) return svg(300, 150, '<rect width="300" height="150" class="sea"/><polygon points="20,40 280,30 290,110 30,120" class="land"/><line x1="110" y1="34" x2="114" y2="118" class="dline"/>' + T(112, 26, '烏拉山', 'class="plb"') +
      `<rect x="20" y="30" width="92" height="92" class="${s.pin === 'w' ? 'selhalf' : 'hit'}" data-tap="w"/><rect x="112" y="28" width="180" height="94" class="${s.pin === 'e' ? 'selhalf' : 'hit'}" data-tap="e"/>` +
      T(66, 74, '歐俄', 'class="plb" pointer-events="none"') + T(200, 74, '西伯利亞', 'class="plb" pointer-events="none"') + T(52, 92, '🏙️', 'font-size="12" pointer-events="none"') + T(220, 96, '🌲❄️', 'font-size="12" pointer-events="none"'));
    if (s.mi === 1) { const r = ROME[s.m - 1]; return svg(320, 150, bars(ROME, s.m, 20, 18, 280, 100) + T(160, 10, '羅馬各月雨量（示意）', 'class="tk"')) + `<div class="emo big">${r < 40 ? '☀️🍇🫒' : r > 90 ? '🌧️🌧️' : '⛅'}</div>`; }
    let g = '<rect width="320" height="160" class="sea"/><polygon points="10,20 70,14 80,70 40,90 10,70" class="land"/><polygon points="200,30 240,20 300,30 310,120 230,140 210,90" class="land"/>' +
      T(40, 52, '加拿大東岸', 'class="plb"') + T(256, 70, '西歐', 'class="plb"') + '<circle cx="232" cy="58" r="4" class="dot"/>' + T(232, 46, '倫敦', 'class="tk"') + '<line x1="0" y1="58" x2="320" y2="58" class="dline"/>' + T(150, 52, '同一個緯度', 'class="tk"');
    if (s.cur) g += '<path d="M60,150 Q140,120 210,96" class="warm"/>' + T(120, 148, '北大西洋暖流', 'class="plb"');
    if (s.wind) g += T(150, 90, '➡️➡️ 西風', 'font-size="12"');
    return svg(320, 160, g);
  },
  read: s => s.mi === 2 ? (s.pin === 'w' ? [['歐俄', '烏拉山以西：氣候較溫和、開發早，人口和莫斯科等大城市集中']] : s.pin === 'e' ? [['西伯利亞', '烏拉山以東：冬季嚴寒、地廣人稀']] : [['提示', '點烏拉山的左邊或右邊']])
    : s.mi === 1 ? [['月份', s.m + ' 月'], ['羅馬雨量', ROME[s.m - 1] + ' 毫米'], ['天氣', ROME[s.m - 1] < 40 ? '乾燥晴朗' : ROME[s.m - 1] > 90 ? '多雨' : '普通']]
    : [['倫敦一月平均氣溫', lon(s) + '°C'], ['加拿大東岸一月', '−15°C'], ['說明', s.cur && s.wind ? '暖流加熱海面，西風把溫暖的空氣吹進陸地' : s.cur ? '暖流在海上，但熱氣吹不進陸地' : s.wind ? '有風，但吹來的海面空氣不夠暖' : '沒有暖流也沒有西風'], ['（數字為示意）', '']],
  tap: (s, id) => { s.pin = id; },
  missions: [
    M('讓倫敦的一月平均氣溫高於 0°C', s => { s.cur = false; s.wind = false; }, s => lon(s) > 0, '**北大西洋暖流**讓海面變暖，**西風**再把溫暖潮溼的空氣吹進陸地，形成全年溫和多雨的**溫帶海洋性氣候**。', s => { s.cur = true; s.wind = true; }, '一個開關不夠喔！'),
    M('南歐的羅馬是地中海型氣候。找出它最乾的月份', s => { s.m = 1; }, s => s.m === 7, '地中海型氣候**夏乾冬雨**，所以適合種葡萄、橄欖等耐旱作物。', s => { s.m = 7; }, '看看哪一根長條最矮。'),
    M('俄羅斯是世界最大的國家。點出大部分俄羅斯人住在哪一邊', s => { s.pin = ''; }, s => s.pin === 'w', '俄羅斯的人口和主要都市大多在**烏拉山以西的歐洲部分**。', s => { s.pin = 'w'; })
  ]
};

/* ======================= 地理：兩極與美洲 ======================= */
const LAT = [{ id: 'mex', x: 76, y: 90, n: '墨西哥', dx: -20, f: '說西班牙語。' }, { id: 'per', x: 78, y: 128, n: '秘魯', dx: -18, f: '說西班牙語。' }, { id: 'bra', x: 102, y: 132, n: '巴西', dx: 18, f: '曾被葡萄牙殖民，說葡萄牙語，是拉丁美洲面積最大的國家。' },
  { id: 'arg', x: 88, y: 168, n: '阿根廷', dx: 22, f: '說西班牙語。' }, { id: 'ama', x: 94, y: 112, n: '亞馬孫河流域', dx: 40, dy: -2, f: '世界最大的熱帶雨林，有「地球之肺」之稱。' }];
L.ge9a2 = {
  name: '兩極與美洲探險', intro: '先做一個**想像實驗**：如果北極和南極的冰全部融化，底下會露出什麼？',
  init: () => ({ pole: 's', melt: 0, pin: '' }),
  ctrl: s => s.mi <= 1 ? [{ type: 'choice', k: 'pole', label: '觀察', opts: [['n', '北極'], ['s', '南極']] }, { k: 'melt', label: '冰層融化', min: 0, max: 100, step: 10, unit: '%' }] : [],
  view: s => {
    if (s.mi >= 2) return world(pins(LAT, s.pin));
    const n = s.pole === 'n', a = 1 - s.melt / 100;
    return svg(300, 170, `<rect width="300" height="170" class="sky"/>` + (n ? rc(20, 90, 260, 70, 'water') + T(150, 128, '🌊 海洋（北極海）', 'class="plb"') : rc(20, 90, 260, 70, 'rock') + T(150, 128, '⛰️ 陸地（南極大陸）', 'class="plb"')) +
      `<rect x="20" y="40" width="260" height="120" class="ice" opacity="${a}"/>` + (a > 0 ? T(150, 66, '🧊 冰層', 'class="plb"') : '') + T(150, 22, n ? '🐻‍❄️ 北極' : '🐧 南極', 'font-size="14"') + T(262, 164, '想像實驗', 'class="tk"'));
  },
  read: s => s.mi >= 2 ? (LAT.find(o => o.id === s.pin) ? [[LAT.find(o => o.id === s.pin).n, LAT.find(o => o.id === s.pin).f]] : [['提示', '點地圖上的圓點']])
    : [['地點', s.pole === 'n' ? '北極' : '南極'], ['冰層融化', s.melt + '%'], ['冰底下是', s.melt >= 100 ? (s.pole === 'n' ? '海洋' : '陸地') : '（冰還太厚，看不清楚）']],
  tap: (s, id) => { s.pin = id; },
  missions: [
    M('選北極，把冰全部融化，看看底下是什麼', s => { s.pole = 's'; s.melt = 0; }, s => s.pole === 'n' && s.melt === 100, '北極的冰底下是**海洋**（北極海）。北極是**被陸地包圍的海洋**。', s => { s.pole = 'n'; s.melt = 100; }),
    M('換成南極，冰全部融化後底下是什麼？', s => { s.pole = 'n'; s.melt = 0; }, s => s.pole === 's' && s.melt === 100, '南極的冰底下是**陸地**。南極是**被海洋包圍的大陸**。', s => { s.pole = 's'; s.melt = 100; }),
    M('拉丁美洲大多說西班牙語。點出唯一說「葡萄牙語」的大國', s => { s.pin = ''; }, s => s.pin === 'bra', '**巴西**曾被葡萄牙殖民，所以說葡萄牙語；其他大多數國家說西班牙語。', s => { s.pin = 'bra'; }, '南美洲面積最大的國家。'),
    M('點出世界最大的熱帶雨林', s => { s.pin = ''; }, s => s.pin === 'ama', '**亞馬孫河**流域有世界最大的熱帶雨林，有「地球之肺」之稱。', s => { s.pin = 'ama'; })
  ]
};

/* ======================= 地理：臺灣的農業與食品安全 ======================= */
const FOOD = { 主食: { '臺灣米飯': [50, '🍚'], '進口小麥做的麵': [11000, '🍜'] }, 蔬菜: { '當季本地高麗菜': [30, '🥬'], '空運進口蘆筍': [9000, '🌱'] }, 肉: { '本地豬肉': [60, '🥩'], '進口牛肉': [8000, '🐄'] } };
const km = s => FOOD.主食[s.a][0] + FOOD.蔬菜[s.b][0] + FOOD.肉[s.c][0];
const PKG = { name: ['品名', '高麗菜一顆'], price: ['價格', '45 元'], tap: ['產銷履歷（範例）', '產地：雲林縣｜生產者：王小農｜採收：11 月 12 日｜用藥與施肥都有紀錄，可以上網查詢'], date: ['有效日期', '11 月 20 日'] };
const leis = s => s.grow && (s.pick || s.stay);
L.ge9b2 = {
  name: '餐桌食安實驗室', intro: '我們吃的東西從哪裡來？走了多遠？安不安全？一起來調查！',
  init: () => ({ a: '進口小麥做的麵', b: '空運進口蘆筍', c: '進口牛肉', pk: '', grow: true, pick: false, stay: false, whole: true }),
  ctrl: s => s.mi === 0 ? Object.keys(FOOD).map(k => ({ type: 'choice', k: { 主食: 'a', 蔬菜: 'b', 肉: 'c' }[k], label: k, opts: Object.keys(FOOD[k]).map(n => [n, n]) }))
    : s.mi === 2 ? [{ type: 'toggle', k: 'grow', label: '🌱 種植蔬果' }, { type: 'toggle', k: 'pick', label: '🍓 開放採果體驗' }, { type: 'toggle', k: 'stay', label: '🏡 經營農村民宿' }, { type: 'toggle', k: 'whole', label: '🚚 賣給批發商' }] : [],
  view: s => {
    if (s.mi === 1) return `<div class="pkg">${Object.keys(PKG).map(k => `<div class="pk ${k === 'tap' ? 'tapl' : ''} ${s.pk === k ? 'on' : ''}" data-tap="${k}">${k === 'tap' ? '🏷️ TAP 產銷履歷' : k === 'name' ? '🥬 高麗菜' : PKG[k][1]}</div>`).join('')}</div>`;
    if (s.mi === 2) return `<div class="emo big">${s.grow ? '🌱🍓🥬' : '🟫'}${s.pick ? ' 👨‍👩‍👧' : ''}${s.stay ? ' 🏡' : ''}</div><div class="mout">${leis(s) ? '<b>休閒農業</b>' : s.grow ? '一般農業' : '（還沒有開始經營）'}</div>`;
    const k = km(s);
    return `<div class="emo big">${FOOD.主食[s.a][1]}${FOOD.蔬菜[s.b][1]}${FOOD.肉[s.c][1]}</div><div class="incbar"><span>食物里程</span><div class="meter"><i style="width:${Math.min(100, k / 300)}%"></i></div><b>${k.toLocaleString()} 公里</b></div><div class="emo">${'🏭'.repeat(Math.min(10, Math.ceil(k / 3000)))}</div>`;
  },
  read: s => s.mi === 1 ? [PKG[s.pk] || ['提示', '點包裝上的資訊看看']]
    : s.mi === 2 ? [['經營方式', ['grow', 'pick', 'stay', 'whole'].filter(k => s[k]).length ? [s.grow && '種植', s.pick && '採果體驗', s.stay && '民宿', s.whole && '批發'].filter(Boolean).join('＋') : '—'], ['這是', leis(s) ? '休閒農業：結合生產、觀光與體驗' : '一般農業']]
    : [['食物里程', km(s).toLocaleString() + ' 公里（示意）'], ['碳排放', km(s) < 500 ? '很少 👍' : '很多（遠距離運輸很耗能）'], ['本地食材', [s.a === '臺灣米飯', s.b === '當季本地高麗菜', s.c === '本地豬肉'].filter(Boolean).length + ' / 3']],
  tap: (s, id) => { s.pk = id; },
  missions: [
    M('這一餐的食材都是遠方運來的。換食材，讓整餐的食物里程低於 200 公里', s => { s.a = '進口小麥做的麵'; s.b = '空運進口蘆筍'; s.c = '進口牛肉'; }, s => km(s) < 200,
      '選擇**本地、當季**的食材，**食物里程**短、碳排放少。臺灣的**稻米可以自給**，小麥卻大多靠進口。', s => { s.a = '臺灣米飯'; s.b = '當季本地高麗菜'; s.c = '本地豬肉'; }, '三樣都要換。'),
    M('怎麼知道這顆高麗菜是誰種的、用過什麼藥？點包裝上可以追溯來源的地方', s => { s.pk = ''; }, s => s.pk === 'tap', '**產銷履歷**標章可以追溯農產品的生產與運銷過程，提升食品安全。', s => { s.pk = 'tap'; }),
    M('加入 WTO 後進口農產品變多，這座農場想轉型。把它變成「休閒農業」', s => { s.grow = true; s.pick = false; s.stay = false; s.whole = true; }, leis,
      '**休閒農業**結合農業生產、觀光與體驗，例如觀光果園、休閒農場。', s => { s.pick = true; }, '讓遊客也能來農場玩。')
  ]
};

/* ======================= 英語：過去進行式偵探 ======================= */
const TIMES = ['7:00', '7:15', '7:30', '7:45', '8:00', '8:15', '8:30', '8:45', '9:00'];
const WHO = {
  tom: ['🧑', 'Tom', 'was', t => t <= 3 ? ['eating dinner', 'in the kitchen'] : ['watching TV', 'in the living room']],
  amy: ['👧', 'Amy', 'was', t => t <= 5 ? ['reading a book', 'in her room'] : ['taking a shower', 'in the bathroom']],
  tw: ['👦👦', 'the twins', 'were', t => t <= 2 ? ['doing homework', 'in the study'] : ['playing basketball', 'in the yard']]
};
L.en8b1 = {
  name: '花瓶事件偵探社', intro: '客廳的花瓶在 **8:00** 被打破了！拖動時間軸，讀讀看每個人在不同時間「**正在做什麼**」。過去某個時間正在做的事，要用 **was / were + V-ing**。',
  init: () => ({ t: 0, p: '' }),
  ctrl: [{ k: 't', label: '時間', min: 0, max: 8, fmt: t => TIMES[t] + ' p.m.' }],
  view: s => `<div class="alibi">${s.t === 4 ? '<div class="crash">💥 8:00　客廳的花瓶破了！</div>' : ''}${Object.keys(WHO).map(k => { const [e, n, be, f] = WHO[k], [act, place] = f(s.t);
    return `<div class="al ${s.p === k ? 'on' : ''}" data-tap="${k}"><span class="ale">${e}</span><span>At ${TIMES[s.t]}, ${n} <b>${be} ${act}</b> ${place}.</span></div>`; }).join('')}</div>`,
  read: s => [['時間', TIMES[s.t] + ' p.m.'], ['文法', 'was / were + V-ing（過去進行式）']].concat(s.p ? [['你指認的人', WHO[s.p][1]]] : []),
  tap: (s, id) => { s.p = id; },
  missions: [
    M('把時間拉到花瓶破掉的 8:00，讀讀看每個人當時正在做什麼', s => { s.t = 0; s.p = ''; }, s => s.t === 4, '「當時正在做某事」用**過去進行式**：主詞 + **was / were** + V-ing。', s => { s.t = 4; }),
    M('8:00 的時候，誰在客廳？點他', s => { s.t = 4; s.p = ''; }, s => s.p === 'tom', 'Tom **was watching** TV in the living room **when** the vase broke.（when 後面接突然發生的短動作，用過去式）', s => { s.p = 'tom'; }, '找句子裡有 living room 的人。'),
    M('雙胞胎什麼時候「還在寫作業」？把時間拉到那個時候', s => { s.t = 6; s.p = ''; }, s => s.t <= 2, 'The twins **were** doing homework. 主詞是**複數**，所以用 **were**。', s => { s.t = 1; }, '寫作業是 doing homework。')
  ]
};

/* ======================= 英語：會考文法除錯器 ======================= */
L.en9b2 = huntLab('文法除錯器', '每個句子裡都藏著一個會考常見的文法錯誤。**點有虛線的地方**檢查，找出錯的那一個！', [
  { head: '🐞 句子一', m: '這句話有一個錯誤，找出來', say: '**although** 已經表示「雖然」，後面**不能再加 but**。正確：Although he was tired, he kept working.',
    text: '{Although|✓ 雖然…，沒有問題} {he was tired,|✓ 沒有問題} {but|✗ although 和 but 不能一起用，刪掉 but|*} {he kept working.|✓ 沒有問題}' },
  { head: '🐞 句子二', m: '這句話有一個錯誤，找出來', say: '**look forward to** 的 to 是介系詞，後面要接 **V-ing**：I look forward to **seeing** you soon.',
    text: '{I look forward to|✓ 這裡的 to 是介系詞} {see|✗ 介系詞後面要接 V-ing，改成 seeing|*} {you soon.|✓ 沒有問題}' },
  { head: '🐞 句子三', m: '這句話有一個錯誤，找出來', say: '**Neither A nor B** 的動詞要跟**最靠近的主詞**一致。his brothers 是複數，要用 **are**。',
    text: '{Neither Tom nor his brothers|✓ 最靠近動詞的是 his brothers（複數）} {is|✗ his brothers 是複數，要改成 are|*} {at home now.|✓ 沒有問題}' },
  { head: '🐞 句子四', m: '這句話有一個錯誤，找出來', say: '**spend + 時間 + V-ing**：She spent two hours **doing** her homework.（It takes 才是接 to V）',
    text: '{She spent two hours|✓ spend + 時間} {to do|✗ spend 後面要接 V-ing，改成 doing|*} {her homework.|✓ 沒有問題}' }
]);
})(typeof globalThis !== 'undefined' ? globalThis : window);

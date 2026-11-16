// 題庫與課程格式檢查：node scripts/validate.mjs
// 題庫 data/<科目>.json 每題格式：["題目", "正確答案", "錯誤1", "錯誤2", "錯誤3", "正解說明", "錯1原因", "錯2原因", "錯3原因"]
// 課程卡的 chk 格式：["題目", "正解", "錯1", "錯2", "正解說明", "錯1原因", "錯2原因"]
// 課程 data/lessons/<科目>.json：每個單元一份 {ic, hook, cards[], game}
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
export const readJSON = f => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

const isStr = x => typeof x === 'string' && x.trim().length > 0;
const distinct = arr => new Set(arr.map(x => x.trim())).size === arr.length;
const boldOK = s => (s.match(/\*\*/g) || []).length % 2 === 0;

export function checkQuestion(q) {
  if (!Array.isArray(q) || q.length !== 9) return '必須是 9 個欄位的陣列（題目、4 個選項、正解說明、3 個錯誤原因）';
  if (q.some(x => typeof x !== 'string')) return '每個欄位都必須是字串';
  if (q.slice(0, 5).some(x => !x.trim())) return '題目與選項不可空白';
  if (q.slice(5).some(x => !x.trim())) return '正解說明與每個錯誤選項的原因都不可空白';
  if (!distinct(q.slice(1, 5))) return '四個選項不可重複';
  if (q[0].length > 300 || q.slice(1, 5).some(x => x.length > 120)) return '題目或選項過長';
  if (q.slice(5).some(x => x.length > 160)) return '說明過長';
  return null;
}

export function checkLesson(L) {
  const errs = [];
  if (!isStr(L.ic)) errs.push('缺少 ic（單元圖示）');
  if (!isStr(L.hook)) errs.push('缺少 hook（任務故事）');
  if (!Array.isArray(L.cards) || L.cards.length < 3 || L.cards.length > 5) errs.push('cards 必須有 3～5 張');
  else L.cards.forEach((c, i) => {
    const p = `第 ${i + 1} 張卡`;
    if (!isStr(c.e) || !isStr(c.t) || !isStr(c.b)) errs.push(`${p}: 缺少 e / t / b`);
    else if (!boldOK(c.b)) errs.push(`${p}: ** 沒有成對`);
    if (c.flip !== undefined) {
      if (!Array.isArray(c.flip) || c.flip.length < 2 || c.flip.length > 8 || c.flip.some(f => !Array.isArray(f) || f.length !== 2 || !isStr(f[0]) || !isStr(f[1]))) errs.push(`${p}: flip 格式有誤`);
    }
    if (c.chk !== undefined) {
      if (!Array.isArray(c.chk) || c.chk.length !== 7 || c.chk.some(x => !isStr(x))) errs.push(`${p}: chk 必須是 [題目, 正解, 錯1, 錯2, 正解說明, 錯1原因, 錯2原因]`);
      else if (!distinct(c.chk.slice(1, 4))) errs.push(`${p}: chk 選項重複`);
    }
    if (c.chk === undefined && c.flip === undefined) errs.push(`${p}: 至少要有 chk（快問快答）或 flip`);
  });
  const g = L.game;
  if (g !== undefined) {
    if (!g || !['match', 'sort', 'order'].includes(g.type)) errs.push('game.type 必須是 match / sort / order');
    else {
      if (!isStr(g.title)) errs.push('game 缺少 title');
      if (g.type === 'match') {
        const ok = Array.isArray(g.pairs) && g.pairs.length >= 3 && g.pairs.length <= 6 && g.pairs.every(p => Array.isArray(p) && p.length === 2 && isStr(p[0]) && isStr(p[1]));
        if (!ok) errs.push('match.pairs 必須是 3～6 組 [左, 右]');
        else if (!distinct(g.pairs.map(p => p[0])) || !distinct(g.pairs.map(p => p[1]))) errs.push('match 左欄或右欄有重複文字');
      } else if (g.type === 'sort') {
        const b = g.buckets, it = g.items;
        if (!Array.isArray(b) || b.length < 2 || b.length > 4 || b.some(x => !isStr(x))) errs.push('sort.buckets 必須是 2～4 個字串');
        else if (!Array.isArray(it) || it.length < 4 || it.length > 10 || it.some(x => !Array.isArray(x) || !isStr(x[0]) || !Number.isInteger(x[1]) || x[1] < 0 || x[1] >= b.length)) errs.push('sort.items 必須是 4～10 個 [文字, 分類編號]');
        else {
          if (!distinct(it.map(x => x[0]))) errs.push('sort 項目文字重複');
          if (b.some((_, k) => !it.some(x => x[1] === k))) errs.push('sort 有分類沒有任何項目');
        }
      } else if (g.type === 'order') {
        if (!Array.isArray(g.items) || g.items.length < 3 || g.items.length > 10 || g.items.some(x => !isStr(x))) errs.push('order.items 必須是 3～10 個字串');
      }
    }
  }
  return errs;
}

export function validateAll() {
  const errors = [];
  const man = readJSON('manifest.json');
  const ids = new Set();
  let total = 0, lessons = 0;
  for (const s of man.subjects) {
    if (!isStr(s.mascot) || !isStr(s.guide)) errors.push(`${s.id}: manifest 缺少 mascot / guide`);
    let bank;
    try { bank = readJSON(s.file); } catch (e) { errors.push(`${s.file}: 無法解析 (${e.message})`); continue; }
    const unitIds = new Set();
    for (const u of bank.units) {
      if (ids.has(u.id)) errors.push(`${s.file}: 單元代號重複 ${u.id}`);
      ids.add(u.id); unitIds.add(u.id);
      if (![7, 8, 9].includes(u.g) || !['上', '下'].includes(u.s) || !u.t) errors.push(`${u.id}: 年級／學期／標題有誤`);
      const seen = new Set();
      u.q.forEach((q, i) => {
        const err = checkQuestion(q);
        if (err) errors.push(`${u.id} 第 ${i + 1} 題: ${err}`);
        else if (seen.has(q[0])) errors.push(`${u.id} 第 ${i + 1} 題: 題目重複`);
        seen.add(q[0]); total++;
      });
    }
    if (!s.lessons) { errors.push(`${s.id}: manifest 沒有 lessons`); continue; }
    let les;
    try { les = readJSON(s.lessons).lessons; } catch (e) { errors.push(`${s.lessons}: 無法解析 (${e.message})`); continue; }
    for (const uid of Object.keys(les)) {
      if (!unitIds.has(uid)) { errors.push(`${s.lessons}: 找不到對應單元 ${uid}`); continue; }
      checkLesson(les[uid]).forEach(e => errors.push(`${uid}: ${e}`)); lessons++;
    }
    for (const uid of unitIds) if (!les[uid]) errors.push(`${uid}: 缺少互動課程`);
  }
  return { errors, total, units: ids.size, lessons };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { errors, total, units, lessons } = validateAll();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`OK：${units} 個單元、${lessons} 份互動課程、${total} 題，格式全部正確。`);
}

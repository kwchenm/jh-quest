// 題庫格式檢查：node scripts/validate.mjs
// 每題格式：["題目", "正確答案", "錯誤1", "錯誤2", "錯誤3", "解析"]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
export const readJSON = f => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

export function checkQuestion(q) {
  if (!Array.isArray(q) || q.length !== 6) return '必須是 6 個欄位的陣列';
  if (q.some(x => typeof x !== 'string')) return '每個欄位都必須是字串';
  if (q.slice(0, 5).some(x => !x.trim())) return '題目與選項不可空白';
  if (new Set(q.slice(1, 5).map(x => x.trim())).size !== 4) return '四個選項不可重複';
  if (q[0].length > 300 || q.slice(1, 5).some(x => x.length > 120)) return '題目或選項過長';
  return null;
}

export function validateAll() {
  const errors = [];
  const man = readJSON('manifest.json');
  const ids = new Set();
  let total = 0;
  for (const s of man.subjects) {
    let bank;
    try { bank = readJSON(s.file); } catch (e) { errors.push(`${s.file}: 無法解析 (${e.message})`); continue; }
    for (const u of bank.units) {
      if (ids.has(u.id)) errors.push(`${s.file}: 單元代號重複 ${u.id}`);
      ids.add(u.id);
      if (![7, 8, 9].includes(u.g) || !['上', '下'].includes(u.s) || !u.t) errors.push(`${u.id}: 年級／學期／標題有誤`);
      const seen = new Set();
      u.q.forEach((q, i) => {
        const err = checkQuestion(q);
        if (err) errors.push(`${u.id} 第 ${i + 1} 題: ${err}`);
        else if (seen.has(q[0])) errors.push(`${u.id} 第 ${i + 1} 題: 題目重複`);
        seen.add(q[0]); total++;
      });
    }
  }
  return { errors, total, units: ids.size };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { errors, total, units } = validateAll();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`OK：${units} 個單元、${total} 題，格式全部正確。`);
}

// 實驗室自動測試：每個任務「進入時尚未達成」、「套用解法後達成」，且畫面不會出錯
import '../js/labs.js';
import { readJSON } from './validate.mjs';
const L = globalThis.LABS, errs = [];
const man = readJSON('manifest.json');
const units = new Set(man.subjects.flatMap(s => readJSON(s.file).units.map(u => u.id)));
let nm = 0;
for (const id of Object.keys(L)) {
  if (!units.has(id)) errs.push(`${id}: 找不到對應單元`);
  const lab = L[id];
  try {
    const s = lab.init();
    if (!lab.name || !lab.intro || !lab.missions.length) errs.push(`${id}: 缺少 name / intro / missions`);
    lab.missions.forEach((m, i) => {
      nm++; s.mi = i; if (m.set) m.set(s);
      const v = lab.view(s); if (typeof v !== 'string' || !v.length || /NaN|undefined/.test(v)) errs.push(`${id} 任務${i + 1}: view 有 NaN/undefined`);
      (lab.read ? lab.read(s) : []).forEach(r => { if (/NaN|undefined/.test(String(r[0]) + r[1])) errs.push(`${id} 任務${i + 1}: read 有 NaN/undefined → ${r}`); });
      if (m.ok(s)) errs.push(`${id} 任務${i + 1}: 一進入就已經達成`);
      if (!m.sol) { errs.push(`${id} 任務${i + 1}: 沒有 sol`); return; }
      m.sol(s);
      if (!m.ok(s)) errs.push(`${id} 任務${i + 1}: 套用解法後仍未達成`);
      const say = typeof m.say === 'function' ? m.say(s) : m.say; if (!say || /NaN|undefined/.test(say)) errs.push(`${id} 任務${i + 1}: say 有問題`);
      if (typeof m.hint === 'function') m.hint(s);
      lab.view(s); if (lab.read) lab.read(s);
    });
    // 控制項與點擊不會丟出例外
    const t = lab.init(); (lab.ctrl || []).forEach(c => { if (c.type === 'btn') c.run(t); }); lab.view(t);
  } catch (e) { errs.push(`${id}: 例外 ${e.message}`); }
}
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
console.log(`OK：${Object.keys(L).length} 個實驗室、${nm} 個任務全部可完成。`);

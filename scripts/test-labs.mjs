// 實驗室自動測試：每個任務「進入時尚未達成」、「套用解法後達成」，且畫面、控制項都不會出錯
import '../js/labs.js';
import '../js/labs2.js';
import '../js/labs3.js';
import { readJSON } from './validate.mjs';
const L = globalThis.LABS, errs = [];
const man = readJSON('manifest.json');
const units = new Set(man.subjects.flatMap(s => readJSON(s.file).units.map(u => u.id)));
const bad = v => /NaN|undefined|\[object/.test(String(v));
const ctrls = (lab, s) => typeof lab.ctrl === 'function' ? lab.ctrl(s) : (lab.ctrl || []);
let nm = 0;
for (const id of Object.keys(L)) {
  if (!units.has(id)) errs.push(`${id}: 找不到對應單元`);
  const lab = L[id];
  try {
    if (!lab.name || !lab.intro || !lab.missions.length) errs.push(`${id}: 缺少 name / intro / missions`);
    const s = lab.init();
    lab.missions.forEach((m, i) => {
      nm++; s.mi = i; if (m.set) m.set(s);
      const tag = `${id} 任務${i + 1}`;
      if (bad(lab.view(s))) errs.push(`${tag}: view 有 NaN/undefined`);
      (lab.read ? lab.read(s) : []).forEach(r => { if (bad(r[0]) || bad(r[1])) errs.push(`${tag}: read 有問題 → ${r}`); });
      ctrls(lab, s).forEach(c => {
        if (!c.type && (c.min === undefined || c.max === undefined || s[c.k] === undefined)) errs.push(`${tag}: 滑桿 ${c.k} 設定不完整`);
        if (!c.type && c.fmt && bad(c.fmt(s[c.k]))) errs.push(`${tag}: 滑桿 ${c.k} 的 fmt 有問題`);
        if (c.type === 'choice' && s[c.k] !== '' && !c.opts.some(o => o[0] === s[c.k])) errs.push(`${tag}: 選項 ${c.k} 目前的值 ${s[c.k]} 不在選項中`);
      });
      if (m.ok(s)) errs.push(`${tag}: 一進入就已經達成`);
      if (!m.sol) { errs.push(`${tag}: 沒有 sol`); return; }
      m.sol(s);
      if (!m.ok(s)) errs.push(`${tag}: 套用解法後仍未達成`);
      const say = typeof m.say === 'function' ? m.say(s) : m.say; if (!say || bad(say)) errs.push(`${tag}: say 有問題`);
      if (typeof m.hint === 'function') m.hint(s);
      if (bad(lab.view(s))) errs.push(`${tag}: 完成後 view 有問題`);
      if (lab.read) lab.read(s);
    });
    // 按鈕、開關不會丟出例外
    const t = lab.init(); t.mi = 0; if (lab.missions[0].set) lab.missions[0].set(t);
    ctrls(lab, t).forEach(c => { if (c.type === 'btn') c.run(t); if (c.type === 'toggle') { t[c.k] = !t[c.k]; if (c.run) c.run(t); } });
    lab.view(t);
  } catch (e) { errs.push(`${id}: 例外 ${e.message}`); }
}
for (const u of units) if (!L[u]) errs.push(`${u}: 這個單元還沒有實驗室`);
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
console.log(`OK：${Object.keys(L).length} 個實驗室、${nm} 個任務全部可完成。`);

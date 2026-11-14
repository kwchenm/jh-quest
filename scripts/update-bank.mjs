// 每週題庫更新：node scripts/update-bank.mjs
// 流程：① 上網查課綱／各版本／會考動態，規劃要補強的主題
//       ② 為題數最少的單元（與新主題）出新題
//       ③ 由模型在「看不到答案」的情況下重新作答，答案一致且判定無瑕疵的題目才收錄
//       ④ 寫回 data/*.json 並跑格式檢查
// 需要環境變數 ANTHROPIC_API_KEY。可調整：MODEL、UNITS_PER_RUN、QUESTIONS_PER_UNIT、NEW_UNITS。
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, readJSON, checkQuestion, validateAll } from './validate.mjs';

const MODEL = process.env.MODEL || 'claude-opus-5-5';
const UNITS_PER_RUN = +(process.env.UNITS_PER_RUN || 12);
const PER_UNIT = +(process.env.QUESTIONS_PER_UNIT || 5);
const NEW_UNITS = +(process.env.NEW_UNITS || 2);
const MAX_PER_UNIT = 60;                       // 單元題數上限，超過就不再補題
const DRY = process.argv.includes('--dry-run');

const client = new Anthropic();
const CN = { 7: '七', 8: '八', 9: '九' };
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const SYSTEM = `你是臺灣的國中教師與命題委員，熟悉教育部 108 課綱（十二年國教課綱）以及康軒、翰林、南一三個版本的國中教材，也熟悉國中教育會考的命題方向。
你為七到九年級學生編寫四選一的單選題。要求：
- 內容必須是三個版本共通的課綱學習內容，不要考只有單一版本才有的課文或細節。
- 每題只有一個明確正確的答案；三個誘答選項要合理但確定錯誤。不要用「以上皆是」「以上皆非」。
- 事實、數字、法規必須正確且為現行有效；沒有把握的內容不要出。
- 題目用繁體中文與臺灣用語（英語科的題幹用英文、解析用中文）。題目原創，不可抄錄課本、參考書或歷屆試題原文。
- 解析用一到兩句話說明為什麼，讓學生看了能學會概念。
- 數學式用純文字與 Unicode 符號（例如 x²、√2、≤），不要用 LaTeX。`;

/** 呼叫 Claude；拒答時回傳 null。fallbacks 讓安全分類器誤擋時自動改由備援模型回答。 */
async function ask({ prompt, format, tools, effort = 'high' }) {
  const messages = [{ role: 'user', content: prompt }];
  for (let i = 0; i < 6; i++) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: format ? { effort, format } : { effort },
      system: SYSTEM,
      ...(tools ? { tools } : {}),
      messages,
    });
    if (res.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: res.content }); continue; }
    if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') { console.warn('  ⚠ 模型未完成回答：', res.stop_reason); return null; }
    return res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  }
  return null;
}

/* ---------- ① 規劃：查詢最新動態、找出缺少的主題 ---------- */
const PlanSchema = z.object({
  notes: z.string(),
  new_units: z.array(z.object({
    subject: z.string(), grade: z.number().int(), semester: z.enum(['上', '下']),
    title: z.string(), scope: z.string(),
  })),
});
async function plan(subjects, banks) {
  const outline = subjects.map(s => `【${s.name}｜${s.id}】` + banks[s.id].units.map(u => `${CN[u.g]}${u.s} ${u.t}`).join('、')).join('\n');
  const research = await ask({
    effort: 'medium',
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
    prompt: `請上網查詢並用條列整理（300 字以內）：
1. 臺灣國中 108 課綱、康軒／翰林／南一國中教材近期是否有修訂或章節調整。
2. 最近一次國中教育會考各科的命題趨勢與重點。
3. 近期與國中公民、地理、自然科學習內容相關、且已確定的重要時事或法規、數據更新（例如法定年齡、人口統計、國際組織變動）。
只寫查得到來源、確定的資訊；查不到就寫「無」。今天是 ${new Date().toISOString().slice(0, 10)}。`,
  });
  const text = await ask({
    effort: 'medium',
    format: zodOutputFormat(PlanSchema),
    prompt: `以下是目前題庫的單元清單：\n${outline}\n\n以下是剛查到的近期動態：\n${research || '（無）'}\n
請對照 108 課綱國中各科的學習內容，挑出目前清單「尚未涵蓋」且三個版本都會教的重要主題，最多 ${NEW_UNITS} 個，放在 new_units（subject 用上面【】裡的英文代號；grade 為 7、8 或 9；title 為單元名稱；scope 為 15 字內的範圍說明）。
生物只在七年級、理化只在八九年級、地球科學只在九年級。若沒有需要新增的就回傳空陣列。
notes 請寫給命題者看的 200 字內重點提醒（哪些內容近期有更新、命題時要注意什麼）。`,
  });
  return text ? PlanSchema.parse(JSON.parse(text)) : { notes: '', new_units: [] };
}

/* ---------- ② 出題 ---------- */
const GenSchema = z.object({
  questions: z.array(z.object({
    question: z.string(), answer: z.string(), wrong: z.array(z.string()), explanation: z.string(),
  })),
});
async function generate(subject, unit, notes) {
  const text = await ask({
    format: zodOutputFormat(GenSchema),
    prompt: `科目：${subject.name}　年級：${CN[unit.g]}年級${unit.s}學期　單元：${unit.t}（${unit.k || ''}）
${notes ? '近期動態提醒：' + notes + '\n' : ''}
這個單元已經有下列題目，請不要重複相同的考點問法：
${unit.q.map(q => '- ' + q[0]).join('\n') || '（尚無）'}

請再出 ${PER_UNIT} 題新的單選題，涵蓋這個單元中上面還沒考到的重要概念，難度由易到難，其中至少 1 題是需要理解或應用的情境題。
每題的 wrong 必須剛好有 3 個誘答選項。`,
  });
  if (!text) return [];
  return GenSchema.parse(JSON.parse(text)).questions
    .filter(q => q.wrong.length === 3)
    .map(q => [q.question.trim(), q.answer.trim(), ...q.wrong.map(w => w.trim()), q.explanation.trim()]);
}

/* ---------- ③ 盲測驗證 ---------- */
const VerifySchema = z.object({
  results: z.array(z.object({
    index: z.number().int(), choice: z.enum(['A', 'B', 'C', 'D']), sound: z.boolean(), reason: z.string(),
  })),
});
async function verify(subject, unit, qs) {
  if (!qs.length) return [];
  const keyed = qs.map(q => { const opts = shuffle(q.slice(1, 5)); return { q, opts, key: 'ABCD'[opts.indexOf(q[1])] }; });
  const text = await ask({
    format: zodOutputFormat(VerifySchema),
    prompt: `你現在是審題委員。以下是${subject.name}科「${unit.t}」（${CN[unit.g]}年級）的單選題，沒有附答案。
請逐題獨立作答（choice），並判斷題目是否嚴謹（sound）：只有一個正確答案、敘述與事實正確且為現行有效、屬於國中課綱範圍、沒有語病。只要有任何疑慮，sound 就填 false，並在 reason 簡述原因。

${keyed.map((k, i) => `第 ${i} 題：${k.q[0]}\n${k.opts.map((o, j) => 'ABCD'[j] + '. ' + o).join('\n')}`).join('\n\n')}`,
  });
  if (!text) return [];
  const results = VerifySchema.parse(JSON.parse(text)).results;
  return keyed.filter((k, i) => {
    const r = results.find(x => x.index === i);
    const ok = r && r.sound && r.choice === k.key;
    if (!ok) console.log(`  ✗ 淘汰：${k.q[0].slice(0, 30)}…（${r ? r.reason || '答案不一致' : '無審題結果'}）`);
    return ok;
  }).map(k => k.q);
}

/* ---------- 主流程 ---------- */
const man = readJSON('manifest.json');
const banks = Object.fromEntries(man.subjects.map(s => [s.id, readJSON(s.file)]));
const subjectOf = id => man.subjects.find(s => s.id === id);

let notes = '';
try {
  const p = await plan(man.subjects, banks);
  notes = p.notes;
  console.log('規劃重點：', notes || '（無）');
  for (const nu of p.new_units.slice(0, NEW_UNITS)) {
    const bank = banks[nu.subject];
    if (!bank || ![7, 8, 9].includes(nu.grade) || bank.units.some(u => u.t === nu.title)) continue;
    const id = nu.subject.slice(0, 2) + nu.grade + (nu.semester === '上' ? 'a' : 'b') + 'x' + Date.now().toString(36).slice(-4) + bank.units.length;
    bank.units.push({ id, g: nu.grade, s: nu.semester, t: nu.title, k: nu.scope, q: [] });
    bank.units.sort((a, b) => a.g - b.g || a.s.localeCompare(b.s, 'zh-Hant'));
    console.log(`＋ 新單元：${subjectOf(nu.subject).name} ${CN[nu.grade]}${nu.semester} ${nu.title}`);
  }
} catch (e) { console.warn('規劃步驟失敗，略過（不影響補題）：', e.message); }

const targets = man.subjects.flatMap(s => banks[s.id].units.map(u => ({ s, u })))
  .filter(x => x.u.q.length < MAX_PER_UNIT)
  .sort((a, b) => a.u.q.length - b.u.q.length || Math.random() - 0.5)
  .slice(0, UNITS_PER_RUN);

let added = 0;
for (const { s, u } of targets) {
  console.log(`▶ ${s.name}｜${CN[u.g]}${u.s}｜${u.t}（現有 ${u.q.length} 題）`);
  try {
    const have = new Set(u.q.map(q => q[0]));
    const fresh = (await generate(s, u, notes)).filter(q => !checkQuestion(q) && !have.has(q[0]));
    const good = await verify(s, u, fresh);
    u.q.push(...good); added += good.length;
    console.log(`  ✓ 新增 ${good.length} 題`);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) { console.error('API 金鑰無效，停止。'); process.exit(1); }
    console.warn('  ⚠ 這個單元失敗，略過：', e.message);
  }
}

// 沒有題目的新單元不上線
for (const s of man.subjects) banks[s.id].units = banks[s.id].units.filter(u => u.q.length > 0);

if (!added) { console.log('這次沒有新增題目。'); process.exit(0); }
if (DRY) { console.log(`（試跑）本來會新增 ${added} 題，未寫入檔案。`); process.exit(0); }

const stringify = bank => '{"id":' + JSON.stringify(bank.id) + ',"units":[\n' + bank.units.map(u =>
  `{"id":${JSON.stringify(u.id)},"g":${u.g},"s":${JSON.stringify(u.s)},"t":${JSON.stringify(u.t)},"k":${JSON.stringify(u.k || '')},"q":[\n` +
  u.q.map(q => JSON.stringify(q)).join(',\n') + '\n]}').join(',\n') + '\n]}\n';
for (const s of man.subjects) writeFileSync(join(DATA, s.file), stringify(banks[s.id]));
man.updated = new Date().toISOString().slice(0, 10);
writeFileSync(join(DATA, 'manifest.json'), JSON.stringify(man, null, 2) + '\n');

const v = validateAll();
if (v.errors.length) { console.error('格式檢查失敗：\n' + v.errors.join('\n')); process.exit(1); }
console.log(`完成：新增 ${added} 題，題庫共 ${v.total} 題。`);

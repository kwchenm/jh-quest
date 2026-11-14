# 🚀 國中知識星航

國中七～九年級全科闖關學習網站。純靜態網頁（HTML + CSS + JavaScript），不需要建置，直接部署到 GitHub Pages。

## 內容

| 科目 | 年級 | 說明 |
|---|---|---|
| 國文、英語、數學 | 七～九 | 每學期 2 個主題星球 |
| 生物 | 七 | 自然科（七年級） |
| 理化 | 八～九 | 自然科（八、九年級） |
| 地球科學 | 九 | 自然科（九年級） |
| 歷史、地理、公民 | 七～九 | 社會科 |

題目依教育部 **108 課綱**的學習內容分主題編寫，只收康軒、翰林、南一三個版本**共通**的內容，所以不論學校用哪個版本都能練習。各版本章節順序略有不同，請用「年級＋主題名稱」對照課本。

## 玩法

- **星球闖關**：每個主題一顆星球，每次最多 8 題、3 顆愛心，依答對率拿 1～3 顆星。
- **綜合挑戰**：單一科目跨單元隨機 20 題，適合段考、會考前複習。
- **限時衝刺**：60 秒內跨科搶答，挑戰個人紀錄。
- **錯題本**：答錯的題目自動收錄，之後再答對 2 次才會移除。
- **我的進度**：經驗值、等級、連續學習天數；支援多位使用者與備份匯出／匯入。

學習紀錄只存在瀏覽器（localStorage），不會上傳到任何地方。

## 本機執行

```bash
python -m http.server 5173
```

然後開啟 <http://localhost:5173>。（直接雙擊 index.html 無法載入題庫，需要透過本機伺服器。）

## 題庫格式

`data/manifest.json` 列出科目；每科一個檔案 `data/<科目>.json`：

```json
{"id":"ma7a1","g":7,"s":"上","t":"整數與數線","k":"範圍說明","q":[
  ["題目","正確答案","錯誤選項1","錯誤選項2","錯誤選項3","解析"]
]}
```

正確答案固定寫在第 2 欄，遊戲出題時會自動打亂選項順序。手動加題後請執行：

```bash
npm run validate
```

## 每週自動更新題庫

`.github/workflows/weekly-update.yml` 會在**每週日早上 6:00（臺灣時間）**執行 `scripts/update-bank.mjs`：

1. 上網查詢課綱、各版本教材與會考的近期動態，找出題庫還沒涵蓋的主題（每次最多新增 2 個單元）。
2. 為題數最少的 12 個單元各出 5 題新題目。
3. **盲測驗證**：讓模型在看不到答案的情況下重新作答並審題，答案一致且沒有疑慮的題目才收錄。
4. 通過格式檢查後自動提交，並重新部署網站。

### 設定步驟

1. 到 [Claude Console](https://console.anthropic.com/) 建立 API 金鑰。
2. 在 GitHub repo 的 **Settings → Secrets and variables → Actions** 新增 secret：`ANTHROPIC_API_KEY`。
3. （選用）在 Variables 新增 `UNITS_PER_RUN`（每次補題的單元數，預設 12）或 `MODEL`（預設 `claude-opus-5-5`）。
4. 想立刻跑一次：到 **Actions → 每週更新題庫 → Run workflow**。

本機試跑（不寫入檔案）：

```bash
npm install
```

```bash
node scripts/update-bank.mjs --dry-run
```

> 自動產生的題目雖然經過盲測驗證，仍可能有疏漏。發現題目有問題時，直接修改 `data/` 裡對應的那一行即可。

## 部署

推送到 `main` 後，`.github/workflows/pages.yml` 會自動部署到 GitHub Pages（repo 的 **Settings → Pages → Source** 需選擇 **GitHub Actions**）。

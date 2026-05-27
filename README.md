# 允禾桃園辦公室設備需求情報系統

這是一個給影印機、事務機、印表機維修與租賃服務商使用的商機雷達 MVP。系統以桃園為優先市場，從真實公開資料與公開網頁訊號中整理出可能需要 OA / 辦公室設備服務的公司、機關與貼文。

核心原則：

- 不自動留言
- 不自動私訊
- 不登入 Facebook / Threads
- 不使用 mock lead
- 沒有真實 URL 或真實來源不建立資料
- 寧願顯示 unavailable，也不假裝成功
- OpenAI / AI 分析為選配，預設不依賴

## 目前 MVP 功能

- 桃園新成立公司雷達：匯入財政部營業稅籍 ZIP，篩選桃園公司並依行業與成立時間評分。
- 租約成熟度雷達：找出成立 30-48 個月、可能進入 OA 租賃換約期的桃園公司。
- PTT 真實文章雷達：抓取公開 PTT 看板文章。
- 公開搜尋雷達：用公開搜尋結果監控 Threads、Dcard、PTT、Mobile01、Facebook 公開頁。
- 標案雷達：嘗試讀取公開標案來源，抓不到時不產生假資料。
- Signal 後台：S/A/B 分級、收藏、狀態追蹤、一鍵 Google / Maps / 原文連結。

## 技術棧

- Node.js
- TypeScript
- Express
- SQLite
- Prisma ORM
- dotenv
- 原生 HTML / CSS / JavaScript 後台

## 安裝

```bash
npm install
```

## 環境變數

建立 `.env`：

```env
DATABASE_URL="file:./dev.db"
APP_PORT=3000
SCAN_INTERVAL_SECONDS=300

USE_AI_ANALYSIS=false
OPENAI_API_KEY=
ALLOW_MOCK_DATA=false
ALLOW_AUTO_REPLY=false
ALLOW_AUTO_DM=false

COMPANY_OPEN_DATA_ENDPOINT="https://eip.fia.gov.tw/data/BGMOPEN1.zip"
COMPANY_OPEN_DATA_MODE="tax_zip"
COMPANY_OPEN_DATA_LIMIT=200
COMPANY_BASELINE_IMPORT=false

SEARCH_PROVIDER=bing
SEARCH_RESULTS_PER_QUERY=8
MAX_RESULT_AGE_DAYS=90
SEARCH_DELAY_MS=800
```

## 初始化 SQLite

```bash
npm run prisma:migrate
npm run seed
```

## 匯入桃園公司資料

系統優先使用財政部營業稅籍 ZIP：

```text
https://eip.fia.gov.tw/data/BGMOPEN1.zip
```

可自動下載，也可以手動下載後放到：

```text
data/company/BGMOPEN1.zip
```

手動匯入：

```bash
npm run company:import-local
```

重新整理快取：

```bash
npm run company-cache:refresh
```

匯入後會產生 `IMPORT_REPORT.md`，記錄 ZIP hash、解析筆數、桃園筆數與排除原因。

## 啟動後台

```bash
npm run dev
```

開啟：

```text
http://localhost:3000
```

## 掃描

執行全部掃描：

```bash
npm run scan:once
```

後台也提供：

- 掃描全部
- 掃描桃園新公司
- 掃描標案

## 首刷基準模式

第一次匯入大量歷史公司資料時，建議先使用：

```env
COMPANY_BASELINE_IMPORT=true
```

這會建立 CompanyCache，但不會把大量歷史公司灌進正式 Signal。完成基準匯入後，再改回：

```env
COMPANY_BASELINE_IMPORT=false
```

## 資料品質規則

- mock/test 資料不得進正式資料表
- 沒有 URL 的公開網頁不建立 Lead
- 公司資料以統編去重
- Signal 以 `type + url` 去重
- 公司成立日期解析失敗會被排除，不會預設為今天
- ZIP 下載失敗時保留舊 cache，不清空資料

## 來源限制

- Facebook / Threads 不登入、不抓登入後內容，只透過公開搜尋結果。
- 搜尋引擎可能擋爬，失敗時會記錄狀態，不產生假資料。
- 標案來源若 API 無資料或格式變動，會標示 unavailable / no_results。
- Dcard / Mobile01 直接 adapter 尚未視為穩定來源，優先使用公開搜尋結果。

## Git 注意事項

`.gitignore` 已排除：

- `.env`
- `node_modules/`
- `dist/`
- `*.db`
- `data/company/*.zip`
- `tmp/`

不要把 API key、SQLite DB、ZIP 大檔、`node_modules` 推上 GitHub。

## 常用 scripts

```bash
npm run dev
npm run build
npm run start
npm run prisma:migrate
npm run prisma:studio
npm run seed
npm run scan:once
npm run company-cache:refresh
npm run company:import-local
```

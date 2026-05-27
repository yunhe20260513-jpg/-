# 允禾桃園辦公室設備需求情報系統

這是一套給影印機、事務機、印表機維修與租賃商使用的商機雷達 MVP。系統目標不是自動留言，也不是大量爬平台，而是每天整理出少量、真實、值得人工判斷的桃園辦公設備需求訊號。

## 產品原則

- 不自動留言
- 不自動私訊
- 不登入 Facebook / Threads
- 不建立 mock lead
- 沒有真實 URL 或真實來源就不建立資料
- 抓不到資料顯示 `no_result` 或 `unavailable`，不假裝成功
- 搜尋品質優先於平台數量
- OpenAI 可選，預設關閉

## 核心資料源

目前最值得打磨的是：

1. **桃園新公司 / 租約成熟度**
   - 使用財政部全國營業稅籍資料 ZIP 匯入 `CompanyCache`
   - 篩出桃園公司、高文件需求產業、最近成立公司
   - 另外找出成立約 24-72 個月、可能進入 OA 租賃換約期的公司

2. **PTT 真實文章**
   - 抓取 Printer_scan / Office / SOHO
   - 只有命中 OA、影印機、印表機、掃描、租賃等需求才建立 Lead
   - 徵才、外包、短影音小編等非 OA 文章不建立商機，也不產生事務機罐頭回覆

3. **標案雷達**
   - 監控直接需求：影印機、事務機、印表機、掃描器、OA設備、租賃、維護、耗材
   - 監控前置需求：辦公室裝修、行政空間整修、資訊設備、系統整合、教室設備、櫃台設備
   - 前置需求只標記為 B 級觀察，不當成直接成交商機

4. **公開搜尋引擎**
   - 只作補充來源
   - Threads / Facebook / Dcard / Mobile01 不保證每天有資料
   - 沒有效結果時顯示 `no_result`

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

手動下載財政部 ZIP：

```text
https://eip.fia.gov.tw/data/BGMOPEN1.zip
```

放到：

```text
data/company/BGMOPEN1.zip
```

第一次建立歷史基準時建議：

```env
COMPANY_BASELINE_IMPORT=true
```

然後執行：

```bash
npm run company:import-local
```

基準匯入完成後，改回：

```env
COMPANY_BASELINE_IMPORT=false
```

日常更新：

```bash
npm run company-cache:refresh
```

## 啟動後台

```bash
npm run dev
```

開啟：

```text
http://localhost:3000
```

## 手動掃描

```bash
npm run scan:once
```

後台也可以按「重新掃描」。

## 分級邏輯摘要

### PTT / 社群 Lead

先做分類：

- `office_equipment_need`
- `general_business`
- `hiring`
- `outsourcing`
- `unrelated`

只有 `office_equipment_need` 才能建立 Lead。必要條件是命中產品詞或租賃詞，例如影印機、印表機、事務機、掃描、列印、OA、租影印機、事務機租賃。

### 標案

- S 級：影印機 / 事務機 / 多功能事務機 / 租賃 / 維護，且有預算或截止日期
- A 級：印表機 / 掃描器 / 耗材 / 資訊設備 / 辦公設備
- B 級：辦公室裝修 / 行政空間整修 / 教室設備 / 系統整合，標記為前置需求

### 租約成熟度

改為加權計分：

- 成立 30-48 個月：+5
- 成立 24-60 個月：+3
- 成立 60-72 個月：+2
- 高文件需求產業：+5
- 桃園核心區域：+2
- 使用統一發票：+1
- 資本額 > 100 萬：+2
- 同時存在競品抱怨 / 搬遷 / 徵才 / 辦公設備問題：+10

建立條件：

- rawScore >= 7 才建立
- rawScore >= 11 為 S
- rawScore 8-10 為 A
- rawScore 7 為 B

## Adapter 狀態

- `success`：有建立有效資料
- `no_result`：來源可用，但沒有符合條件的有效資料
- `unavailable`：來源不可用或 API 不穩
- `failed`：程式錯誤
- `running`：執行中
- `stale`：執行逾時

## 為什麼不使用 LINE / 自動回覆

第一版重點是「找到值得人工看的名單」。自動留言或私訊容易造成 spam、違反平台規則，也會傷害品牌。系統只提供原文連結、判斷原因、建議動作，由人工決定是否回覆。

## Git 安全

`.gitignore` 會排除：

- `.env`
- `node_modules/`
- `dist/`
- `*.db`
- `data/company/*.zip`
- `tmp/`

不要上傳 API key、SQLite DB、ZIP、node_modules。

## Scripts

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

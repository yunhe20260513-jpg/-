# 允禾桃園辦公室設備需求情報系統

這不是自動留言機器人，也不是帳號農場。這個 MVP 的目標是把真實公開資料整理成可人工開發的商機雷達，優先找出桃園最近新成立、可能需要影印機/事務機/印表機/掃描設備的公司。

系統原則：

- 不自動留言
- 不自動私訊
- 不登入 Facebook / Threads
- 不建立 mock lead
- 不顯示 fake success
- 抓不到真資料就顯示 unavailable / failed / no_results
- OpenAI API 可選，預設不依賴

## 核心 MVP

目前保留的核心功能：

- 桃園新成立公司雷達
- PTT 真實文章雷達
- 搜尋引擎公開搜尋雷達
- 台灣標案雷達，endpoint 不確定時顯示 unavailable
- 租約到期 / 想換廠商雷達
- 競品抱怨雷達
- Signal 後台
- S/A/B 分級
- 收藏與狀態追蹤
- 一鍵 Google 搜尋 / Google Maps / 開原文

## 安裝

```bash
npm install
```

## .env 範例

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
FIA_BUSINESS_REGISTRATION_ENDPOINT="https://eip.fia.gov.tw/OAI/api/businessRegistration"

SEARCH_PROVIDER=bing
SEARCH_RESULTS_PER_QUERY=8
MAX_RESULT_AGE_DAYS=90
SEARCH_DELAY_MS=800
```

## 初始化

```bash
npm run prisma:migrate
npm run seed
```

## 啟動後台

```bash
npm run dev
```

開啟：

```text
http://localhost:3000
```

## 桃園新公司 ZIP

主要來源：

```text
https://eip.fia.gov.tw/data/BGMOPEN1.zip
```

系統會先檢查：

```text
data/company/BGMOPEN1.zip
```

如果本地 ZIP 存在，優先使用本地檔。若不存在，才下載官方 ZIP。

下載 fallback：

1. fetch
2. axios
3. Node https stream

下載後會檢查：

- 檔案存在
- 大小 > 1MB
- ZIP header 正確

解壓使用 `adm-zip`，不依賴 PowerShell，可部署到 Windows、Linux、VPS、Railway、Render。

## 手動匯入 ZIP

如果自動下載失敗，可以手動下載：

```text
https://eip.fia.gov.tw/data/BGMOPEN1.zip
```

放到：

```text
data/company/BGMOPEN1.zip
```

執行：

```bash
npm run company:import-local
```

## 更新 CompanyCache

```bash
npm run company-cache:refresh
```

日常掃描會先看 SQLite cache。若今天已經匯入過，會 skipped，不會每分鐘重抓官方 ZIP。

## 如何確認是真資料

查 CompanyCache 數量：

```bash
npx prisma studio --schema src/prisma/schema.prisma
```

或看後台「桃園新公司雷達」。每筆公司都會有：

- 統編
- 公司/營業人名稱
- 桃園地址
- 行政區
- 設立日期
- 行業
- 資本額
- 組織別
- 是否使用統一發票
- 一鍵 Google
- 一鍵 Google Maps

## 常見錯誤

### fetch failed

代表 Node fetch 下載失敗。系統會改用 axios 與 Node https stream。若三者都失敗，會保留舊 cache。

### ZIP 下載失敗

請手動下載 ZIP 到：

```text
data/company/BGMOPEN1.zip
```

再執行：

```bash
npm run company:import-local
```

### unavailable

代表資料來源目前不可用，系統不會建立假資料。

### no_results

代表來源可用，但這輪沒有符合規則的新資料。

## Git 安全

`.gitignore` 已排除：

- `.env`
- `node_modules/`
- `dist/`
- `*.db`
- `data/company/*.zip`
- `tmp/`

不要把 SQLite DB、ZIP、env、node_modules 上傳到 GitHub。

## scripts

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

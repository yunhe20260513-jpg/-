# PROJECT AUDIT

審查日期：2026-05-26

專案定位：桃園辦公室設備需求情報系統。目標是產出可人工追蹤的真實商機，不做自動留言、不登入社群、不建立 mock lead。

## 1. 已真正完成且可用

### 桃園新成立公司雷達

- 真實來源：財政部全國營業稅籍資料 ZIP。
- URL：`https://eip.fia.gov.tw/data/BGMOPEN1.zip`
- 已實作本地 ZIP 優先：`data/company/BGMOPEN1.zip`
- 已實作下載 fallback：
  - fetch
  - axios
  - Node https stream
- 已移除 PowerShell 下載/解壓依賴。
- 解壓使用 `adm-zip`，可跨平台部署。
- 已檢查 ZIP 大小與 header。
- 已匯入 CompanyCache。
- 已確認真資料：
  - CompanyCache：148,940 筆桃園公司資料
  - Company Signal：200 筆
  - S 級：6 筆
  - A 級：194 筆

### 手動匯入

- script：`npm run company:import-local`
- 作用：讀取 `data/company/BGMOPEN1.zip` 並匯入 SQLite。

### PTT 真實文章雷達

- adapter：`src/adapters/ptt.adapter.ts`
- 來源：
  - `https://www.ptt.cc/bbs/Printer_scan/index.html`
  - `https://www.ptt.cc/bbs/Office/index.html`
  - `https://www.ptt.cc/bbs/SOHO/index.html`
- 有 over18 cookie。
- 無文章時不顯示 fake success。

### 後台

- 已有 Signal 列表。
- 已有桃園新公司區塊。
- 已有收藏、狀態追蹤、開原文 / Google / Google Maps。
- Adapter 狀態會顯示 failed / stale / unavailable，不再只報 success。

## 2. 半成品

### 搜尋引擎公開搜尋雷達

- 目前支援 Bing RSS / Google HTML fallback。
- 真 URL 才會建立資料。
- 問題：搜尋結果品質不穩，容易被搜尋引擎擋或回傳低意圖內容。

### 標案雷達

- 目前仍依賴 `pcc.g0v.ronny.tw` 的猜測 endpoint。
- endpoint 尚未完全確認。
- 無資料時已改成 failed / unavailable，不再 fake tender。

### 租約到期 / 競品抱怨

- 透過搜尋結果監控。
- 有規則評分，但來源仍受搜尋引擎品質影響。

## 3. 空 Adapter

以下直接 adapter 沒有平台 API 或不登入權限，已改為 unavailable，不再回傳空陣列假裝成功：

- Threads direct adapter
- Facebook direct adapter
- Dcard direct adapter
- Mobile01 direct adapter

這些來源只能先走公開搜尋結果。

## 4. Mock / test 資料

- 正式流程不建立 mock lead。
- `ALLOW_MOCK_DATA=false`
- URL 含 `mock` 會被擋。
- SourcePost / Signal 都有去重。

## 5. Unavailable 原因

- 社群平台直接 adapter：不登入、不使用 API，所以不可用。
- 搜尋引擎：可能被擋或沒有符合 URL 條件的結果。
- 標案：endpoint 未確認。
- Company ZIP：若下載失敗，保留舊 cache，可改用手動匯入。

## 6. Endpoint 是否真實

- Company ZIP：真實且已驗證。
- FIA 單筆 API：保留 optional enrich，不作為新公司來源。
- PTT：真實 URL。
- pcc.g0v.ronny.tw：需再確認。
- Google/Bing 搜尋：可用但不穩定。

## 7. 沒有資料或不該假裝完成

- Dcard / Mobile01 / Facebook / Threads direct 抓取不應顯示 success。
- 標案 endpoint 未確認前不應列為穩定來源。
- 搜尋引擎無結果時應顯示 no_results / failed。

## 8. 搜尋品質問題

低品質方向：

- 學生
- 作業
- 家用
- DIY
- 二手
- 超商列印
- 影印店

高品質方向：

- 桃園
- 公司 / 辦公室
- 租約到期
- 合約快到
- 想換廠商
- 維修太慢
- 卡紙
- 掃描不能用
- 求推薦

## 9. 可能誤導使用者的功能

- 空 adapter 顯示 success：已修正。
- 無資料的搜尋顯示 success：已修正。
- Company 開幕搜尋被誤認為新成立公司：已改為稅籍 ZIP。
- 標案 endpoint 未確認卻顯示成功：已改為無資料則 failed。

## 10. 建議延後或刪除

延後：

- 徵才雷達
- Google Maps 自動抓新商家
- AI 分析
- LINE 通知
- Threads/Facebook 登入後抓取

保留：

- 桃園新公司
- PTT
- 高意圖公開搜尋
- 租約到期
- 競品抱怨
- 標案，但 endpoint 確認前不可當主來源

## 11. 真正 MVP 建議

MVP 應以桃園新公司為主：

1. 每日凌晨更新 CompanyCache。
2. 白天只查 SQLite。
3. 高價值公司優先 S 級。
4. 一鍵 Google / Maps。
5. 狀態追蹤與收藏。
6. PTT / 搜尋 / 標案作輔助來源。

## 12. 下一步修復順序

1. 將 CompanyCache 更新排程固定到每天凌晨 3 點。
2. 將標案 endpoint 查清楚，不能猜。
3. 移除或隱藏徵才雷達。
4. 強化搜尋黑名單與查詢品質。
5. 前端 AdapterStatus 中文化。
6. 加上 CompanyCache 最後更新時間與筆數卡片。

## 13. 本輪驗證結果

```json
{
  "companyCacheImported": 148940,
  "companySignalsCreated": 200,
  "gradeCounts": {
    "S": 6,
    "A": 194
  }
}
```

結論：桃園新成立公司雷達已經有真資料，且不依賴 OpenAI、不使用 mock。

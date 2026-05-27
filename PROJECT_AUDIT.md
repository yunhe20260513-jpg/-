# PROJECT AUDIT

最後更新：2026-05-27

## 已完成且可用

- 桃園 CompanyCache：可從財政部營業稅籍 ZIP 匯入桃園公司資料。
- 手動 ZIP 匯入：`npm run company:import-local`。
- 新公司 Signal：依成立時間、行業、資本額、統一發票與地區評分。
- 租約成熟度 Signal：找出成立 30-48 個月、可能接近 OA 租賃換約期的桃園公司。
- 後台：可查看 Signal、標記狀態、收藏、一鍵開 Google / Google Maps / 來源連結。
- PTT adapter：使用公開頁面抓取真實文章。
- 去重：SourcePost / Signal / CompanyCache 都有去重策略。
- 無 mock lead：正式流程不產生假資料。

## 半成品或限制

- 搜尋引擎結果品質受 Bing / Google HTML 變動影響。
- Facebook / Threads 不登入，因此只能依賴公開搜尋結果。
- 標案雷達依賴外部公開 API，若 API 無資料或格式變動會標示 unavailable。
- Dcard / Mobile01 直接抓取不是穩定來源，應繼續走公開搜尋監控。

## 目前最有價值來源

1. 桃園營業稅籍 ZIP：穩定、量大、可建立公司名單。
2. 租約成熟度雷達：從既有公司推估換約期，商業意圖較接近成交。
3. PTT 真實文章：資料少但 URL 清楚。
4. 公開搜尋結果：可補足抱怨、推薦、換廠商訊號，但品質波動較大。
5. 標案：若來源穩定，價值高；目前需保守標示。

## 建議延後

- 登入 Facebook / Threads 抓資料。
- 自動留言或自動私訊。
- 每筆都呼叫 AI。
- 大量新增平台 adapter。

## 下一步優先順序

1. 持續清理舊 adapter 亂碼與不必要來源。
2. 新增 CSV 匯出功能，方便業務追蹤。
3. 強化高價值行業統計，只看診所、補習班、房仲、工程、設計、貿易等。
4. 增加基本測試：CompanyCache 匯入、Signal 建立、Stats API。
5. 在 README 補後台截圖與操作流程。

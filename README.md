# 黑犬星球｜線上日文課與試上申請

`index.html` 沿用黑犬星球的課程介紹，在「試上申請」區嵌入由 `blackdogstarball@gmail.com` 持有的 [Google 表單](https://docs.google.com/forms/d/1XX-zp6f6nSHnF9gbIDkVhrO1rRM33RnPn-nLNTUKqUs/edit)。訪客可免登入填寫電子郵件、程度、學習原因、目標、希望時間、課程期待、得知來源及留言。頁面要求訪客使用 Gmail；Google 表單會驗證電子郵件格式，但不限制網域，因此無法技術上強制只能填 `@gmail.com`。

2026-11-19 更新為奶油色與陶土色的課程頁，加入手繪黑犬 SVG、老師第一人稱介紹與較親切的預約說明。「為什麼想學日文」「學日文的目標」「希望上課的時間」「希望從課程學到什麼」四題皆可複選，並提供可自由輸入的「其他」。

Google 表單的「收集電子郵件地址」設為「由作答者手動輸入」，「傳送表單回覆副本給作答者」設為「一律」。因此每份申請會由 Google 表單自動寄送制式回覆副本。完成訊息使用黑犬指定的感謝文字。沒有開啟「僅限回覆 1 次」或「查看結果摘要」；後者可避免公開其他申請資料。

舊的 Apps Script 程式 `backend/Code.gs` 和 `trial.js` 是未啟用的草稿，不在網頁載入或 Cloudflare Pages 上傳內容中。自訂 Apps Script 沒有取得 Google 權限，也沒有 Web App 部署。

## 部署與成本

正式網站使用 Cloudflare Pages 免費方案的 `blackdog-japanese-lessons.pages.dev` 網址，GitHub 的 `blackdog-trial-draft` 分支保留原始碼。網頁是靜態檔案，可直接上傳 Pages；更改原始碼後須重新部署。Cloudflare Pages 免費方案目前每月 500 次建置、每站 20,000 個檔案、每個檔案最多 25 MiB；靜態請求免費且不限量。Google 表單回覆保存在黑犬帳號的 Google 雲端硬碟中，免費帳號共用 15 GB 空間額度。額度可能變動。

舊 Mio 網站仍在 GitHub Pages 主分支；黑犬課程頁與它是不同網站。老師後台架構待討論。

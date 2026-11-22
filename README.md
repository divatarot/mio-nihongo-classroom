# 黑犬星球｜線上日文課與試上申請

`index.html` 沿用黑犬星球的課程介紹，在「試上申請」區嵌入[公開填寫的 Google 表單](https://docs.google.com/forms/d/e/1FAIpQLSebP49dSdqlEI1WH5Nd7KZwYuxhdrafJ_IhHvDjGUvb2KHJDQ/viewform)。訪客可免登入填寫電子郵件、程度、學習原因、目標、希望時間、課程期待、得知來源及留言。頁面要求訪客使用 Gmail；Google 表單會驗證電子郵件格式，但不限制網域，因此無法技術上強制只能填 `@gmail.com`。

2026-11-21 以黑犬老師提供的《學日文大小事》教學形象插畫取代首頁黑狗吉祥物，讓 Podcast 聽眾立即認出老師與節目。首頁明列線上 1 對 1、程度範圍、60 分鐘參考價及免費試上內容，補上老師背景和 Podcast 連結。形象圖壓縮為 `blackdog-teacher.jpg`，網站用它作主視覺與分享預覽圖。2026-11-19 已將「為什麼想學日文」「學日文的目標」「希望上課的時間」「希望從課程學到什麼」四題設為可複選，並提供可自由輸入的「其他」。

Google 表單的「收集電子郵件地址」設為「由作答者手動輸入」，「傳送表單回覆副本給作答者」設為「一律」。因此每份申請會由 Google 表單自動寄送制式回覆副本。完成訊息使用黑犬指定的感謝文字。沒有開啟「僅限回覆 1 次」或「查看結果摘要」；後者可避免公開其他申請資料。

舊的 Apps Script 程式 `backend/Code.gs` 和 `trial.js` 是未啟用的草稿，不在網頁載入或 Cloudflare Pages 上傳內容中。自訂 Apps Script 沒有取得 Google 權限，也沒有 Web App 部署。

## 網站數據

Google Analytics 4 資源「黑犬星球｜日文課網站」的網站串流使用評估 ID `G-RDD6QKRP00`。頁面瀏覽及平均參與時間由 GA4 統計；站內導覽、試上按鈕、Podcast 連結及另開表單連結使用 `data-ga-event` 自訂點擊事件。試上區首次進入畫面時會送出 `view_trial_section`。首頁設定的 Google 信號及廣告個人化旗標均關閉。

報表可在 Analytics 的「報表」查看瀏覽、參與度及事件。Podcast 單集說明建議使用 `https://blackdog-japanese-lessons.pages.dev/?utm_source=firstory&utm_medium=podcast&utm_campaign=trial_lesson`，以便區分來自節目的流量。GA4 的平均參與時間是頁面在前景獲得使用者參與的時間，並非純粹開著分頁的時間。

Google 表單嵌入於跨網域 iframe，網站的 GA4 無法可靠知道訪客是否在 iframe 內送出。`view_trial_section` 及 `click_external_form` 只代表看見申請區與點擊另開表單，不等於完成申請；實際提交數請以 Google 表單的回覆數為準。分析工具不傳送表單填答內容。數據從新版部署後開始累積，不會回填歷史瀏覽。

## 學員專區

`student.html` 是學員入口。試上申請仍可免登入填寫；學員專區使用 Google 登入。第一次登入的學員按「送出開通申請」，黑犬老師以 `blackdogstarball@gmail.com` 登入後，在同一頁核准帳號並填入下次上課時間、目前進度、老師留言、作業與教材連結。老師可取消「允許這位學員查看」以暫停存取。已核准學員只會載入以自己 Firebase UID 命名的一份課程資料。

資料保存在獨立的 Firebase 專案 `blackdog-student-portal`，Cloud Firestore 位於台灣 `asia-east1`。Google 是目前唯一啟用的登入方式，登入狀態只在同一瀏覽器工作階段保留。`firebase/blackdog.rules` 是正式資料庫規則的原始碼：未登入者無法讀寫；一般 Google 帳號只能建立、讀取自己的開通申請；只有老師帳號可列出申請和學員資料並編輯課程；學員只能讀取自己且已開通的課程文件。其他路徑全部拒絕。網站前端不放老師密鑰，頁面不載入 GA4、不索引，學員內容使用純文字顯示，教材只接受 HTTPS 連結。Firebase 網頁設定值是公開識別資訊，權限由伺服器端的 Firestore 規則決定。

不要把個資、會議密碼或不打算讓學員再分享的檔案放在「教材連結」；連結指向的 Google Drive 等外部檔案仍需各自設定分享權限。首頁的試上 Google 表單與學員資料庫是分開的。免費 Spark 方案不提供 Firestore 自動備份，老師應定期匯出重要課程紀錄。

## 部署與成本

正式網站使用 Cloudflare Pages 免費方案的 `blackdog-japanese-lessons.pages.dev` 網址，GitHub 的 `blackdog-trial-draft` 分支保留原始碼。網頁是靜態檔案，可直接上傳 Pages；更改原始碼後須重新部署。Cloudflare Pages 免費方案目前每月 500 次建置、每站 20,000 個檔案、每個檔案最多 25 MiB；靜態請求免費且不限量。Google 表單回覆保存在黑犬帳號的 Google 雲端硬碟中，免費帳號共用 15 GB 空間額度。額度可能變動。

舊 Mio 網站仍在 GitHub Pages 主分支；黑犬課程頁與它是不同網站。

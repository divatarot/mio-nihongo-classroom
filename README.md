# 黑犬星球｜線上日文課與試上申請

`index.html` 沿用黑犬星球的課程介紹，加入網站內的免登入試上表單。訪客填寫 Gmail、程度、學習原因、目標、希望時間、課程期待、得知來源及留言。`trial.js` 檢查 Gmail 格式與其他來源欄位；伺服器仍需獨立驗證。

## 表單後端

`backend/Code.gs` 由 `blackdogstarball@gmail.com` 持有。它會把申請寫入該帳號的 Google 試算表，並寄一封確認信給申請者。Apps Script Web App 設為「以我執行」及「任何人」可存取，訪客才不用登入。第一次部署前由擁有者執行 `setup()`，建立試算表及授權寄信；部署後把 `/exec` 網址填入 `trial.js` 的 `TRIAL_ENDPOINT`，再發布網頁。

目前程式只會處理表單欄位與寄信，不讀取收件匣。它包含欄位驗證、隱藏欄位、同一信箱 10 分鐘內重複提交限制，以及每日 50 筆申請上限；公開表單仍可能受到垃圾申請影響，應定期檢查試算表與 Apps Script 執行紀錄。Google 授權會賦予這支腳本寫入試算表及以該帳號寄信的能力，應保護 Google 帳號及腳本編輯權限。

## 部署與成本

目前 GitHub 倉庫是 `divatarot/mio-nihongo-classroom`，舊的 Firebase 登入與 Firestore 檔案仍保留作為早期版本；新版公開頁不載入它們，也不把新申請寫入 Firestore。老師後台架構待討論。

正式網站使用 Cloudflare Pages 免費方案的 `blackdog-japanese-lessons.pages.dev` 網址，GitHub 的 `blackdog-trial-draft` 分支保留原始碼。網頁是靜態檔案，可直接上傳 Pages；更改原始碼後須重新部署。Cloudflare Pages 免費方案目前每月 500 次建置、每站 20,000 個檔案、每個檔案最多 25 MiB；靜態請求免費且不限量。Apps Script 消費者帳號的 MailApp 額度目前為每天 100 位收件者；本程式另設每日最多 50 筆申請，每份成功申請寄給學生一位收件者，未包含老師通知信。額度可能變動。

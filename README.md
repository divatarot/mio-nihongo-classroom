# Mio 日文教室 — GitHub Pages 版

這是可放在 GitHub Pages 的靜態前端。學生與老師的電子郵件登入、試上申請、申請進度和老師回覆使用 Firebase Authentication 與 Cloud Firestore。老師後台目前只有申請查看與回覆，其他流程待討論。原 Sites 版的課程紀錄和教材檔案尚未移轉，兩邊資料不會自動同步。

## 免費方案設定

1. 建立公開 GitHub 儲存庫 `mio-nihongo-classroom`，將本資料夾內容放在預設分支根目錄。在儲存庫 Settings → Pages 選擇從 `main` 分支根目錄發布。GitHub Free 的 Pages 需要公開儲存庫。
2. 建立 Firebase Spark 專案，加入 Web App，並啟用 Authentication 的 Email/Password 登入方式。在 Authentication → Settings → Authorized domains 加入 `divatarot.github.io`（若 GitHub 帳號不同，請替換）。
3. 建立 Cloud Firestore 資料庫，將 `firebase/firestore.rules` 貼到 Firestore Rules 並發布。請勿使用「測試模式」的開放規則上線。
4. 將 Firebase Web App 的 `apiKey`、`authDomain`、`projectId`、`appId` 填入 `config.js`。這些是公開的 Web App 設定值；不要放入服務帳號私鑰。
5. 老師先在網站註冊並完成信箱驗證。從 Firebase Authentication 使用者列表複製老師的 UID，再由 Firestore Console 建立 `teachers/{UID}` 文件，欄位可以留空。只有資料庫管理者可建立老師資格，訪客無法自行升級。
6. 用兩個不同帳號檢查：學生只看得到自己的申請，老師看得到所有申請且能回覆。

GitHub Pages、Firebase Authentication 與 Cloud Firestore 均有免費額度與使用限制；請在正式招生前確認當時的方案條件。本站的表單資料存放在 Firestore，不會提交到 GitHub。

## 安全範圍

`firebase/firestore.rules` 要求已驗證電子郵件，依登入者 UID 限制學生資料。老師角色由 Firestore 的 `teachers` 文件指定。前端的顯示狀態不代替資料庫規則。這個 GitHub Pages 版不會讀取原 Sites 資料庫，也不會自動同步舊資料。

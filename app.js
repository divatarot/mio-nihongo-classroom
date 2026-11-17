const $ = (selector) => document.querySelector(selector);
const config = window.MIO_CONFIG || {};
const configured = !!(config.apiKey && config.authDomain && config.projectId && config.appId);
const state = { auth: null, db: null, firebaseAuth: null, firestore: null, user: null, teacher: false };
const authDialog = $("#auth-dialog");
const authForm = $("#auth-form");
const applyForm = $("#apply-form");

function showMessage(target, text, error = false) {
  target.textContent = text; target.classList.toggle("error", error); target.hidden = false;
}
function clearMessage(target) { target.hidden = true; target.textContent = ""; }
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function field(label, value) {
  const item = make("div", "");
  item.append(make("strong", "", label), document.createTextNode(" " + (value || "—")));
  return item;
}
function formatTime(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.valueOf()) ? new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(date) : "剛剛";
}
function planLabel(value) { return ({ trial: "試上＆程度評估", weekly: "固定一對一", topic: "主題客製課" })[value] || value; }
function openAuth() {
  if (!configured) { showMessage($("#apply-message"), "登入服務正在設定，請稍後再試。", true); location.hash = "apply"; return; }
  clearMessage($("#auth-message")); authDialog.showModal();
}
$("#auth-open").addEventListener("click", openAuth);
document.querySelectorAll("[data-open-auth]").forEach((node) => node.addEventListener("click", openAuth));
$("#sign-out").addEventListener("click", async () => {
  try { await state.firebaseAuth.signOut(state.auth); }
  catch { showMessage($("#apply-message"), "登出失敗，請稍後再試。", true); }
});
applyForm.elements.applicant_role.addEventListener("change", () => {
  const guardian = applyForm.elements.applicant_role.value === "家長代填";
  $("#guardian-field").hidden = !guardian; applyForm.elements.guardian_name.required = guardian;
});

async function refreshSession(user) {
  state.user = user;
  state.teacher = false;
  const verified = !!user?.emailVerified;
  if (verified) {
    try {
      const membership = await state.firestore.getDoc(state.firestore.doc(state.db, "teachers", user.uid));
      state.teacher = membership.exists();
    } catch { showMessage($("#apply-message"), "目前無法確認帳號權限，請稍後重試。", true); }
  }
  $("#account-label").textContent = user?.email || "";
  $("#auth-open").hidden = !!user;
  $("#sign-out").hidden = !user;
  applyForm.hidden = !verified;
  $("#apply-locked").hidden = verified;
  $("#teacher-link").hidden = !state.teacher;
  $("#teacher").hidden = !state.teacher;
  if (!verified) {
    const locked = $("#apply-locked");
    if (user) {
      locked.replaceChildren(make("h3", "", "請先驗證電子郵件"), make("p", "", "驗證信已寄到你的信箱。完成驗證後，按下方按鈕繼續。"));
      const refresh = make("button", "button primary", "已驗證，重新檢查"); refresh.type = "button";
      refresh.addEventListener("click", async () => {
        try { await state.firebaseAuth.reload(user); await user.getIdToken(true); await refreshSession(state.auth.currentUser); }
        catch { showMessage($("#apply-message"), "驗證狀態暫時無法更新。", true); }
      });
      locked.append(refresh);
    } else {
      locked.replaceChildren(make("h3", "", "先登入，再告訴我們你的學習目標"), make("p", "", "使用電子郵件註冊或登入後，即可安全保存申請。"));
      const open = make("button", "button primary", "登入／註冊"); open.type = "button";
      open.addEventListener("click", openAuth); locked.append(open);
    }
  }
  if (!user || !verified) {
    $("#mine-content").className = "card empty-state";
    $("#mine-content").textContent = user ? "驗證電子郵件後即可查看你的申請。" : "登入後查看你的申請。";
    $("#teacher-content").textContent = "";
    return;
  }
  await Promise.all([loadMine(), state.teacher ? loadTeacher() : Promise.resolve()]);
}
function applicationCard(row, id, forTeacher = false) {
  const card = make("article", "card application");
  const heading = make("div", "application-head");
  const title = make("div");
  title.append(make("h3", "", row.studentName), make("small", "", formatTime(row.createdAt)));
  heading.append(title, make("span", "status", row.status)); card.append(heading);
  const details = make("div", "application-grid");
  details.append(field("程度", row.level), field("方向", row.direction), field("課程", planLabel(row.plan)), field("方便上課時間", row.availability));
  if (forTeacher) details.append(field("帳號信箱", row.accountEmail), field("聯絡方式", row.contact), field("申請身分", row.applicantRole), field("家長稱呼", row.guardianName));
  card.append(details, make("p", "goal", "學習目標：" + row.goal));
  if (row.teacherReply) card.append(make("div", "reply", "老師回覆：" + row.teacherReply));
  if (forTeacher) {
    const controls = make("form", "teacher-controls");
    const statusLabel = make("label", "", "狀態");
    const select = make("select", "");
    ["待回覆", "已聯繫", "等待學員回覆", "已確認"].forEach((status) => { const option = make("option", "", status); option.value = status; select.append(option); });
    select.value = row.status; statusLabel.append(select);
    const replyLabel = make("label", "", "回覆學生");
    const textarea = make("textarea", ""); textarea.maxLength = 2500; textarea.value = row.teacherReply || ""; replyLabel.append(textarea);
    const save = make("button", "button primary", "儲存回覆"); save.type = "submit";
    controls.append(statusLabel, replyLabel, save);
    controls.addEventListener("submit", async (event) => {
      event.preventDefault(); save.disabled = true;
      try {
        await state.firestore.updateDoc(state.firestore.doc(state.db, "applications", id), {
          status: select.value, teacherReply: textarea.value.trim(), updatedAt: state.firestore.serverTimestamp()
        });
        await loadTeacher();
      } catch { showMessage($("#apply-message"), "回覆儲存失敗，請稍後再試。", true); }
      finally { save.disabled = false; }
    });
    card.append(controls);
  }
  return card;
}
async function loadMine() {
  const target = $("#mine-content");
  try {
    const q = state.firestore.query(state.firestore.collection(state.db, "applications"), state.firestore.where("ownerId", "==", state.user.uid));
    const snapshot = await state.firestore.getDocs(q);
    const rows = snapshot.docs.map((item) => ({ id: item.id, data: item.data() })).sort((a, b) => (b.data.createdAt?.seconds || 0) - (a.data.createdAt?.seconds || 0));
    if (!rows.length) { target.className = "card empty-state"; target.textContent = "還沒有試上申請。填寫上方表單後，進度會顯示在這裡。"; return; }
    target.className = "application-list"; target.replaceChildren(...rows.map((item) => applicationCard(item.data, item.id)));
  } catch { target.className = "card empty-state"; target.textContent = "目前無法載入申請，請稍後再試。"; }
}
async function loadTeacher() {
  const target = $("#teacher-content");
  try {
    const snapshot = await state.firestore.getDocs(state.firestore.collection(state.db, "applications"));
    const rows = snapshot.docs.map((item) => ({ id: item.id, data: item.data() })).sort((a, b) => (b.data.createdAt?.seconds || 0) - (a.data.createdAt?.seconds || 0));
    if (!rows.length) { target.className = "card empty-state"; target.textContent = "目前沒有試上申請。"; return; }
    target.className = "application-list"; target.replaceChildren(...rows.map((item) => applicationCard(item.data, item.id, true)));
  } catch { target.className = "card empty-state"; target.textContent = "目前無法載入申請，請稍後再試。"; }
}
applyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.user?.emailVerified) { openAuth(); return; }
  const submit = $("#apply-submit"); submit.disabled = true; clearMessage($("#apply-message"));
  const form = new FormData(applyForm);
  const payload = {
    ownerId: state.user.uid, accountEmail: state.user.email,
    studentName: String(form.get("student_name") || "").trim(), applicantRole: String(form.get("applicant_role") || ""),
    guardianName: String(form.get("guardian_name") || "").trim(), contact: String(form.get("contact") || "").trim(),
    level: String(form.get("level") || ""), direction: String(form.get("direction") || ""), plan: String(form.get("plan") || ""),
    goal: String(form.get("goal") || "").trim(), availability: String(form.get("availability") || "").trim(),
    status: "待回覆", teacherReply: "", createdAt: state.firestore.serverTimestamp(), updatedAt: state.firestore.serverTimestamp()
  };
  if (!payload.studentName || !payload.contact || !payload.goal || !payload.availability || (payload.applicantRole === "家長代填" && !payload.guardianName)) {
    showMessage($("#apply-message"), "請填寫所有必填欄位。", true); submit.disabled = false; return;
  }
  try {
    await state.firestore.addDoc(state.firestore.collection(state.db, "applications"), payload);
    applyForm.reset(); $("#guardian-field").hidden = true; applyForm.elements.guardian_name.required = false;
    showMessage($("#apply-message"), "試上申請已收到。你可以在「我的課程」查看進度。");
    await Promise.all([loadMine(), state.teacher ? loadTeacher() : Promise.resolve()]);
  } catch { showMessage($("#apply-message"), "申請送出失敗，請稍後再試。", true); }
  finally { submit.disabled = false; }
});
async function handleAuth(action) {
  if (!state.auth) return;
  const email = authForm.elements.email.value.trim(); const password = authForm.elements.password.value;
  if (!email || password.length < 8) { showMessage($("#auth-message"), "請填入電子郵件與至少 8 碼的密碼。", true); return; }
  const buttons = authForm.querySelectorAll("button"); buttons.forEach((button) => button.disabled = true);
  clearMessage($("#auth-message"));
  try {
    if (action === "signup") {
      const result = await state.firebaseAuth.createUserWithEmailAndPassword(state.auth, email, password);
      await state.firebaseAuth.sendEmailVerification(result.user);
      showMessage($("#auth-message"), "驗證信已寄出。請完成驗證後回到網站。 ");
    } else {
      await state.firebaseAuth.signInWithEmailAndPassword(state.auth, email, password);
      authDialog.close(); authForm.reset();
    }
  } catch { showMessage($("#auth-message"), action === "signup" ? "註冊或寄送驗證信失敗，請確認信箱後再試。" : "登入失敗，請確認信箱與密碼。", true); }
  finally { buttons.forEach((button) => button.disabled = false); }
}
authForm.addEventListener("submit", (event) => { event.preventDefault(); void handleAuth("signin"); });
authForm.querySelector('[data-auth-action="signup"]').addEventListener("click", () => { if (authForm.reportValidity()) void handleAuth("signup"); });

if (configured) {
  Promise.all([
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js")
  ]).then(([app, auth, firestore]) => {
    state.firebaseAuth = auth; state.firestore = firestore;
    const instance = app.initializeApp(config);
    state.auth = auth.getAuth(instance); state.db = firestore.getFirestore(instance);
    auth.onAuthStateChanged(state.auth, (user) => { void refreshSession(user); });
  }).catch(() => showMessage($("#apply-message"), "登入服務暫時無法載入，請稍後再試。", true));
} else showMessage($("#apply-message"), "登入與資料庫服務正在設定。", true);

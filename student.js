import { firebaseConfig } from './student-config.js';

const $ = (selector) => document.querySelector(selector);
const state = { auth: null, db: null, sdk: null, user: null };
const teacherEmail = 'blackdogstarball@gmail.com';
const portalMode = document.body.dataset.portal;

function setMessage(text = '', error = false) {
  const message = $('#portal-message');
  message.textContent = text;
  message.classList.toggle('error', error);
}

function showOnly(id) {
  for (const view of ['signed-out', 'pending-view', 'student-view', 'teacher-view']) {
    $(`#${view}`).hidden = view !== id;
  }
}

function isTeacher(user) {
  return user?.emailVerified && user.email?.toLowerCase() === teacherEmail
    && user.providerData.some((provider) => provider.providerId === 'google.com');
}

function safeMaterials(raw) {
  const items = [];
  for (const line of String(raw || '').split(/\r?\n/).slice(0, 8)) {
    const parts = line.split('|');
    const label = parts.length > 1 ? parts.slice(0, -1).join('|').trim() : '';
    const address = (parts.length > 1 ? parts.at(-1) : line).trim();
    try {
      const url = new URL(address);
      if (url.protocol === 'https:') {
        items.push({ label: label || url.hostname, url: url.href });
      }
    } catch { /* Ignore malformed links instead of showing an unsafe target. */ }
  }
  return items;
}

function materialList(raw) {
  const list = document.createElement('ul');
  for (const item of safeMaterials(raw)) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = item.label;
    li.append(link);
    list.append(li);
  }
  return list;
}

function lessonCard(data) {
  const card = document.createElement('article');
  card.className = 'paper lesson-card';
  const date = document.createElement('p');
  date.className = 'card-kicker';
  date.textContent = data.date || '課堂紀錄';
  card.append(date);
  for (const [label, value] of [
    ['這堂課', data.content],
    ['老師的觀察', data.feedback],
    ['下次一起練習', data.nextTopic]
  ]) {
    if (!value) continue;
    const heading = document.createElement('h4');
    heading.textContent = label;
    const body = document.createElement('p');
    body.className = 'preserve-lines';
    body.textContent = value;
    card.append(heading, body);
  }
  const links = materialList(data.materials);
  if (links.childElementCount) {
    const heading = document.createElement('h4');
    heading.textContent = '這堂課的教材';
    card.append(heading, links);
  }
  return card;
}

async function renderLessons(uid, target) {
  const { collection, getDocs } = state.sdk.firestore;
  const records = await getDocs(collection(state.db, 'students', uid, 'lessons'));
  const sorted = records.docs.map((item) => item.data())
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  target.replaceChildren(...sorted.map(lessonCard));
  if (!sorted.length) target.textContent = '老師還沒有加入課堂紀錄。';
}

function renderStudent(data) {
  $('#student-name').textContent = data.name || state.user.displayName || '同學';
  $('#next-lesson').textContent = data.nextLesson || '還沒安排下次上課時間';
  $('#progress').textContent = data.progress || '老師正在整理你的學習進度。';
  $('#teacher-note').textContent = data.teacherNote || '這裡會放老師想告訴你的話。';
  $('#homework').textContent = data.homework || '目前沒有指定練習，先照自己的步調複習就好。';
  const list = $('#materials');
  list.replaceChildren();
  const links = safeMaterials(data.materials);
  if (!links.length) {
    const empty = document.createElement('li');
    empty.textContent = '老師還沒有放教材連結。';
    list.append(empty);
  }
  for (const item of links) {
    const li = document.createElement('li');
    const anchor = document.createElement('a');
    anchor.href = item.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = item.label;
    li.append(anchor);
    list.append(li);
  }
  showOnly('student-view');
  setMessage('');
}

async function showPending() {
  const { doc, getDoc } = state.sdk.firestore;
  const request = await getDoc(doc(state.db, 'accessRequests', state.user.uid));
  const status = request.exists() ? request.data().status : null;
  $('#account-email').textContent = state.user.email || '';
  $('#request-access').hidden = Boolean(status);
  $('#pending-copy').textContent = status === 'pending'
    ? '開通申請已送出。黑犬老師確認後，重新進入這一頁就能查看自己的課程內容。'
    : status === 'approved'
      ? '你的課程頁目前尚未開通或權限已暫停，請聯繫黑犬老師確認。'
      : status === 'denied'
        ? '這個帳號目前未開通或權限已暫停。如有疑問，請聯繫黑犬老師確認。'
        : '登入成功後，請按下方按鈕，讓黑犬老師知道你想開通學員專區。';
  showOnly('pending-view');
  setMessage('');
}

async function loadStudent() {
  const { doc, getDoc } = state.sdk.firestore;
  try {
    const student = await getDoc(doc(state.db, 'students', state.user.uid));
    if (student.exists() && student.data().active === true) {
      renderStudent(student.data());
      try { await renderLessons(state.user.uid, $('#lesson-list')); }
      catch { $('#lesson-list').textContent = '課堂紀錄暫時無法載入，請稍後再試。'; }
      return;
    }
  } catch (error) {
    if (error.code !== 'permission-denied') {
      setMessage('目前無法確認課程資料，請稍後再試。', true);
      return;
    }
  }
  try { await showPending(); }
  catch { setMessage('目前無法確認開通狀態，請稍後再試。', true); }
}

function makeField(label, key, value, options = {}) {
  const wrapper = document.createElement('label');
  wrapper.className = `field${options.full ? ' full' : ''}`;
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = options.multiline ? document.createElement('textarea') : document.createElement('input');
  input.name = key;
  input.value = value || '';
  input.maxLength = options.max || 4000;
  wrapper.append(caption, input);
  if (options.help) {
    const help = document.createElement('span');
    help.className = 'helper';
    help.textContent = options.help;
    wrapper.append(help);
  }
  return wrapper;
}

function teacherStudentCard(id, data) {
  const card = document.createElement('article');
  card.className = 'student-editor';
  const title = document.createElement('strong');
  title.textContent = data.name || '未填稱呼';
  const email = document.createElement('small');
  email.textContent = data.email;
  const form = document.createElement('form');
  form.append(
    makeField('學員稱呼', 'name', data.name, { max: 80 }),
    makeField('下次上課時間（台灣時間）', 'nextLesson', data.nextLesson, { max: 160, help: '例如：11/30（一）19:00；尚未確認可留空。' }),
    makeField('目前進度', 'progress', data.progress, { full: true, multiline: true }),
    makeField('老師留言', 'teacherNote', data.teacherNote, { full: true, multiline: true }),
    makeField('作業與練習', 'homework', data.homework, { full: true, multiline: true }),
    makeField('教材連結', 'materials', data.materials, { full: true, multiline: true, help: '每行一筆：教材名稱 | https://連結；最多顯示 8 筆。' })
  );
  const actions = document.createElement('div');
  actions.className = 'editor-actions';
  const activeLabel = document.createElement('label');
  const active = document.createElement('input');
  active.type = 'checkbox';
  active.name = 'active';
  active.checked = data.active === true;
  activeLabel.append(active, document.createTextNode('允許這位學員查看自己的課程頁'));
  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'primary-button';
  save.textContent = '儲存課程資料';
  actions.append(activeLabel, save);
  form.append(actions);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    save.disabled = true;
    const values = new FormData(form);
    try {
      await state.sdk.firestore.updateDoc(state.sdk.firestore.doc(state.db, 'students', id), {
        name: String(values.get('name') || '').trim(),
        nextLesson: String(values.get('nextLesson') || '').trim(),
        progress: String(values.get('progress') || '').trim(),
        teacherNote: String(values.get('teacherNote') || '').trim(),
        homework: String(values.get('homework') || '').trim(),
        materials: String(values.get('materials') || '').trim(),
        active: active.checked,
        updatedAt: state.sdk.firestore.serverTimestamp()
      });
      setMessage('已儲存這位學員的課程資料。');
      await loadTeacher();
    } catch { setMessage('儲存失敗，請稍後再試。', true); }
    finally { save.disabled = false; }
  });
  const lessonHeading = document.createElement('h4');
  lessonHeading.textContent = '新增一堂課';
  const lessonForm = document.createElement('form');
  lessonForm.className = 'lesson-editor';
  lessonForm.append(
    makeField('上課日期', 'date', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }), { max: 10 }),
    makeField('這堂課做了什麼', 'content', '', { full: true, multiline: true }),
    makeField('老師的觀察與鼓勵', 'feedback', '', { full: true, multiline: true }),
    makeField('下次一起練習', 'nextTopic', '', { full: true, multiline: true }),
    makeField('這堂課的教材', 'materials', '', { full: true, multiline: true, help: '每行一筆：教材名稱 | https://連結。' })
  );
  const addLesson = document.createElement('button');
  addLesson.type = 'submit';
  addLesson.className = 'primary-button';
  addLesson.textContent = '保存這堂課';
  lessonForm.append(addLesson);
  lessonForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = new FormData(lessonForm);
    const date = String(values.get('date') || '').trim();
    const content = String(values.get('content') || '').trim();
    const materials = String(values.get('materials') || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      setMessage('請填寫有效的上課日期（YYYY-MM-DD）。', true);
      return;
    }
    if (!content) {
      setMessage('請先填寫這堂課做了什麼。', true);
      return;
    }
    if (materials && safeMaterials(materials).length !== materials.split(/\r?\n/).filter(Boolean).length) {
      setMessage('教材連結需使用 https://，每行一筆。', true);
      return;
    }
    addLesson.disabled = true;
    try {
      const { addDoc, collection, serverTimestamp } = state.sdk.firestore;
      await addDoc(collection(state.db, 'students', id, 'lessons'), {
        date,
        content,
        feedback: String(values.get('feedback') || '').trim(),
        nextTopic: String(values.get('nextTopic') || '').trim(),
        materials,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setMessage('這堂課已保存，學員登入後可以看到。');
      await loadTeacher();
    } catch { setMessage('課堂紀錄保存失敗，請稍後再試。', true); }
    finally { addLesson.disabled = false; }
  });
  const lessonHistory = document.createElement('div');
  lessonHistory.className = 'lesson-list teacher-lessons';
  lessonHistory.textContent = '正在載入課堂紀錄…';
  void renderLessons(id, lessonHistory).catch(() => {
    lessonHistory.textContent = '課堂紀錄暫時無法載入。';
  });
  card.append(title, email, form, lessonHeading, lessonForm, lessonHistory);
  return card;
}

function teacherRequestCard(id, data, hasStudentRecord) {
  const card = document.createElement('article');
  card.className = 'request-card';
  const name = document.createElement('strong');
  name.textContent = data.displayName || '未顯示名稱';
  const email = document.createElement('small');
  email.textContent = data.email;
  const status = document.createElement('small');
  status.textContent = data.status === 'denied' ? '目前未開通' : '等待核准';
  const approve = document.createElement('button');
  approve.type = 'button';
  approve.className = 'primary-button';
  approve.textContent = '核准這個 Google 帳號';
  approve.addEventListener('click', async () => {
    approve.disabled = true;
    const { doc, writeBatch, serverTimestamp } = state.sdk.firestore;
    const batch = writeBatch(state.db);
    const studentRef = doc(state.db, 'students', id);
    if (hasStudentRecord) {
      batch.update(studentRef, { active: true, updatedAt: serverTimestamp() });
    } else {
      batch.set(studentRef, {
        uid: id, email: data.email, name: data.displayName || '', active: true,
        nextLesson: '', progress: '', teacherNote: '', homework: '', materials: '',
        updatedAt: serverTimestamp()
      });
    }
    batch.update(doc(state.db, 'accessRequests', id), { status: 'approved', reviewedAt: serverTimestamp() });
    try { await batch.commit(); setMessage('已開通，請在學員清單加入課程內容。'); await loadTeacher(); }
    catch { setMessage('開通失敗，請稍後再試。', true); approve.disabled = false; }
  });
  card.append(name, email, status, approve);
  return card;
}

async function loadTeacher() {
  const { collection, getDocs } = state.sdk.firestore;
  try {
    const [requests, students] = await Promise.all([
      getDocs(collection(state.db, 'accessRequests')),
      getDocs(collection(state.db, 'students'))
    ]);
    const requestList = $('#request-list');
    const pending = requests.docs.filter((item) => item.data().status !== 'approved');
    requestList.replaceChildren(...pending.map((item) =>
      teacherRequestCard(item.id, item.data(), students.docs.some((student) => student.id === item.id))
    ));
    if (!pending.length) requestList.textContent = '目前沒有等待核准的帳號。';
    const studentList = $('#student-list');
    studentList.replaceChildren(...students.docs.map((item) => teacherStudentCard(item.id, item.data())));
    if (students.empty) studentList.textContent = '核准第一位學員後，課程編輯欄會出現在這裡。';
    showOnly('teacher-view');
    if (!$('#portal-message').classList.contains('error')) setMessage('');
  } catch { showOnly('teacher-view'); setMessage('無法載入老師資料，請檢查帳號與資料庫權限。', true); }
}

$('#google-sign-in').addEventListener('click', async () => {
  const button = $('#google-sign-in');
  button.disabled = true;
  setMessage('正在開啟 Google 登入視窗…');
  try {
    await state.sdk.auth.signInWithPopup(state.auth, new state.sdk.auth.GoogleAuthProvider());
  } catch (error) {
    const details = error.code === 'auth/popup-blocked' ? '請允許瀏覽器彈出視窗後再試。'
      : error.code === 'auth/unauthorized-domain' ? '網站登入網域尚未完成設定，請聯繫黑犬老師。'
      : error.code === 'auth/popup-closed-by-user' ? '登入視窗已關閉，想登入時再按一次即可。'
      : 'Google 登入暫時失敗，請稍後再試。';
    setMessage(details, true);
  } finally { button.disabled = false; }
});

$('#sign-out').addEventListener('click', async () => {
  try { await state.sdk.auth.signOut(state.auth); }
  catch { setMessage('登出失敗，請稍後再試。', true); }
});

$('#request-access').addEventListener('click', async () => {
  const button = $('#request-access');
  button.disabled = true;
  try {
    await state.sdk.firestore.setDoc(state.sdk.firestore.doc(state.db, 'accessRequests', state.user.uid), {
      uid: state.user.uid,
      email: state.user.email,
      displayName: state.user.displayName || '',
      status: 'pending',
      createdAt: state.sdk.firestore.serverTimestamp()
    });
    await showPending();
  } catch { setMessage('送出開通申請失敗，請稍後再試。', true); }
  finally { button.disabled = false; }
});

async function start() {
  try {
    const [app, auth, firestore] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js')
    ]);
    state.sdk = { auth, firestore };
    const instance = app.initializeApp(firebaseConfig);
    state.auth = auth.getAuth(instance);
    state.db = firestore.getFirestore(instance);
    await auth.setPersistence(state.auth, auth.browserSessionPersistence);
    auth.onAuthStateChanged(state.auth, async (user) => {
      state.user = user;
      document.body.classList.toggle('has-account', Boolean(user));
      $('#sign-out').hidden = !user;
      if (!user) { showOnly('signed-out'); setMessage(''); return; }
      setMessage('正在確認你的學員權限…');
      if (isTeacher(user)) {
        if (portalMode === 'student') { window.location.replace('./teacher.html'); return; }
        await loadTeacher();
      } else {
        if (portalMode === 'teacher') { window.location.replace('./student.html'); return; }
        await loadStudent();
      }
    }, () => setMessage('登入狀態無法確認，請重新整理網頁。', true));
  } catch { showOnly('signed-out'); $('#google-sign-in').disabled = true; setMessage('登入服務暫時無法載入，請稍後重新整理。', true); }
}

void start();

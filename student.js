import { firebaseConfig } from './student-config.js';

const $ = (selector) => document.querySelector(selector);
const state = { auth: null, db: null, sdk: null, user: null, agreementVersion: '' };
const teacherEmail = 'blackdogstarball@gmail.com';
const portalMode = document.body.dataset.portal;
const defaultPlans = [
  ['初階打底', '大家的日本語、五十音後、N5 前後程度', '約 NT$500-600', '適合想從課本主線穩穩建立文法、句型和練習節奏的人。固定教材、固定進度會比較好安排。'],
  ['N5-N4 檢定', '文法、單字、聽讀練習與考前整理', '約 NT$550-650', '會依考試時間、目前程度、需要補強的題型安排課程，也可以只先補最卡的單元。'],
  ['N3-N2 文法閱讀', '文法比較、閱讀拆句、題型與弱點補強', '約 NT$650-750', 'N3-N2 同一報價區間，會先確認你卡在文法、閱讀、單字量，還是題目理解。'],
  ['旅遊生活日文', '情境口說、IG 例句、興趣主題微調', '約 NT$550-650', '可依你的旅遊目的、喜歡的內容和想練的情境安排，不會只背旅遊會話書。'],
  ['追星日文', '偶像貼文、歌詞短句、訪談、直播與活動用語', '約 NT$600-700', '會結合你喜歡的團體、作品或內容，適時補充課外教材。'],
  ['主題客製課', '自備教材、指定主題、文章討論、興趣素材', '約 NT$700-850', '適合希望用自己的教材、指定主題或專屬學習計畫上課的人。備課量較高時才會用這個區間。']
].map(([title, subtitle, price, description]) => ({ title, subtitle, price, description }));

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
  date.textContent = `${data.date || '課堂紀錄'}${data.kind ? ` · ${data.kind}` : ''}${data.status ? ` · ${data.status}` : ''}`;
  card.append(date);
  if (data.makeupFrom) {
    const original = document.createElement('p');
    original.className = 'helper';
    original.textContent = `原訂日期：${data.makeupFrom}；這堂已安排補課。`;
    card.append(original);
  }
  for (const [label, value] of [
    ['這堂課', data.content],
    ['老師的觀察', data.feedback],
    ['這堂課的功課', data.homework],
    ['下次一起練習', data.nextTopic],
    ['下次複習／小考', data.nextPractice],
    ['口說目標', data.goal],
    ['重新表達前', data.before],
    ['重新表達後', data.after]
  ]) {
    if (!value) continue;
    const heading = document.createElement('h4');
    heading.textContent = label;
    const body = document.createElement('p');
    body.className = 'preserve-lines';
    body.textContent = value;
    card.append(heading, body);
  }
  if (data.score) {
    const score = document.createElement('p');
    score.textContent = `口說表現：${data.score}／5`;
    card.append(score);
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

function renderStudent(data, preview = false) {
  $('#student-name').textContent = data.name || (preview ? '同學' : state.user.displayName || '同學');
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
  if (!preview) { showOnly('student-view'); setMessage(''); }
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
      await Promise.allSettled([loadPortalDetails(), loadStudentMessages()]);
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

async function loadPortalDetails(uid = state.user.uid, preview = false) {
  const { doc, getDoc } = state.sdk.firestore;
  const target = await getDoc(doc(state.db, 'students', uid, 'portalDetails', 'summary'));
  const data = target.exists() ? target.data() : {};
  $('#student-schedule-note').textContent = data.scheduleNote || '目前沒有新的排課提醒。';
  $('#student-speaking-progress').textContent = data.speakingProgress || '口說進步會在上課後慢慢累積。';
  $('#student-fee').textContent = `學費：${data.fee || '與老師確認'}`;
  $('#student-payment').textContent = `繳費狀態：${data.payment || '未確認'}`;
  $('#student-discount').textContent = data.discount ? `個別優惠：${data.discount}` : '';
  $('#student-agreement-status').textContent = `合約狀態：${data.agreementStatus || '待討論'}`;
  $('#student-agreement-text').textContent = data.agreementText || '';
  const linkBox = $('#student-agreement-link');
  linkBox.replaceChildren();
  for (const item of safeMaterials(data.agreementLink).slice(0, 1)) {
    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '查看合約文件';
    linkBox.append(link);
  }
  state.agreementVersion = data.agreementVersion || '';
  const ack = $('#student-agreement-ack');
  const button = $('#student-acknowledge');
  button.hidden = true;
  if (state.agreementVersion && (data.agreementText || data.agreementLink)) {
    const saved = await getDoc(doc(state.db, 'students', uid,
      'agreementAcknowledgements', state.agreementVersion));
    ack.textContent = saved.exists()
      ? '你已確認這一版約定。'
      : '閱讀完內容或文件後，可在這裡留下確認紀錄。';
    button.hidden = preview || saved.exists();
  } else ack.textContent = '';
}

if (portalMode === 'student') $('#student-acknowledge').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  if (!state.user || !state.agreementVersion) return;
  button.disabled = true;
  try {
    const { doc, setDoc, serverTimestamp } = state.sdk.firestore;
    await setDoc(doc(state.db, 'students', state.user.uid,
      'agreementAcknowledgements', state.agreementVersion), {
      uid: state.user.uid, version: state.agreementVersion,
      acceptedAt: serverTimestamp()
    });
    button.hidden = true;
    $('#student-agreement-ack').textContent = '你已確認這一版約定。';
    setMessage('約定確認已保存。');
  } catch { setMessage('確認紀錄保存失敗，請稍後再試。', true); }
  finally { button.disabled = false; }
});

function messageCard(data, uid) {
  const card = document.createElement('article');
  card.className = 'message-row';
  const title = document.createElement('strong');
  title.textContent = data.senderUid === uid
    ? `${data.type || '訊息'} · ${data.status || '待回覆'}`
    : `黑犬老師通知 · ${data.type || '訊息'}`;
  const body = document.createElement('p');
  body.textContent = data.body || '';
  card.append(title, body);
  if (data.reply) {
    const reply = document.createElement('p');
    reply.className = 'teacher-reply';
    reply.textContent = `黑犬老師：${data.reply}`;
    card.append(reply);
  }
  return card;
}

async function loadStudentMessages(uid = state.user.uid) {
  const { collection, getDocs } = state.sdk.firestore;
  const records = await getDocs(collection(state.db, 'students', uid, 'messages'));
  const sorted = records.docs.map((item) => item.data())
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  $('#student-message-list').replaceChildren(...sorted.map((item) => messageCard(item, uid)));
  if (!sorted.length) $('#student-message-list').textContent = '還沒有留言。';
}

if (portalMode === 'student') $('#student-message-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const values = new FormData(form);
  const body = String(values.get('body') || '').trim();
  if (!body || !state.user) return;
  button.disabled = true;
  try {
    const { addDoc, collection, serverTimestamp } = state.sdk.firestore;
    await addDoc(collection(state.db, 'students', state.user.uid, 'messages'), {
      senderUid: state.user.uid, type: String(values.get('type') || '一般訊息'),
      body, reply: '', status: '待回覆',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    form.reset();
    await loadStudentMessages();
    setMessage('訊息已送給黑犬老師。');
  } catch { setMessage('訊息送出失敗，請稍後再試。', true); }
  finally { button.disabled = false; }
});

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

function makeSelect(label, key, options, current) {
  const wrapper = document.createElement('label');
  wrapper.className = 'field';
  const caption = document.createElement('span');
  caption.textContent = label;
  const select = document.createElement('select');
  select.name = key;
  for (const value of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value || '未評量';
    select.append(option);
  }
  select.value = current || '';
  wrapper.append(caption, select);
  return wrapper;
}

async function renderTeacherLessons(uid, target) {
  const { collection, doc, getDocs, updateDoc, serverTimestamp } = state.sdk.firestore;
  const records = await getDocs(collection(state.db, 'students', uid, 'lessons'));
  const sorted = [...records.docs].sort((a, b) => String(b.data().date).localeCompare(String(a.data().date)));
  target.replaceChildren();
  if (!sorted.length) { target.textContent = '還沒有課堂紀錄。'; return; }
  for (const record of sorted) {
    const data = record.data();
    const row = document.createElement('details');
    row.className = 'lesson-history-row';
    const summary = document.createElement('summary');
    summary.textContent = `${data.date} · ${data.kind || '正式課'} · ${data.status || '已完成'}`;
    const form = document.createElement('form');
    form.className = 'lesson-editor';
    form.append(
      makeField('上課日期', 'date', data.date, { max: 10 }),
      makeSelect('課堂類型', 'kind', ['正式課', '試上'], data.kind || '正式課'),
      makeSelect('排課狀態', 'status', ['待確認', '已排課', '待補課', '已完成', '已取消'], data.status || '已完成'),
      makeField('今天上了什麼', 'content', data.content, { full: true, multiline: true }),
      makeField('老師評語', 'feedback', data.feedback, { full: true, multiline: true }),
      makeField('本堂功課', 'homework', data.homework, { full: true, multiline: true }),
      makeField('下次預計教的內容', 'nextTopic', data.nextTopic, { full: true, multiline: true }),
      makeField('下次複習／小考', 'nextPractice', data.nextPractice, { full: true, multiline: true }),
      makeField('課堂口說目標', 'goal', data.goal, { full: true, multiline: true }),
      makeSelect('口說分數', 'score', ['', '1', '2', '3', '4', '5'], String(data.score || '')),
      makeField('第一次表達', 'before', data.before, { full: true, multiline: true }),
      makeField('重新表達成果', 'after', data.after, { full: true, multiline: true }),
      makeField('教材 HTTPS 連結', 'materials', data.materials, { full: true, multiline: true })
    );
    const button = document.createElement('button');
    button.type = 'submit';
    button.className = 'primary-button';
    button.textContent = '儲存本堂修改';
    form.append(button);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = new FormData(form);
      const date = String(values.get('date') || '').trim();
      const content = String(values.get('content') || '').trim();
      const materials = String(values.get('materials') || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !content) {
        setMessage('請確認上課日期與課堂內容。', true); return;
      }
      if (materials && safeMaterials(materials).length !== materials.split(/\r?\n/).filter(Boolean).length) {
        setMessage('教材連結需使用 https://，每行一筆。', true); return;
      }
      button.disabled = true;
      try {
        await updateDoc(doc(state.db, 'students', uid, 'lessons', record.id), {
          date, kind: String(values.get('kind')), status: String(values.get('status')),
          content, feedback: String(values.get('feedback') || '').trim(),
          homework: String(values.get('homework') || '').trim(),
          nextTopic: String(values.get('nextTopic') || '').trim(),
          nextPractice: String(values.get('nextPractice') || '').trim(),
          goal: String(values.get('goal') || '').trim(),
          score: Number(values.get('score')) || 0,
          before: String(values.get('before') || '').trim(),
          after: String(values.get('after') || '').trim(),
          materials, updatedAt: serverTimestamp()
        });
        await loadTeacher();
        openStudentEditor(uid);
        document.querySelector(`.student-editor[data-student-id="${CSS.escape(uid)}"] .student-tabs button:nth-child(2)`)?.click();
        setMessage('課堂紀錄已更新。');
      } catch { setMessage('修改保存失敗，請稍後再試。', true); button.disabled = false; }
    });
    row.append(summary, form);
    target.append(row);
  }
}

async function loadTeacherLessonDrafts(uid, target, form) {
  try {
    const { collection, getDocs } = state.sdk.firestore;
    const records = await getDocs(collection(state.db, 'teacherLessonDrafts', uid, 'items'));
    const drafts = records.docs.filter((item) => item.data().state === 'draft');
    target.replaceChildren();
    if (!drafts.length) { target.textContent = '沒有尚未發布的課堂草稿。'; return; }
    const heading = document.createElement('h4');
    heading.textContent = '老師草稿（學員看不到）';
    target.append(heading);
    for (const record of drafts) {
      const data = record.data();
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'draft-row';
      button.textContent = `${data.date} · ${(data.content || '尚未填課堂內容').slice(0, 45)}`;
      button.addEventListener('click', () => {
        for (const key of ['date', 'kind', 'status', 'content', 'feedback', 'homework',
          'nextTopic', 'nextPractice', 'goal', 'score', 'before', 'after', 'materials']) {
          const field = form.elements.namedItem(key);
          if (field) field.value = data[key] || '';
        }
        form.dataset.draftId = record.id;
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setMessage('已載入老師草稿；儲存草稿可繼續編輯，發布後學員才會看到。');
      });
      target.append(button);
    }
  } catch { target.textContent = '課堂草稿暫時無法載入。'; }
}

function teacherStudentCard(id, data, privateData = {}) {
  const card = document.createElement('details');
  card.className = 'student-editor';
  card.dataset.studentId = id;
  card.dataset.search = `${data.name || ''} ${data.email || ''}`.toLocaleLowerCase();
  const title = document.createElement('strong');
  title.textContent = data.name || '未填稱呼';
  const email = document.createElement('small');
  email.textContent = data.email;
  const summary = document.createElement('summary');
  summary.append(title, email);
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
      await loadTeacher();
      setMessage('已儲存這位學員的課程資料。');
    } catch { setMessage('儲存失敗，請稍後再試。', true); }
    finally { save.disabled = false; }
  });
  const lessonHeading = document.createElement('h4');
  lessonHeading.textContent = '新增一堂課';
  const lessonForm = document.createElement('form');
  lessonForm.className = 'lesson-editor';
  lessonForm.append(
    makeField('上課日期', 'date', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }), { max: 10 }),
    makeSelect('課堂類型', 'kind', ['正式課', '試上'], '正式課'),
    makeSelect('排課狀態', 'status', ['待確認', '已排課', '待補課', '已完成', '已取消'], '已完成'),
    makeField('這堂課做了什麼', 'content', '', { full: true, multiline: true }),
    makeField('老師的觀察與鼓勵', 'feedback', '', { full: true, multiline: true }),
    makeField('本堂功課', 'homework', '', { full: true, multiline: true }),
    makeField('下次一起練習', 'nextTopic', '', { full: true, multiline: true }),
    makeField('下次複習／小考', 'nextPractice', '', { full: true, multiline: true }),
    makeField('課堂口說目標', 'goal', '', { full: true, multiline: true }),
    makeSelect('本堂口說分數', 'score', ['', '1', '2', '3', '4', '5'], ''),
    makeField('第一次表達', 'before', '', { full: true, multiline: true }),
    makeField('重新表達成果', 'after', '', { full: true, multiline: true }),
    makeField('這堂課的教材', 'materials', '', { full: true, multiline: true, help: '每行一筆：教材名稱 | https://連結。' })
  );
  const addLesson = document.createElement('button');
  addLesson.type = 'submit';
  addLesson.className = 'primary-button';
  addLesson.textContent = '發布給學員';
  const saveDraft = document.createElement('button');
  saveDraft.type = 'button';
  saveDraft.className = 'secondary-button';
  saveDraft.textContent = '儲存老師草稿';
  const newLesson = document.createElement('button');
  newLesson.type = 'button';
  newLesson.className = 'secondary-button';
  newLesson.textContent = '開始新的課堂';
  newLesson.addEventListener('click', () => {
    lessonForm.reset();
    delete lessonForm.dataset.draftId;
    lessonForm.elements.namedItem('date').value = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    setMessage('已清空編輯欄，可開始新的課堂。');
  });
  lessonForm.append(saveDraft, addLesson, newLesson);
  const lessonDraftList = document.createElement('div');
  lessonDraftList.className = 'teacher-lesson-drafts';
  void loadTeacherLessonDrafts(id, lessonDraftList, lessonForm);
  saveDraft.addEventListener('click', async () => {
    const values = new FormData(lessonForm);
    const date = String(values.get('date') || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setMessage('草稿仍需要有效的上課日期。', true); return;
    }
    saveDraft.disabled = true;
    try {
      const { addDoc, collection, doc, updateDoc, serverTimestamp } = state.sdk.firestore;
      const draft = { uid: id, state: 'draft',
        date, kind: String(values.get('kind')), status: String(values.get('status')),
        content: String(values.get('content') || '').trim(),
        feedback: String(values.get('feedback') || '').trim(),
        homework: String(values.get('homework') || '').trim(),
        nextTopic: String(values.get('nextTopic') || '').trim(),
        nextPractice: String(values.get('nextPractice') || '').trim(),
        goal: String(values.get('goal') || '').trim(),
        score: Number(values.get('score')) || 0,
        before: String(values.get('before') || '').trim(),
        after: String(values.get('after') || '').trim(),
        materials: String(values.get('materials') || '').trim(),
        updatedAt: serverTimestamp() };
      if (lessonForm.dataset.draftId) {
        await updateDoc(doc(state.db, 'teacherLessonDrafts', id, 'items', lessonForm.dataset.draftId), draft);
      } else {
        const saved = await addDoc(collection(state.db, 'teacherLessonDrafts', id, 'items'), {
          ...draft, createdAt: serverTimestamp()
        });
        lessonForm.dataset.draftId = saved.id;
      }
      await loadTeacherLessonDrafts(id, lessonDraftList, lessonForm);
      setMessage('老師草稿已儲存，學員尚未看到。');
    } catch { setMessage('草稿儲存失敗，請稍後再試。', true); }
    finally { saveDraft.disabled = false; }
  });
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
      const { collection, doc, writeBatch, serverTimestamp } = state.sdk.firestore;
      const batch = writeBatch(state.db);
      batch.set(doc(collection(state.db, 'students', id, 'lessons')), {
        date,
        kind: String(values.get('kind')),
        status: String(values.get('status')),
        content,
        feedback: String(values.get('feedback') || '').trim(),
        homework: String(values.get('homework') || '').trim(),
        nextTopic: String(values.get('nextTopic') || '').trim(),
        nextPractice: String(values.get('nextPractice') || '').trim(),
        goal: String(values.get('goal') || '').trim(),
        score: Number(values.get('score')) || 0,
        before: String(values.get('before') || '').trim(),
        after: String(values.get('after') || '').trim(),
        materials,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      if (lessonForm.dataset.draftId) {
        batch.update(doc(state.db, 'teacherLessonDrafts', id, 'items', lessonForm.dataset.draftId), {
          state: 'published', publishedAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
      }
      await batch.commit();
      delete lessonForm.dataset.draftId;
      await loadTeacher();
      openStudentEditor(id);
      document.querySelector(`.student-editor[data-student-id="${CSS.escape(id)}"] .student-tabs button:nth-child(2)`)?.click();
      setMessage('這堂課已保存，學員登入後可以看到。');
    } catch { setMessage('課堂紀錄保存失敗，請稍後再試。', true); }
    finally { addLesson.disabled = false; }
  });
  const lessonHistory = document.createElement('div');
  lessonHistory.className = 'lesson-list teacher-lessons';
  lessonHistory.textContent = '正在載入課堂紀錄…';
  void renderTeacherLessons(id, lessonHistory).catch(() => {
    lessonHistory.textContent = '課堂紀錄暫時無法載入。';
  });
  const privateForm = document.createElement('form');
  privateForm.className = 'private-form';
  const privateSections = [
    ['跟進與學費', [
      ['程度', 'level'], ['課程方向', 'direction'], ['流程狀態', 'status'],
      ['回覆進度', 'reply'], ['聯絡方式（僅老師）', 'contact'],
      ['學習目標', 'goal'], ['希望時段', 'availability'],
      ['排課安排（學員可見）', 'scheduleNote'], ['個別學費（學員可見）', 'fee'],
      ['繳費狀態（學員可見）', 'payment'], ['個別優惠（學員可見）', 'discount']
    ]],
    ['費用與合約', [
      ['合約狀態（學員可見）', 'agreementStatus'],
      ['合約內容（學員可見）', 'agreementText'],
      ['合約文件 HTTPS 連結（學員可見）', 'agreementLink']
    ]],
    ['個人化教材', [['備課與素材進度（僅老師）', 'materialPrep']]],
    ['口說進步', [['口說進步紀錄（學員可見）', 'speakingProgress']]],
    ['老師內部', [['老師內部備註', 'internalNotes']]]
  ];
  const sectionNodes = new Map();
  for (const [name, fields] of privateSections) {
    const section = document.createElement('section');
    section.className = 'private-section';
    section.dataset.studentTab = name;
    for (const [label, key] of fields) section.append(makeField(label, key, privateData[key], {
      full: true, multiline: ['goal', 'availability', 'scheduleNote', 'agreementText',
        'materialPrep', 'speakingProgress', 'internalNotes'].includes(key), max: key === 'agreementText' ? 4000 : 2500
    }));
    privateForm.append(section);
    sectionNodes.set(name, section);
  }
  const agreementNote = document.createElement('p');
  agreementNote.className = 'helper';
  agreementNote.textContent = '正在確認學員是否已閱讀這份約定…';
  sectionNodes.get('費用與合約').append(agreementNote);
  if (privateData.agreementVersion) {
    const { doc, getDoc } = state.sdk.firestore;
    void getDoc(doc(state.db, 'students', id, 'agreementAcknowledgements',
      privateData.agreementVersion)).then((snapshot) => {
      agreementNote.textContent = snapshot.exists()
        ? '學員已確認目前版本的約定。' : '學員尚未確認目前版本的約定。';
    }).catch(() => { agreementNote.textContent = '暫時無法讀取學員確認紀錄。'; });
  } else agreementNote.textContent = '儲存合約內容後，學員即可登入確認。';
  const savePrivate = document.createElement('button');
  savePrivate.type = 'submit';
  savePrivate.className = 'primary-button';
  savePrivate.textContent = '儲存學生詳細資料';
  privateForm.append(savePrivate);
  privateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    savePrivate.disabled = true;
    const values = new FormData(privateForm);
    const fields = Object.fromEntries(privateSections.flatMap(([, pairs]) => pairs.map(([, key]) =>
      [key, String(values.get(key) || '').trim()])));
    if (fields.agreementLink && !safeMaterials(fields.agreementLink).length) {
      setMessage('合約文件請使用有效的 HTTPS 連結。', true);
      savePrivate.disabled = false;
      return;
    }
    const agreementChanged = ['fee', 'agreementText', 'agreementLink'].some((key) =>
      fields[key] !== (privateData[key] || ''));
    const agreementVersion = agreementChanged || !privateData.agreementVersion
      ? crypto.randomUUID() : privateData.agreementVersion;
    const { doc, writeBatch, serverTimestamp } = state.sdk.firestore;
    const batch = writeBatch(state.db);
    batch.set(doc(state.db, 'teacherRecords', id), {
      uid: id, ...fields, agreementVersion, updatedAt: serverTimestamp()
    });
    batch.set(doc(state.db, 'students', id, 'portalDetails', 'summary'), {
      fee: fields.fee, payment: fields.payment, discount: fields.discount,
      agreementText: fields.agreementText, agreementStatus: fields.agreementStatus,
      agreementLink: fields.agreementLink, agreementVersion,
      speakingProgress: fields.speakingProgress,
      scheduleNote: fields.scheduleNote, updatedAt: serverTimestamp()
    });
    try { await batch.commit(); await loadTeacher(); setMessage('學生詳細資料已儲存；學員可見欄位已同步。'); }
    catch { setMessage('學生詳細資料儲存失敗，請稍後再試。', true); }
    finally { savePrivate.disabled = false; }
  });
  const messages = document.createElement('section');
  messages.className = 'teacher-message-panel';
  messages.dataset.studentTab = '互動與請假';
  messages.textContent = '正在載入學員訊息…';
  void loadTeacherMessages(id, messages);
  const tabs = document.createElement('nav');
  tabs.className = 'student-tabs';
  tabs.setAttribute('aria-label', `${data.name || '學員'}的資料分頁`);
  const basicPanel = document.createElement('section');
  basicPanel.dataset.studentTab = '資料';
  basicPanel.append(form);
  const lessonPanel = document.createElement('section');
  lessonPanel.dataset.studentTab = '課堂';
  lessonPanel.append(lessonHeading, lessonForm, lessonDraftList, lessonHistory);
  const tabPanels = [basicPanel, lessonPanel, ...sectionNodes.values(), messages];
  const setTab = (selected) => {
    tabPanels.forEach((panel) => { panel.hidden = panel.dataset.studentTab !== selected; });
    privateForm.hidden = !sectionNodes.has(selected);
    tabs.querySelectorAll('button').forEach((button) =>
      button.setAttribute('aria-pressed', String(button.textContent === selected)));
    card.dataset.currentTab = selected;
  };
  for (const label of ['資料', '課堂', '跟進與學費', '互動與請假', '費用與合約', '個人化教材', '口說進步', '老師內部']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => setTab(label));
    tabs.append(button);
  }
  const shortcuts = document.createElement('div');
  shortcuts.className = 'student-shortcuts';
  for (const [label, action] of [
    ['預覽學員畫面', () => openStudentPreview(id)],
    ['安排下一堂', () => openSchedule(id, 'confirm')],
    ['老師請假', () => openSchedule(id, 'leave')]
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-button';
    button.textContent = label;
    button.addEventListener('click', action);
    shortcuts.append(button);
  }
  card.append(summary, shortcuts, tabs, basicPanel, lessonPanel, privateForm, messages);
  setTab('資料');
  return card;
}

async function loadTeacherMessages(uid, target) {
  try {
    const { collection, getDocs, doc, updateDoc, serverTimestamp } = state.sdk.firestore;
    const records = await getDocs(collection(state.db, 'students', uid, 'messages'));
    const sorted = [...records.docs].sort((a, b) =>
      (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0));
    target.replaceChildren();
    if (!sorted.length) { target.textContent = '目前沒有請假或課後留言。'; return; }
    for (const record of sorted) {
      const data = record.data();
      const form = document.createElement('form');
      form.className = 'reply-form';
      const title = document.createElement('strong');
      title.textContent = data.senderUid === uid
        ? `${data.type} · ${data.status}` : `老師通知 · ${data.type}`;
      const body = document.createElement('p');
      body.className = 'preserve-lines';
      body.textContent = data.body;
      if (data.senderUid !== uid) { form.append(title, body); target.append(form); continue; }
      const reply = makeField('回覆學員', 'reply', data.reply, { full: true, multiline: true, max: 2500 });
      const button = document.createElement('button');
      button.type = 'submit';
      button.className = 'primary-button';
      button.textContent = '儲存回覆';
      form.append(title, body, reply, button);
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        button.disabled = true;
        try {
          const value = String(new FormData(form).get('reply') || '').trim();
          await updateDoc(doc(state.db, 'students', uid, 'messages', record.id), {
            reply: value, status: value ? '已回覆' : '待回覆', updatedAt: serverTimestamp()
          });
          await loadTeacherMessages(uid, target);
          setMessage('已儲存給學員的回覆。');
        } catch { setMessage('回覆保存失敗，請稍後再試。', true); button.disabled = false; }
      });
      target.append(form);
    }
  } catch { target.textContent = '學員訊息暫時無法載入。'; }
}

function draftLessons(data) {
  return Object.entries(data).filter(([key]) => /^lesson_\d{4}_\d{2}_\d{2}$/.test(key))
    .map(([, raw]) => {
      try { return JSON.parse(raw); }
      catch { return null; }
    })
    .filter((lesson) => lesson && /^\d{4}-\d{2}-\d{2}$/.test(lesson.date)
      && typeof lesson.content === 'string' && lesson.content.trim())
    .sort((a, b) => a.date.localeCompare(b.date));
}

function teacherDraftCard(id, data, studentDocs) {
  const card = document.createElement('article');
  card.className = 'student-editor';
  const title = document.createElement('strong');
  title.textContent = data.name || '未命名學員';
  const status = document.createElement('small');
  status.textContent = data.status === 'linked'
    ? '已綁定到經核准的 Google 帳號'
    : '尚待本人 Google 帳號開通與核對';
  const history = document.createElement('div');
  history.className = 'lesson-list teacher-lessons';
  const lessons = draftLessons(data);
  history.replaceChildren(...lessons.map(lessonCard));
  card.append(title, status, history);
  if (data.status === 'linked') return card;
  const approved = studentDocs.filter((item) => item.data().active === true);
  const label = document.createElement('label');
  label.className = 'field draft-picker';
  const caption = document.createElement('span');
  caption.textContent = '核對後，選擇正確的學員帳號';
  const select = document.createElement('select');
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = approved.length ? '請選擇已核准的帳號' : '目前沒有已核准的學員';
  select.append(placeholder);
  for (const student of approved) {
    const option = document.createElement('option');
    option.value = student.id;
    option.textContent = `${student.data().name || '未填稱呼'}｜${student.data().email}`;
    select.append(option);
  }
  label.append(caption, select);
  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'primary-button';
  link.textContent = '確認身分並綁定課堂資料';
  const verifiedLabel = document.createElement('label');
  verifiedLabel.className = 'verify-label';
  const verified = document.createElement('input');
  verified.type = 'checkbox';
  verifiedLabel.append(verified, document.createTextNode('我已向學員核對這個 Google 電子郵件是本人使用'));
  const refreshLink = () => { link.disabled = !select.value || !verified.checked || !lessons.length; };
  select.addEventListener('change', refreshLink);
  verified.addEventListener('change', refreshLink);
  refreshLink();
  link.addEventListener('click', async () => {
    const uid = select.value;
    if (!uid) { setMessage('請先選擇本人已核准的 Google 帳號。', true); return; }
    link.disabled = true;
    const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = state.sdk.firestore;
    try {
      for (const lesson of lessons) {
        const ref = doc(state.db, 'students', uid, 'lessons', lesson.date);
        if ((await getDoc(ref)).exists()) continue;
        await setDoc(ref, {
          date: lesson.date,
          content: lesson.content,
          feedback: String(lesson.feedback || ''),
          nextTopic: String(lesson.nextTopic || ''),
          materials: String(lesson.materials || ''),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      const latest = lessons.at(-1);
      await updateDoc(doc(state.db, 'students', uid), {
        name: String(data.name || ''),
        progress: latest.content,
        teacherNote: String(latest.feedback || ''),
        materials: String(latest.materials || ''),
        updatedAt: serverTimestamp()
      });
      await updateDoc(doc(state.db, 'unlinkedStudentRecords', id), {
        status: 'linked', linkedUid: uid
      });
      await loadTeacher();
      setMessage('兩堂課已綁定；這位學員登入後會看到自己的紀錄。');
    } catch {
      setMessage('綁定未完成。請確認帳號後再試；已成功保存的課堂不會重複新增。', true);
      link.disabled = false;
    }
  });
  card.append(label, verifiedLabel, link);
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
    try { await batch.commit(); await loadTeacher(); setMessage('已開通；若有待綁定舊課，請核對後選擇這個帳號。'); }
    catch { setMessage('開通失敗，請稍後再試。', true); approve.disabled = false; }
  });
  card.append(name, email, status, approve);
  return card;
}

async function loadTeacher() {
  const { collection, getDocs } = state.sdk.firestore;
  try {
    const [requests, students, drafts, privateRecords] = await Promise.all([
      getDocs(collection(state.db, 'accessRequests')),
      getDocs(collection(state.db, 'students')),
      getDocs(collection(state.db, 'unlinkedStudentRecords')),
      getDocs(collection(state.db, 'teacherRecords'))
    ]);
    state.teacherStudents = new Map(students.docs.map((item) => [item.id, item.data()]));
    const requestList = $('#request-list');
    const pending = requests.docs.filter((item) => item.data().status !== 'approved');
    requestList.replaceChildren(...pending.map((item) =>
      teacherRequestCard(item.id, item.data(), students.docs.some((student) => student.id === item.id))
    ));
    if (!pending.length) requestList.textContent = '目前沒有等待核准的帳號。';
    const studentList = $('#student-list');
    const details = new Map(privateRecords.docs.map((item) => [item.id, item.data()]));
    studentList.replaceChildren(...students.docs.map((item) =>
      teacherStudentCard(item.id, item.data(), details.get(item.id) || {})));
    if (students.empty) studentList.textContent = '核准第一位學員後，課程編輯欄會出現在這裡。';
    const draftList = $('#draft-list');
    draftList.replaceChildren(...drafts.docs.map((item) =>
      teacherDraftCard(item.id, item.data(), students.docs)
    ));
    if (drafts.empty) draftList.textContent = '目前沒有等待綁定的舊課。';
    renderTeacherBoard(pending, students.docs, drafts.docs);
    await loadTeacherPlans();
    showOnly('teacher-view');
    $('#preview-content').append($('#student-view'));
    $('#student-view').hidden = true;
    void refreshScheduleLessons();
    if (!$('#portal-message').classList.contains('error')) setMessage('');
  } catch { showOnly('teacher-view'); setMessage('無法載入老師資料，請檢查帳號與資料庫權限。', true); }
}

async function loadTeacherPlans() {
  const { doc, getDoc } = state.sdk.firestore;
  const snapshot = await getDoc(doc(state.db, 'publicPlans', 'pricing'));
  const cards = snapshot.exists() && Array.isArray(snapshot.data().cards)
    ? snapshot.data().cards : defaultPlans;
  const editor = $('#plans-editor');
  editor.replaceChildren();
  cards.slice(0, 6).forEach((card, index) => {
    const section = document.createElement('fieldset');
    section.className = 'plan-edit';
    const title = document.createElement('legend');
    title.textContent = `方案 ${index + 1}`;
    section.append(title,
      makeField('名稱', `title${index}`, card.title, { max: 120 }),
      makeField('適合的課程與程度', `subtitle${index}`, card.subtitle, { max: 240 }),
      makeField('公開參考價格', `price${index}`, card.price, { max: 80 }),
      makeField('課程說明', `description${index}`, card.description, { full: true, multiline: true, max: 1200 })
    );
    editor.append(section);
  });
}

const workNames = {
  classwork: '今日課堂', overview: '工作總覽', students: '學生管理',
  schedule: '排課與請假', preview: '學員畫面預覽',
  materials: '個人化教材', plans: '課程與方案'
};

async function openStudentPreview(uid) {
  if (!uid || !isTeacher(state.user)) return;
  showWorkPane('preview');
  $('#preview-student').value = uid;
  const area = $('#preview-content');
  area.querySelector('.preview-status')?.remove();
  const note = document.createElement('p');
  note.className = 'paper preview-status';
  note.textContent = '正在載入學員畫面…';
  area.prepend(note);
  $('#student-view').hidden = true;
  try {
    const { doc, getDoc } = state.sdk.firestore;
    const record = await getDoc(doc(state.db, 'students', uid));
    if (!record.exists() || record.data().active !== true) {
      note.textContent = '這個帳號尚未開通，學員登入後只會看到開通狀態，不會看到課程資料。';
      return;
    }
    renderStudent(record.data(), true);
    $('#student-view').hidden = false;
    const results = await Promise.allSettled([
      renderLessons(uid, $('#lesson-list')),
      loadPortalDetails(uid, true),
      loadStudentMessages(uid)
    ]);
    note.textContent = results.some((result) => result.status === 'rejected')
      ? '這是唯讀預覽；部分資料暫時無法載入，請稍後再試。'
      : `唯讀預覽：${record.data().name || record.data().email} 登入後可見的內容。草稿與老師內部備註不會顯示。`;
  } catch { note.textContent = '預覽暫時無法載入，請確認老師帳號的資料庫權限。'; }
}

function formatTaipeiSlot(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return '';
  const [, year, month, day, hour, minute] = match;
  const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`
    || Number(hour) > 23 || Number(minute) > 59) return '';
  const weekday = date.toLocaleDateString('zh-TW', { timeZone: 'UTC', weekday: 'short' });
  return `${year}/${month}/${day}（${weekday}）${hour}:${minute} 台灣時間`;
}

async function refreshScheduleLessons() {
  const uid = $('#schedule-student').value;
  const action = $('#schedule-action').value;
  $('#schedule-lesson-label').hidden = !['leave', 'makeup'].includes(action);
  $('#schedule-time-label').hidden = action === 'leave';
  $('#schedule-help').textContent = {
    confirm: '確認後會更新學員的「下次上課時間」，並在學員專區留下通知。',
    propose: '這是待討論的時段；原本已確認的下次上課時間不會被改掉。',
    leave: '會通知學員老師請假；若選了已排課的課堂，該堂會標記為待補課。',
    makeup: '請先選一堂待補課的課，確認後會更新課堂日期和學員的下次上課時間。'
  }[action];
  const select = $('#schedule-lesson');
  select.replaceChildren(new Option(action === 'makeup' ? '選擇待補課的課堂' : '未建立課堂紀錄（只更新下次時間）', ''));
  if (!uid || !['leave', 'makeup'].includes(action)) return;
  try {
    const { collection, getDocs } = state.sdk.firestore;
    const records = await getDocs(collection(state.db, 'students', uid, 'lessons'));
    if ($('#schedule-student').value !== uid || $('#schedule-action').value !== action) return;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    for (const record of records.docs) {
      const lesson = record.data();
      if (action === 'makeup' ? lesson.status !== '待補課'
        : !['已排課', '待確認'].includes(lesson.status) || lesson.date < today) continue;
      select.append(new Option(`${lesson.date} · ${lesson.kind || '正式課'} · ${lesson.status}`, record.id));
    }
    if (action === 'makeup' && select.options.length === 1) {
      $('#schedule-help').textContent = '目前沒有待補課的課堂；請先在課堂紀錄將原課標記為待補課。';
    }
  } catch { $('#schedule-help').textContent = '課堂清單暫時無法載入，請稍後再試。'; }
}

function openSchedule(uid, action = 'confirm', lessonId = '') {
  showWorkPane('schedule');
  $('#schedule-student').value = uid;
  $('#schedule-action').value = action;
  void refreshScheduleLessons().then(() => {
    if (lessonId) $('#schedule-lesson').value = lessonId;
  });
  $('#schedule-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveSchedule(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const uid = $('#schedule-student').value;
  const action = $('#schedule-action').value;
  const lessonId = $('#schedule-lesson').value;
  const value = $('#schedule-time').value;
  const slot = formatTaipeiSlot(value);
  const note = String(new FormData(form).get('note') || '').trim();
  if (!uid || !state.teacherStudents?.has(uid)) { setMessage('請先選擇學員。', true); return; }
  if (action !== 'leave' && (!slot || Date.parse(`${value}+08:00`) <= Date.now())) {
    setMessage('請填寫未來的有效日期與時間（台灣時間）。', true); return;
  }
  if (action === 'makeup' && !lessonId) { setMessage('請先選擇一堂待補課的課。', true); return; }
  button.disabled = true;
  try {
    const { collection, doc, getDoc, writeBatch, serverTimestamp } = state.sdk.firestore;
    const student = await getDoc(doc(state.db, 'students', uid));
    if (!student.exists() || !student.data().active) throw new Error('inactive student');
    let related = null;
    if (lessonId && ['leave', 'makeup'].includes(action)) {
      related = await getDoc(doc(state.db, 'students', uid, 'lessons', lessonId));
      if (!related.exists() || (action === 'makeup' && related.data().status !== '待補課')
        || (action === 'leave' && !['已排課', '待確認'].includes(related.data().status))) {
        throw new Error('lesson status changed');
      }
    }
    const original = related?.data().date || student.data().nextLesson || '原時間待核對';
    const kind = { confirm: '下次上課已確認', propose: '下次時段提議',
      leave: '老師請假', makeup: '補課時間已確認' }[action];
    const detail = action === 'leave'
      ? `原訂：${original}。老師這次需要請假，補課時間再一起確認。`
      : `${action === 'propose' ? '建議時段' : '上課時間'}：${slot}。`;
    const body = `${detail}${note ? `\n${note}` : ''}`;
    const batch = writeBatch(state.db);
    if (action === 'confirm' || action === 'makeup') batch.update(doc(state.db, 'students', uid), {
      nextLesson: slot, updatedAt: serverTimestamp()
    });
    if (action === 'leave') batch.update(doc(state.db, 'students', uid), {
      nextLesson: '老師請假，補課時間待確認', updatedAt: serverTimestamp()
    });
    if (related && action === 'leave') batch.update(related.ref, {
      status: '待補課', updatedAt: serverTimestamp()
    });
    if (related && action === 'makeup') batch.update(related.ref, {
      date: value.slice(0, 10), status: '已排課',
      makeupFrom: related.data().makeupFrom || related.data().date,
      updatedAt: serverTimestamp()
    });
    batch.set(doc(collection(state.db, 'students', uid, 'messages')), {
      senderUid: state.user.uid, type: kind, body, reply: '', status: '已回覆',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    await batch.commit();
    form.elements.namedItem('note').value = '';
    await loadTeacher();
    $('#schedule-student').value = uid;
    void refreshScheduleLessons();
    setMessage(`${kind}已保存，學員登入後可在自己的專區看到。`);
  } catch { setMessage('排課異動沒有保存。請重新整理，確認學員與課堂狀態後再試。', true); }
  finally { button.disabled = false; }
}

function showWorkPane(name) {
  if (portalMode !== 'teacher') return;
  const chosen = workNames[name] ? name : 'classwork';
  for (const key of Object.keys(workNames)) {
    $(`#work-${key}`).hidden = key !== chosen;
    const button = $(`[data-work-view="${key}"]`);
    if (key === chosen) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  $('#work-breadcrumb').textContent = workNames[chosen];
}

function openStudentEditor(uid, lesson = false) {
  showWorkPane('students');
  const card = [...document.querySelectorAll('.student-editor[data-student-id]')]
    .find((item) => item.dataset.studentId === uid);
  if (!card) return;
  card.open = true;
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (lesson) card.querySelector('.lesson-editor [name="content"]')?.focus();
}

function openStudentTab(uid, label) {
  openStudentEditor(uid);
  const card = [...document.querySelectorAll('.student-editor[data-student-id]')]
    .find((item) => item.dataset.studentId === uid);
  [...(card?.querySelectorAll('.student-tabs button') || [])]
    .find((button) => button.textContent === label)?.click();
}

function boardRow(label, detail, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'work-row';
  const text = document.createElement('span');
  const title = document.createElement('strong');
  title.textContent = label;
  const sub = document.createElement('small');
  sub.textContent = detail;
  text.append(title, sub);
  const arrow = document.createElement('span');
  arrow.textContent = '→';
  button.append(text, arrow);
  button.addEventListener('click', action);
  return button;
}

function renderTeacherBoard(pending, students, drafts) {
  const activeDrafts = drafts.filter((item) => item.data().status !== 'linked');
  $('#count-requests').textContent = String(pending.length);
  $('#count-students').textContent = String(students.filter((item) => item.data().active).length);
  $('#count-drafts').textContent = String(activeDrafts.length);
  $('#today-date').textContent = new Date().toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });
  const selector = $('#classwork-student');
  selector.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = students.length ? '選擇已開通學員' : '尚無已開通學員';
  selector.append(placeholder);
  for (const student of students) {
    const option = document.createElement('option');
    option.value = student.id;
    option.textContent = student.data().name || student.data().email;
    selector.append(option);
  }
  $('#classwork-open').disabled = !students.length;
  for (const id of ['schedule-student', 'preview-student']) {
    const picker = $(`#${id}`);
    const selected = picker.value;
    picker.replaceChildren(new Option(students.length ? '選擇學員' : '尚無已開通學員', ''));
    for (const student of students) {
      if (!student.data().active) continue;
      picker.append(new Option(student.data().name || student.data().email, student.id));
    }
    if (students.some((item) => item.id === selected && item.data().active)) picker.value = selected;
  }
  $('#preview-open').disabled = $('#preview-student').options.length < 2;
  const draftBoard = $('#classwork-draft-list');
  draftBoard.replaceChildren(...activeDrafts.map((item) => boardRow(
    item.data().name || '未命名學員',
    `${draftLessons(item.data()).length} 堂舊課待綁定`,
    () => { showWorkPane('students'); $('#drafts-title').scrollIntoView({ behavior: 'smooth' }); }
  )));
  if (!activeDrafts.length) draftBoard.textContent = '目前沒有待綁定舊課。';
  const studentBoard = $('#overview-students');
  studentBoard.replaceChildren(...students.slice(0, 8).map((item) => boardRow(
    item.data().name || '未填稱呼', item.data().email, () => openStudentEditor(item.id)
  )));
  if (!students.length) studentBoard.textContent = '學員送出 Google 開通申請後，會出現在這裡。';
  const inbox = $('#overview-messages');
  inbox.textContent = '正在整理學員訊息…';
  void Promise.all(students.map(async (student) => ({
    student,
    messages: (await state.sdk.firestore.getDocs(state.sdk.firestore.collection(
      state.db, 'students', student.id, 'messages'))).docs
  }))).then((all) => {
    const unanswered = all.flatMap(({ student, messages }) => messages
      .filter((item) => item.data().status === '待回覆')
      .map((item) => ({ student, message: item.data() })));
    inbox.replaceChildren(...unanswered.map(({ student, message }) => boardRow(
      `${student.data().name || '未填稱呼'} · ${message.type}`,
      String(message.body || '').slice(0, 100),
      () => openStudentTab(student.id, '互動與請假')
    )));
    if (!unanswered.length) inbox.textContent = '目前沒有等待回覆的學生訊息。';
  }).catch(() => { inbox.textContent = '學員訊息暫時無法載入。'; });
  const scheduled = students.filter((item) => item.data().nextLesson);
  for (const [target, rows] of [[$('#overview-schedule'), scheduled.slice(0, 5)], [$('#schedule-list'), scheduled]]) {
    target.replaceChildren(...rows.map((item) => boardRow(
      item.data().name || '未填稱呼', item.data().nextLesson, () => openStudentEditor(item.id)
    )));
    if (!rows.length) target.textContent = '尚未安排下次上課時間。';
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
  const todayList = $('#today-lesson-list');
  todayList.textContent = '正在整理今天的課…';
  void Promise.all(students.map(async (student) => {
    const records = await state.sdk.firestore.getDocs(
      state.sdk.firestore.collection(state.db, 'students', student.id, 'lessons')
    );
    return { student, lessons: records.docs.map((item) => ({ id: item.id, ...item.data() })) };
  })).then((all) => {
    todayList.replaceChildren(...all.flatMap(({ student, lessons }) => lessons
      .filter((lesson) => lesson.date === today)
      .map((lesson) => boardRow(student.data().name || '未填稱呼',
        lesson.content.slice(0, 100), () => openStudentEditor(student.id, true)))));
    if (!todayList.childElementCount) todayList.textContent = '今天還沒有課堂紀錄；可選學員開始寫。';
    const pendingRows = all.flatMap(({ student, lessons }) => lessons
      .filter((lesson) => lesson.status === '待補課')
      .map((lesson) => ({ student, lesson })));
    for (const target of [$('#pending-makeup-list'), $('#schedule-pending-list')]) {
      target.replaceChildren(...pendingRows.map(({ student, lesson }) => boardRow(
        student.data().name || '未填稱呼',
        `原訂 ${lesson.makeupFrom || lesson.date} · ${lesson.kind || '正式課'}`,
        () => openSchedule(student.id, 'makeup', lesson.id)
      )));
      if (!pendingRows.length) target.textContent = '目前沒有待補課的課。';
    }
    const library = $('#material-library');
    const entries = all.flatMap(({ student, lessons }) => lessons
      .filter((lesson) => safeMaterials(lesson.materials).length)
      .map((lesson) => ({ name: student.data().name || '未填稱呼', lesson })));
    for (const draft of activeDrafts) for (const lesson of draftLessons(draft.data())) {
      if (safeMaterials(lesson.materials).length) entries.push({ name: `${draft.data().name}（待綁定）`, lesson });
    }
    library.replaceChildren(...entries.map(({ name, lesson }) => {
      const card = document.createElement('article');
      card.className = 'material-row';
      const heading = document.createElement('strong');
      heading.textContent = `${name} · ${lesson.date}`;
      card.append(heading, materialList(lesson.materials));
      return card;
    }));
    if (!entries.length) library.textContent = '目前還沒有附上教材連結。';
  }).catch(() => {
    todayList.textContent = '目前無法讀取今天的課堂紀錄。';
    $('#pending-makeup-list').textContent = '待補課清單暫時無法載入。';
    $('#schedule-pending-list').textContent = '待補課清單暫時無法載入。';
    $('#material-library').textContent = '目前無法讀取教材清單。';
  });
}

if (portalMode === 'teacher') {
  $('#plans-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const values = new FormData(event.currentTarget);
    const cards = defaultPlans.map((_, index) => Object.fromEntries(
      ['title', 'subtitle', 'price', 'description'].map((key) =>
        [key, String(values.get(`${key}${index}`) || '').trim()])));
    if (cards.some((card) => !card.title || !card.subtitle || !card.price || !card.description)) {
      setMessage('六種課程的名稱、價格與說明都請填寫。', true); return;
    }
    button.disabled = true;
    try {
      const { doc, setDoc, serverTimestamp } = state.sdk.firestore;
      await setDoc(doc(state.db, 'publicPlans', 'pricing'), { cards, updatedAt: serverTimestamp() });
      setMessage('公開課程方案已更新，重新整理課程頁就能看到。');
    } catch { setMessage('課程方案儲存失敗，請稍後再試。', true); }
    finally { button.disabled = false; }
  });
  document.querySelectorAll('[data-work-view]').forEach((button) => button.addEventListener('click', () => {
    const name = button.dataset.workView;
    location.hash = name;
    showWorkPane(name);
  }));
  document.querySelectorAll('[data-open-work]').forEach((button) => button.addEventListener('click', () =>
    showWorkPane(button.dataset.openWork)));
  $('#classwork-open').addEventListener('click', () => openStudentEditor($('#classwork-student').value, true));
  $('#preview-open').addEventListener('click', () => void openStudentPreview($('#preview-student').value));
  $('#schedule-student').addEventListener('change', () => void refreshScheduleLessons());
  $('#schedule-action').addEventListener('change', () => void refreshScheduleLessons());
  $('#schedule-form').addEventListener('submit', saveSchedule);
  $('#student-search').addEventListener('input', (event) => {
    const query = event.target.value.trim().toLocaleLowerCase();
    document.querySelectorAll('.student-editor[data-student-id]').forEach((card) => {
      card.hidden = !card.dataset.search.includes(query);
    });
  });
  window.addEventListener('hashchange', () => showWorkPane(location.hash.slice(1)));
  showWorkPane(location.hash.slice(1));
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

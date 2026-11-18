const HEADERS = [
  '送出時間', '稱呼', 'Gmail', '日文程度', '學習原因', '學習目標',
  '希望上課時間', '希望學到的內容', '得知來源', 'IG 帳號', '其他留言', '確認信狀態'
];
const LEVELS = [
  '沒有學過', '50 音程度', '初級／N5', '初中級／N4', '中級／N3',
  '中高級／N2', '高級／N1', '不確定，想讓老師幫我評估'
];
const SOURCES = ['黑犬星球痞客邦', '學日文大小事podcast', '黑犬星球ＩＧ', 'Threads', '其他'];
const SITE_URL = 'https://blackdog-japanese-lessons.pages.dev/';
const DAILY_LIMIT = 50;

function setup() {
  const properties = PropertiesService.getScriptProperties();
  const existing = properties.getProperty('SHEET_ID');
  if (existing) return SpreadsheetApp.openById(existing).getUrl();
  const spreadsheet = SpreadsheetApp.create('黑犬星球｜試上申請');
  const sheet = spreadsheet.getSheets()[0];
  sheet.setName('申請紀錄');
  sheet.appendRow(HEADERS);
  sheet.setFrozenRows(1);
  properties.setProperty('SHEET_ID', spreadsheet.getId());
  MailApp.getRemainingDailyQuota();
  const url = spreadsheet.getUrl();
  console.log(url);
  return url;
}

function doGet() {
  return page('請從黑犬星球網站填寫試上申請。', true);
}

function doPost(e) {
  const params = (e && e.parameter) || {};
  if (params.website) return page('謝謝你完成表單填寫❤️', false);
  const data = {
    name: value(params.name, 80),
    email: value(params.email, 120).toLowerCase(),
    level: value(params.level, 80),
    availability: value(params.availability, 200),
    reason: value(params.reason, 1200),
    goal: value(params.goal, 1200),
    learningWish: value(params.learningWish, 1200),
    source: value(params.source, 80),
    otherSource: value(params.otherSource, 120),
    instagram: value(params.instagram, 120),
    message: value(params.message, 1200)
  };
  if (!valid(data)) return page('表單資料有誤，請返回檢查後再送出。', true);
  const properties = PropertiesService.getScriptProperties();
  const sheetId = properties.getProperty('SHEET_ID');
  if (!sheetId) return page('申請服務暫時無法使用，請稍後再試。', true);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const cache = CacheService.getScriptCache();
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data.email);
    const cacheKey = 'recent-' + Utilities.base64EncodeWebSafe(digest).slice(0, 40);
    if (cache.get(cacheKey)) return page('這個 Gmail 剛送出過申請，請先查看確認信。', false);
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
    const dailyCount = properties.getProperty('DAY_COUNT_DATE') === today
      ? Number(properties.getProperty('DAY_COUNT') || 0) : 0;
    if (dailyCount >= DAILY_LIMIT) return page('今日申請已達上限，請直接 IG 私訊「黑犬星球」聯繫。', true);
    const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
    const source = data.source === '其他' ? `其他：${data.otherSource}` : data.source;
    sheet.appendRow([
      new Date(), safeCell(data.name), data.email, data.level,
      safeCell(data.reason), safeCell(data.goal), safeCell(data.availability),
      safeCell(data.learningWish), safeCell(source), safeCell(data.instagram),
      safeCell(data.message), '待寄送'
    ]);
    const row = sheet.getLastRow();
    properties.setProperties({ DAY_COUNT_DATE: today, DAY_COUNT: String(dailyCount + 1) });
    cache.put(cacheKey, '1', 600);
    let sent = false;
    try {
      if (MailApp.getRemainingDailyQuota() > 0) {
        MailApp.sendEmail({
          to: data.email,
          subject: '黑犬星球｜已收到你的試上申請',
          body: `你好，${data.name}：\n\n我們已收到你的試上申請。老師會再用你留下的方式聯繫，確認 15 分鐘免費小課的時間。\n\n謝謝你完成表單填寫❤️\n如需更改試上時間，請直接 IG 私訊「黑犬星球」聯繫～\n\nお会いできるのを楽しみにしています。\n\n黑犬星球`
        });
        sent = true;
      }
    } catch (mailError) {
      console.error('確認信寄送失敗：' + mailError);
    }
    sheet.getRange(row, 12).setValue(sent ? '已寄出' : '未寄出，請人工聯繫');
    return page(sent ? '謝謝你完成表單填寫❤️' : '申請已收到，但確認信暫時無法寄出。請用 IG 私訊黑犬星球確認。', false);
  } catch (error) {
    console.error('申請處理失敗：' + error);
    return page('申請暫時無法完成，請稍後再試。', true);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function value(input, maxLength) {
  return String(input || '').trim().slice(0, maxLength + 1);
}

function valid(data) {
  return data.name && data.name.length <= 80
    && /^[a-z0-9._%+\-]+@gmail\.com$/.test(data.email)
    && LEVELS.indexOf(data.level) !== -1
    && data.availability && data.availability.length <= 200
    && data.reason && data.reason.length <= 1200
    && data.goal && data.goal.length <= 1200
    && data.learningWish && data.learningWish.length <= 1200
    && SOURCES.indexOf(data.source) !== -1
    && (data.source !== '其他' || (data.otherSource && data.otherSource.length <= 120))
    && data.instagram.length <= 120 && data.message.length <= 1200;
}

function safeCell(input) {
  return /^[=+\-@\t\r]/.test(input) ? "'" + input : input;
}

function page(message, isError) {
  const heading = isError ? '請再試一次' : '送出成功';
  const note = isError ? '' : '<p>如需更改試上時間，請直接 IG 私訊「黑犬星球」聯繫～<br>お会いできるのを楽しみにしています。</p>';
  return HtmlService.createHtmlOutput(`<!doctype html><html lang="zh-Hant"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>黑犬星球｜試上申請</title><style>body{font:16px/1.7 system-ui,sans-serif;background:#fbf7ef;color:#20201e;margin:0;display:grid;min-height:100vh;place-items:center;padding:24px}main{max-width:560px;background:#fffdf9;border:1px solid #ddd5ca;border-radius:16px;padding:36px;box-shadow:0 18px 50px #2f2a231f}h1{font-size:2rem;margin:0 0 12px}a{color:#315f52;font-weight:700}</style></head><body><main><h1>${heading}</h1><p>${message}</p>${note}<a href="${SITE_URL}">返回黑犬星球課程介紹</a></main></body></html>`);
}

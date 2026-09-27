/* MV3 service worker: validates, downloads and relays user-triggered captures. */
const CSU_URL = /^https?:\/\/csujwc\.its\.csu\.edu\.cn\//i;
const APP_URL = /^http:\/\/(?:127\.0\.0\.1|localhost):517[346]\//i;
const STORE_KEY = 'latestCsuScheduleCapture';
const MAX_COURSES = 500;
const MAX_PAYLOAD_CHARS = 1_500_000;
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

const csvText = (value) => String(value == null ? '' : value)
  .normalize('NFKC')
  .replace(/\u00a0/g, ' ')
  .replace(/[\u200b\ufeff]/g, '')
  .replace(/[ \t]+/g, ' ')
  .trim();

const csvCell = (value) => {
  const raw = csvText(value);
  // Prevent spreadsheet applications from treating imported course text as
  // a formula. Full-width variants are caught because csvText applies NFKC.
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const weeksWithParity = (course) => {
  let weeks = csvText(course.weeks);
  if (!weeks || /(?:单|双|odd|even)/i.test(weeks)) return weeks;
  const parity = csvText(course.weekParity).toLocaleLowerCase();
  if (parity === 'odd' || parity === '单' || parity === '单周') weeks += '单';
  if (parity === 'even' || parity === '双' || parity === '双周') weeks += '双';
  return weeks;
};

/** Build the UTF-8 BOM CSV accepted by WakeUp and this project's importer. */
const buildScheduleCsv = (payload) => {
  const rows = [['课程名称', '星期', '开始节数', '结束节数', '老师', '地点', '周数', '兴趣标签']];
  const courses = Array.isArray(payload?.courses) ? payload.courses : [];
  courses.forEach((course) => {
    const weekday = Number(course.weekday);
    rows.push([
      csvText(course.name),
      Number.isInteger(weekday) && weekday >= 1 && weekday <= 7 ? `星期${WEEKDAYS[weekday - 1]}` : '',
      Number.isInteger(Number(course.startPeriod)) ? String(Number(course.startPeriod)) : '',
      Number.isInteger(Number(course.endPeriod)) ? String(Number(course.endPeriod)) : '',
      csvText(course.teacher),
      csvText(course.location || course.buildingName),
      weeksWithParity(course),
      Array.isArray(course.tags) ? course.tags.map(csvText).filter(Boolean).join('|') : '',
    ]);
  });
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
};

const scheduleDownloadFilename = (payload, fallbackDate = new Date()) => {
  const capturedAt = new Date(payload?.capturedAt || fallbackDate);
  const date = Number.isNaN(capturedAt.getTime()) ? fallbackDate : capturedAt;
  const stamp = date.toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
    .replace('T', '-');
  return `CSU课表-${stamp}.csv`;
};

/** Encode without relying on a temporary page or blob URL in the MV3 worker. */
const scheduleCsvDataUrl = (csv) => {
  const bytes = new TextEncoder().encode(csv);
  let binary = '';
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:text/csv;charset=utf-8;base64,${btoa(binary)}`;
};

const isCsuTab = (tab) => Boolean(tab && typeof tab.url === 'string' && CSU_URL.test(tab.url));
const isAppTab = (tab) => Boolean(tab && typeof tab.url === 'string' && APP_URL.test(tab.url));

const text = (value, limit = 500) => typeof value === 'string' ? value.normalize('NFKC').trim().slice(0, limit) : '';

const safeCourse = (value) => {
  if (!value || typeof value !== 'object') return null;
  const course = value;
  const result = {
    id: text(course.id, 120),
    name: text(course.name, 300),
    title: text(course.title, 1_200),
    teacher: text(course.teacher, 300),
    weekday: Number(course.weekday),
    startPeriod: Number(course.startPeriod),
    endPeriod: Number(course.endPeriod),
    periods: text(course.periods, 80),
    weeks: text(course.weeks, 200),
    weekParity: text(course.weekParity, 40),
    location: text(course.location, 300),
    buildingName: text(course.buildingName, 300),
    source: 'csu-browser-extension',
  };
  if (!result.name || !Number.isInteger(result.weekday) || result.weekday < 1 || result.weekday > 7) return null;
  if (!Number.isInteger(result.startPeriod) || result.startPeriod < 1 || result.startPeriod > 14) return null;
  if (!Number.isInteger(result.endPeriod) || result.endPeriod < result.startPeriod || result.endPeriod > 14) return null;
  return result;
};

const validatePayload = (value) => {
  if (!value || typeof value !== 'object' || value.source !== 'csu-browser-extension') return null;
  const courses = Array.isArray(value.courses) ? value.courses.slice(0, MAX_COURSES).map(safeCourse).filter(Boolean) : [];
  if (!courses.length) return null;
  const page = value.page && typeof value.page === 'object' ? value.page : {};
  const payload = {
    source: 'csu-browser-extension',
    version: 1,
    captureId: text(value.captureId, 120),
    capturedAt: text(value.capturedAt, 80) || new Date().toISOString(),
    page: {
      host: text(page.host, 120),
      path: text(page.path, 500),
      title: text(page.title, 160),
    },
    courses,
    meta: value.meta && typeof value.meta === 'object' ? {
      parser: text(value.meta.parser, 80),
      documentCount: Number(value.meta.documentCount) || 0,
      tableCount: Number(value.meta.tableCount) || 0,
      jsonCount: Number(value.meta.jsonCount) || 0,
    } : {},
  };
  try {
    if (JSON.stringify(payload).length > MAX_PAYLOAD_CHARS) return null;
  } catch {
    return null;
  }
  return payload;
};

const storageArea = () => chrome.storage.session || chrome.storage.local;

const saveLatest = async (payload) => {
  await storageArea().set({ [STORE_KEY]: payload });
};

const readLatest = async () => {
  const result = await storageArea().get(STORE_KEY);
  return result && result[STORE_KEY] ? result[STORE_KEY] : null;
};

const sendToTab = async (tabId, message) => {
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    return false;
  }
};

const relayToOpenApps = async (payload) => {
  const tabs = await chrome.tabs.query({ url: [
    'http://127.0.0.1:5173/*', 'http://127.0.0.1:5174/*',
    'http://localhost:5173/*', 'http://localhost:5174/*',
    'http://127.0.0.1:5176/*', 'http://localhost:5176/*',
  ] });
  const results = await Promise.all(tabs.filter((tab) => isAppTab(tab) && tab.id != null).map((tab) => sendToTab(tab.id, {
    type: 'CSU_SCHEDULE_CAPTURED',
    payload,
  })));
  return results.filter(Boolean).length;
};

const downloadScheduleCsv = async (payload) => {
  const filename = scheduleDownloadFilename(payload);
  const url = scheduleCsvDataUrl(buildScheduleCsv(payload));
  const downloadId = await new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename, saveAs: false, conflictAction: 'uniquify' }, (value) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      if (!Number.isInteger(value)) {
        reject(new Error('浏览器没有创建下载任务。'));
        return;
      }
      resolve(value);
    });
  });
  return { downloadId, downloadFilename: filename };
};

const processCapture = async (payload) => {
  let cached = false;
  let cacheError;
  try {
    await saveLatest(payload);
    cached = true;
  } catch (error) {
    cacheError = error instanceof Error ? error.message : String(error);
  }
  let delivered = 0;
  let relayError;
  try {
    delivered = await relayToOpenApps(payload);
  } catch (error) {
    relayError = error instanceof Error ? error.message : String(error);
  }
  try {
    const download = await downloadScheduleCsv(payload);
    return {
      ok: true,
      cached,
      cacheError,
      delivered,
      relayError,
      courseCount: payload.courses.length,
      downloaded: true,
      ...download,
    };
  } catch (error) {
    return {
      ok: true,
      cached,
      cacheError,
      delivered,
      relayError,
      courseCount: payload.courses.length,
      downloaded: false,
      downloadError: error instanceof Error ? error.message : String(error),
    };
  }
};

const responseError = (sendResponse, error) => {
  sendResponse({ ok: false, error });
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return undefined;

  if (message.type === 'CSU_CAPTURE_RESULT') {
    if (!isCsuTab(sender.tab)) {
      responseError(sendResponse, '只接受来自 CSU 教务系统页面的抓取结果。');
      return undefined;
    }
    const payload = validatePayload(message.payload);
    if (!payload) {
      responseError(sendResponse, '抓取结果为空或格式不受支持。');
      return undefined;
    }
    (async () => {
      try {
        sendResponse(await processCapture(payload));
      } catch (error) {
        responseError(sendResponse, `本地保存失败：${error instanceof Error ? error.message : String(error)}`);
      }
    })();
    return true;
  }

  if (message.type === 'CSU_CAPTURE_ACTIVE') {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        const tab = tabs.find(isCsuTab);
        if (!tab || tab.id == null) {
          responseError(sendResponse, '请先切换到已登录的 CSU 教务课表页面。');
          return;
        }
        const result = await new Promise((resolve) => {
          chrome.tabs.sendMessage(tab.id, { type: 'CSU_CAPTURE_NOW' }, (value) => {
            const runtimeError = chrome.runtime.lastError;
            resolve(runtimeError ? { ok: false, error: runtimeError.message } : (value || { ok: false, error: '课表页面尚未准备好。' }));
          });
        });
        if (!result || result.ok === false) {
          sendResponse(result);
          return;
        }
        const payload = validatePayload(result.payload);
        if (!payload) {
          responseError(sendResponse, '抓取结果为空或格式不受支持。');
          return;
        }
        sendResponse(await processCapture(payload));
      } catch (error) {
        responseError(sendResponse, error instanceof Error ? error.message : String(error));
      }
    })();
    return true;
  }

  if (message.type === 'CSU_APP_READY') {
    if (!isAppTab(sender.tab) || sender.tab.id == null) {
      responseError(sendResponse, '不是受支持的本机课表页面。');
      return undefined;
    }
    (async () => {
      try {
        const payload = await readLatest();
        if (payload) await sendToTab(sender.tab.id, { type: 'CSU_SCHEDULE_CAPTURED', payload, replay: true });
        sendResponse({ ok: true, hasCapture: Boolean(payload), courseCount: payload?.courses?.length || 0 });
      } catch (error) {
        responseError(sendResponse, error instanceof Error ? error.message : String(error));
      }
    })();
    return true;
  }

  if (message.type === 'CSU_GET_LATEST') {
    (async () => {
      try {
        const payload = await readLatest();
        sendResponse({ ok: true, payload });
      } catch (error) {
        responseError(sendResponse, error instanceof Error ? error.message : String(error));
      }
    })();
    return true;
  }

  if (message.type === 'CSU_CLEAR_LATEST') {
    (async () => {
      try {
        await storageArea().remove(STORE_KEY);
        sendResponse({ ok: true });
      } catch (error) {
        responseError(sendResponse, error instanceof Error ? error.message : String(error));
      }
    })();
    return true;
  }

  return undefined;
});

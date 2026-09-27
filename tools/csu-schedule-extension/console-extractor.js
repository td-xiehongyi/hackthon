/*
 * CSU 课表 DevTools Console 兜底提取器
 *
 * 用法：在已经登录、且已经显示“我的课表”的 csujwc.its.csu.edu.cn 页面，
 * 打开 DevTools -> Console，粘贴本文件的全部内容。脚本会在页面右下角
 * 放置一个按钮；只有用户点击按钮时才读取当前页面已经渲染的表格，并在
 * 浏览器本地生成 WakeUp 兼容 CSV。
 *
 * This file intentionally has no network or credential access. It does not make
 * requests, inspect form controls, or persist data. It only walks the current
 * document (and same-origin frames that are already part of that document).
 */
(() => {
  'use strict';

  const root = globalThis;
  const API_KEY = '__CSU_SCHEDULE_CONSOLE_EXTRACTOR__';
  const HOST_ID = 'csu-schedule-console-extractor';
  const SOURCE = 'csu-console-extractor';
  const VERSION = 1;
  const CSU_HOST = /^csujwc\.its\.csu\.edu\.cn$/i;
  const MAX_COURSES = 500;
  const MAX_SCRIPT_TEXT = 700_000;
  const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
  const SENSITIVE_LABEL = /^(?:登录)?(?:密码|验证码|用户名|登录名|账号登录)(?:\s*[:：=].*)?$|^(?:password|captcha|username)(?:\s*[:：=].*)?$/i;

  // Pasting the file a second time should replace the old panel instead of
  // leaving several buttons stacked on top of one another.
  try {
    if (root[API_KEY] && typeof root[API_KEY].destroy === 'function') root[API_KEY].destroy();
  } catch {
    // A stale panel must never prevent a fresh extractor from being installed.
  }

  const clean = (value) => String(value == null ? '' : value)
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\ufeff]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();

  const compact = (value) => clean(value).replace(/\s+/g, '');

  const weekday = (value) => {
    const text = compact(value).replace(/^星期/, '').replace(/^周/, '');
    if (/^[1-7]$/.test(text)) return Number(text);
    const index = WEEKDAYS.indexOf(text);
    if (index >= 0) return index + 1;
    const english = {
      mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
      wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4,
      thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
      sun: 7, sunday: 7,
    };
    return english[text.toLowerCase()] || null;
  };

  // The legacy CSU JSON uses Sunday=1, Monday=2, ..., Saturday=7.
  const csuColumnToWeekday = (value) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 7
      ? ((number + 5) % 7) + 1
      : null;
  };

  const periodRange = (value) => {
    const text = clean(value);
    if (!text) return null;
    const explicit = text.match(/(?:第\s*)?(\d{1,2})\s*[-~～—–至到、，,]\s*(\d{1,2})/);
    if (explicit) return [Number(explicit[1]), Number(explicit[2])];
    // Old CSU responses use compact section strings such as 0708节 or 01020304.
    const compactRun = text.match(/(?<!\d)((?:\d{2}){2,})(?!\d)/);
    if (compactRun) {
      const parts = compactRun[1].match(/\d{2}/g) || [];
      if (parts.length >= 2) return [Number(parts[0]), Number(parts[parts.length - 1])];
    }
    // A clock range is not a section range.
    if (/\b\d{1,2}\s*:\s*\d{2}\b/.test(text)) return null;
    const numbers = text.match(/\d{1,2}/g);
    if (!numbers || !numbers.length) return null;
    return [Number(numbers[0]), Number(numbers[1] || numbers[0])];
  };

  const labelled = (text, labels) => {
    const lines = String(text || '').split(/\r?\n/).map(clean).filter(Boolean);
    for (const line of lines) {
      for (const label of labels) {
        const match = line.match(new RegExp(`^${label}\\s*[:：]\\s*(.+)$`, 'i'));
        if (match) return clean(match[1]);
      }
    }
    return '';
  };

  const fieldFromTitle = (title) => {
    const value = compact(title);
    if (/课程名称|课程名|科目/.test(value)) return 'name';
    if (/老师|教师|任课/.test(value)) return 'teacher';
    if (/周次|教学周/.test(value)) return 'weeks';
    if (/单双周|周类型/.test(value)) return 'parity';
    if (/节次|上课时间|时间段/.test(value)) return 'periods';
    if (/地点|教室|场地/.test(value)) return 'location';
    return null;
  };

  const hash = (value) => {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  };

  const makeCourse = (raw) => {
    const name = clean(raw.name);
    const day = Number(raw.weekday);
    const start = Number(raw.startPeriod);
    const end = Number(raw.endPeriod || raw.startPeriod);
    if (!name || SENSITIVE_LABEL.test(name) || !Number.isInteger(day) || day < 1 || day > 7) return null;
    if (!Number.isInteger(start) || start < 1 || start > 14 || !Number.isInteger(end) || end < start || end > 14) return null;
    if (SENSITIVE_LABEL.test(clean(raw.teacher)) || SENSITIVE_LABEL.test(clean(raw.location))) return null;
    const weeks = clean(raw.weeks);
    const parity = clean(raw.weekParity);
    const location = clean(raw.location);
    return {
      id: `csu-console-${hash(`${name}|${day}|${start}|${end}|${raw.teacher || ''}|${location}|${weeks}`)}`,
      name,
      teacher: clean(raw.teacher),
      weekday: day,
      startPeriod: start,
      endPeriod: end,
      periods: `${start}-${end}`,
      weeks,
      weekParity: parity,
      location,
      buildingName: location,
      source: SOURCE,
    };
  };

  const directTextChunks = (node) => {
    const chunks = [];
    const visit = (current) => {
      if (!current) return;
      if (current.nodeType === 3) {
        const value = clean(current.nodeValue);
        if (value) chunks.push(value);
        return;
      }
      if (current.nodeType !== 1) return;
      const element = current;
      if (element.matches && element.matches('font[title], [data-field], [data-label]')) return;
      Array.from(element.childNodes || []).forEach(visit);
    };
    Array.from(node?.childNodes || []).forEach(visit);
    return chunks;
  };

  const titleFields = (cell) => {
    const elements = Array.from(cell.querySelectorAll('font[title], [data-field][title], [data-label][title]'));
    const groups = [];
    let current = null;
    for (const element of elements) {
      const field = fieldFromTitle(element.getAttribute('title') || '');
      const value = clean(element.textContent);
      if (!field || !value) continue;
      if ((field === 'teacher' && current?.teacher)
        || (field === 'name' && current?.name && (current.teacher || current.weeks || current.location))) {
        groups.push(current);
        current = null;
      }
      if (!current) current = {};
      current[field] = value;
    }
    if (current && Object.keys(current).length) groups.push(current);
    return groups;
  };

  const isMetadataLine = (value) => /^(?:课程名称|课程名|上课教师|教师|老师|周次|星期|节次|上课地点|地点|单双周)\s*[:：]/.test(value);

  const coursesFromCell = (cell, day, startPeriod, endPeriod) => {
    if (!cell || !day || !startPeriod) return [];
    const groups = titleFields(cell);
    const names = directTextChunks(cell).filter((value) => !isMetadataLine(value));
    const fullText = clean(cell.innerText || cell.textContent || '');
    const fallbackName = names[0] || clean(fullText.split(/\r?\n/)[0]);
    const records = groups.length ? groups : [{}];
    return records.map((group, index) => {
      const name = clean(group.name || names[index] || fallbackName);
      if (!name || SENSITIVE_LABEL.test(name)) return null;
      const localPeriods = periodRange(group.periods || '');
      return makeCourse({
        name,
        teacher: group.teacher || '',
        weekday: day,
        startPeriod: localPeriods?.[0] || startPeriod,
        endPeriod: localPeriods?.[1] || endPeriod,
        weeks: group.weeks || '',
        weekParity: group.parity || '',
        location: group.location || '',
      });
    }).filter(Boolean);
  };

  const tableGeometry = (table) => {
    const cells = [];
    const occupied = [];
    let maxColumn = 0;
    Array.from(table.rows || []).forEach((row, rowIndex) => {
      if (!occupied[rowIndex]) occupied[rowIndex] = [];
      let column = 0;
      Array.from(row.cells || []).forEach((cell) => {
        while (occupied[rowIndex][column]) column += 1;
        const colspan = Math.max(1, Number(cell.getAttribute('colspan') || 1));
        const rowspan = Math.max(1, Number(cell.getAttribute('rowspan') || 1));
        for (let r = rowIndex; r < rowIndex + rowspan; r += 1) {
          if (!occupied[r]) occupied[r] = [];
          for (let c = column; c < column + colspan; c += 1) occupied[r][c] = true;
        }
        cells.push({ cell, row: rowIndex, column, colspan, rowspan });
        column += colspan;
        maxColumn = Math.max(maxColumn, column);
      });
    });
    return { cells, rowCount: (table.rows || []).length, columnCount: maxColumn };
  };

  const tableWeekdayHeaders = (table, geometry) => {
    const byColumn = new Map();
    const rowCounts = new Map();
    for (const entry of geometry.cells) {
      const value = clean(entry.cell.textContent);
      const day = weekday(value);
      if (!day || !/(?:星期|周|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.test(value)) continue;
      rowCounts.set(entry.row, (rowCounts.get(entry.row) || 0) + 1);
    }
    const headerRow = [...rowCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!headerRow || headerRow[1] < 3) return { byColumn, row: -1 };
    for (const entry of geometry.cells.filter((candidate) => candidate.row === headerRow[0])) {
      const day = weekday(clean(entry.cell.textContent));
      if (!day) continue;
      for (let column = entry.column; column < entry.column + entry.colspan; column += 1) byColumn.set(column, day);
    }
    return { byColumn, row: headerRow[0] };
  };

  const explicitSlot = (cell) => {
    for (const attribute of ['data-jc', 'data-period', 'data-section', 'data-jcs', 'title']) {
      const range = periodRange(cell?.getAttribute?.(attribute) || '');
      if (range) return range;
    }
    return null;
  };

  const parseLegacyTable = (table) => {
    const contentCells = Array.from(table.querySelectorAll('td .kbcontent'));
    if (!contentCells.length) return [];
    const geometry = tableGeometry(table);
    const headers = tableWeekdayHeaders(table, geometry);
    const byElement = new Map(geometry.cells.map((entry) => [entry.cell, entry]));
    const usesRowMajorFallback = contentCells.length >= 35 && headers.byColumn.size < 3;
    const rowCellCounts = new Map();
    geometry.cells.forEach((entry) => rowCellCounts.set(entry.row, (rowCellCounts.get(entry.row) || 0) + 1));
    const gridRows = [...rowCellCounts.entries()].filter(([, count]) => count >= 7).map(([row]) => row).sort((a, b) => a - b);
    const firstGridRow = gridRows.length ? gridRows[0] : 0;
    const hasPeriodLabelColumn = geometry.columnCount >= 8;
    const courses = [];
    contentCells.forEach((contentCell, index) => {
      const td = contentCell.closest('td');
      const entry = td ? byElement.get(td) : null;
      let day = entry ? headers.byColumn.get(entry.column) : null;
      let start = null;
      let end = null;
      const explicit = explicitSlot(td || contentCell);
      if (explicit) { start = explicit[0]; end = explicit[1]; }
      if (usesRowMajorFallback) {
        if (entry) {
          day = hasPeriodLabelColumn ? entry.column : entry.column + 1;
          const group = Math.max(0, entry.row - firstGridRow);
          start = start || group * 2 + 1;
        } else {
          day = (index % 7) + 1;
          start = start || Math.floor(index / 7) * 2 + 1;
        }
        end = end || start + 1;
      } else if (entry) {
        if (!day) {
          if (geometry.columnCount >= 8) day = entry.column;
          else if (geometry.columnCount >= 7) day = entry.column + 1;
        }
        if (!start) {
          const rowOffset = headers.row >= 0 ? entry.row - headers.row - 1 : entry.row;
          const group = Math.max(0, rowOffset);
          start = group * 2 + 1;
          end = start + Math.max(1, entry.rowspan) * 2 - 1;
        }
      }
      if (day && start) courses.push(...coursesFromCell(contentCell, day, start, end || start + 1));
    });
    return courses;
  };

  const tableHeaderMapping = (rows) => {
    const aliases = {
      name: ['课程名称', '课程名', '课程', '科目', 'course', 'name', 'title'],
      teacher: ['教师', '老师', '任课教师', 'teacher', 'instructor'],
      weekday: ['星期', '周几', '上课星期', 'weekday', 'day'],
      periods: ['节次', '节数', '上课节次', '时间段', 'period', 'section'],
      start: ['开始节次', '起始节次', 'startperiod'],
      end: ['结束节次', '终止节次', 'endperiod'],
      weeks: ['周次', '教学周', 'weeks', 'week'],
      parity: ['单双周', '周类型', 'parity'],
      location: ['地点', '上课地点', '教室', '上课教室', 'location', 'room'],
    };
    const normalize = (value) => compact(value).toLocaleLowerCase('zh-CN');
    let best = null;
    rows.forEach((row, index) => {
      const mapping = {};
      Object.entries(aliases).forEach(([field, names]) => {
        const column = row.findIndex((value) => names.some((name) => {
          const header = normalize(value); const alias = normalize(name);
          return header === alias || header.startsWith(alias) || header.endsWith(alias);
        }));
        if (column >= 0) mapping[field] = column;
      });
      const score = (mapping.name !== undefined ? 3 : 0)
        + (mapping.weekday !== undefined ? 2 : 0)
        + ((mapping.periods !== undefined || mapping.start !== undefined) ? 2 : 0)
        + (mapping.weeks !== undefined ? 2 : 0)
        + (mapping.location !== undefined ? 1 : 0);
      if (!best || score > best.score) best = { score, index, mapping };
    });
    return best && best.score >= 5 ? best : null;
  };

  const parseGenericTable = (table) => {
    const rows = Array.from(table.rows || []).map((row) => Array.from(row.cells || []).map((cell) => clean(cell.textContent))).filter((row) => row.some(Boolean));
    const selected = tableHeaderMapping(rows);
    if (!selected) return [];
    const courses = [];
    rows.slice(selected.index + 1).forEach((row) => {
      if (row.some((value) => SENSITIVE_LABEL.test(value))) return;
      const at = (field) => selected.mapping[field] === undefined ? '' : clean(row[selected.mapping[field]]);
      const name = at('name');
      const day = weekday(at('weekday'));
      const range = periodRange(at('periods')) || [Number(at('start')), Number(at('end') || at('start'))];
      if (!name || !day || !range[0]) return;
      const course = makeCourse({ name, teacher: at('teacher'), weekday: day, startPeriod: range[0], endPeriod: range[1] || range[0], weeks: at('weeks'), weekParity: at('parity'), location: at('location') });
      if (course) courses.push(course);
    });
    return courses;
  };

  const jsonItems = (value) => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];
    for (const key of ['courses', 'course', 'data', 'rows', 'list', 'kbList', 'kbdata']) {
      if (Array.isArray(value[key])) return value[key];
      if (value[key] && typeof value[key] === 'object') {
        const nested = jsonItems(value[key]);
        if (nested.length) return nested;
      }
    }
    return [];
  };

  const jsonCourse = (item) => {
    if (!item || typeof item !== 'object') return null;
    const raw = item;
    const title = typeof raw.title === 'string' ? raw.title : '';
    const name = labelled(title, ['课程名称', '课程名']) || clean(raw.name || raw.courseName || raw.kcmc);
    const teacher = labelled(title, ['上课教师', '教师', '老师']) || clean(raw.teacher || raw.instructor);
    const weeks = labelled(title, ['周次', '教学周']) || clean(raw.weeks || raw.week);
    const parity = labelled(title, ['单双周', '周类型']) || clean(raw.weekParity || raw.parity);
    const location = labelled(title, ['上课地点', '地点', '教室']) || clean(raw.location || raw.room || raw.classroom);
    const dayText = labelled(title, ['星期', '上课星期']) || clean(raw.weekday || raw.day);
    const day = weekday(dayText) || csuColumnToWeekday(raw.xq);
    const range = periodRange(labelled(title, ['节次', '上课节次']) || raw.periods || raw.sections || raw.section || '')
      || [Number(raw.startPeriod || raw.start), Number(raw.endPeriod || raw.end || raw.startPeriod || raw.start)];
    if (!name || !day || !range[0] || (!title && !raw.name && !raw.courseName)) return null;
    return makeCourse({ name, teacher, weekday: day, startPeriod: range[0], endPeriod: range[1] || range[0], weeks, weekParity: parity, location });
  };

  const balancedJsonSlices = (text) => {
    const slices = [];
    const source = text.slice(0, MAX_SCRIPT_TEXT);
    for (let start = 0; start < source.length; start += 1) {
      if (source[start] !== '[' && source[start] !== '{') continue;
      const opening = source[start]; const closing = opening === '[' ? ']' : '}';
      let depth = 0; let quoted = false; let escaped = false;
      for (let index = start; index < source.length; index += 1) {
        const character = source[index];
        if (quoted) {
          if (escaped) escaped = false;
          else if (character === '\\') escaped = true;
          else if (character === '"') quoted = false;
          continue;
        }
        if (character === '"') { quoted = true; continue; }
        if (character === opening || (opening === '{' && character === '[')) depth += 1;
        if (character === closing || (opening === '{' && character === ']')) depth -= 1;
        if (depth === 0) { if (index - start < MAX_SCRIPT_TEXT) slices.push(source.slice(start, index + 1)); break; }
      }
    }
    return slices;
  };

  const parseEmbeddedJson = (doc) => {
    const courses = [];
    const scripts = Array.from(doc.querySelectorAll('script[type="application/json"], script:not([src])'));
    for (const script of scripts) {
      const text = String(script.textContent || '').trim();
      if (!text || text.length > MAX_SCRIPT_TEXT) continue;
      const candidates = /^[\[{]/.test(text) ? [text, ...balancedJsonSlices(text)] : balancedJsonSlices(text);
      for (const candidate of candidates) {
        let parsed;
        try { parsed = JSON.parse(candidate); } catch { continue; }
        const items = jsonItems(parsed);
        if (!items.length || !items.some((item) => item && typeof item === 'object' && (item.title || item.kcmc || item.name))) continue;
        items.forEach((item) => { const course = jsonCourse(item); if (course) courses.push(course); });
      }
    }
    return courses;
  };

  const collectDocuments = (current, result = [], seen = new Set(), depth = 0) => {
    if (!current || seen.has(current) || depth > 4) return result;
    seen.add(current); result.push(current);
    Array.from(current.querySelectorAll ? current.querySelectorAll('iframe, frame') : []).forEach((frame) => {
      try { if (frame.contentDocument) collectDocuments(frame.contentDocument, result, seen, depth + 1); } catch { /* cross-origin frame: ignore */ }
    });
    return result;
  };

  const signature = (course) => [course.name, course.teacher, course.weekday, course.startPeriod, course.endPeriod, course.weeks, course.location].map(compact).join('|');

  const captureSchedule = () => {
    if (typeof document === 'undefined') return { ok: false, error: '当前环境没有可读取的网页文档。' };
    if (typeof location !== 'undefined' && location.hostname && !CSU_HOST.test(location.hostname)) {
      return { ok: false, error: '请切换到已登录的 csujwc.its.csu.edu.cn“我的课表”页面后再提取。' };
    }
    const documents = collectDocuments(document);
    const courses = [];
    let tableCount = 0;
    let jsonCount = 0;
    documents.forEach((doc) => {
      const jsonCourses = parseEmbeddedJson(doc);
      jsonCount += jsonCourses.length;
      courses.push(...jsonCourses);
      const tables = Array.from(doc.querySelectorAll('table'));
      tableCount += tables.length;
      tables.forEach((table) => {
        courses.push(...(table.id === 'kbtable' || table.querySelector('.kbcontent') ? parseLegacyTable(table) : parseGenericTable(table)));
      });
    });
    const unique = [];
    const seen = new Set();
    courses.forEach((course) => {
      if (!course || seen.has(signature(course)) || unique.length >= MAX_COURSES) return;
      seen.add(signature(course)); unique.push(course);
    });
    if (!unique.length) return { ok: false, error: '没有识别到课程。请先打开教务系统的“我的课表”页面，再点击提取。', meta: { documentCount: documents.length, tableCount, jsonCount } };
    return {
      ok: true,
      payload: {
        source: SOURCE,
        version: VERSION,
        capturedAt: new Date().toISOString(),
        page: typeof location === 'undefined' ? {} : { host: location.hostname, path: location.pathname, title: clean(document.title).slice(0, 120) },
        courses: unique,
        meta: { documentCount: documents.length, tableCount, jsonCount, parser: jsonCount ? 'json+dom' : 'dom' },
      },
    };
  };

  const csvText = (value) => clean(value);
  const csvCell = (value) => {
    const raw = csvText(value);
    // Protect spreadsheet applications from interpreting course text as a formula.
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

  const buildCsv = (payload) => {
    const rows = [['课程名称', '星期', '开始节数', '结束节数', '老师', '地点', '周数', '兴趣标签']];
    (Array.isArray(payload?.courses) ? payload.courses : []).forEach((course) => {
      const day = Number(course.weekday);
      rows.push([
        csvText(course.name), Number.isInteger(day) && day >= 1 && day <= 7 ? `星期${WEEKDAYS[day - 1]}` : '',
        Number.isInteger(Number(course.startPeriod)) ? String(Number(course.startPeriod)) : '',
        Number.isInteger(Number(course.endPeriod)) ? String(Number(course.endPeriod)) : '',
        csvText(course.teacher), csvText(course.location), weeksWithParity(course),
        Array.isArray(course.tags) ? course.tags.map(csvText).filter(Boolean).join('|') : '',
      ].map(csvCell));
    });
    return `\uFEFF${rows.map((row) => row.join(',')).join('\r\n')}\r\n`;
  };

  const fileName = (capturedAt) => {
    const date = new Date(capturedAt || Date.now());
    const pad = (value) => String(value).padStart(2, '0');
    return `CSU课表-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.csv`;
  };

  const downloadCsv = (payload) => {
    if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof document === 'undefined') throw new Error('当前浏览器不支持本地文件下载。');
    const filename = fileName(payload?.capturedAt);
    const objectUrl = URL.createObjectURL(new Blob([buildCsv(payload)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    (document.body || document.documentElement).appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
    return filename;
  };

  let panelHost = null;
  const destroy = () => {
    if (panelHost?.isConnected) panelHost.remove();
    panelHost = null;
  };

  const install = () => {
    if (typeof document === 'undefined' || !document.documentElement) return null;
    destroy();
    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.all = 'initial';
    host.style.position = 'fixed';
    host.style.right = '18px';
    host.style.bottom = '18px';
    host.style.zIndex = '2147483647';
    document.documentElement.appendChild(host);
    panelHost = host;
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .panel { width: min(310px, calc(100vw - 32px)); box-sizing: border-box; padding: 13px; border: 1px solid #b9cbbb; border-radius: 11px; background: #fffef7; color: #173c2e; box-shadow: 0 8px 28px rgba(15, 43, 33, .24); font: 13px/1.45 system-ui, -apple-system, "Microsoft YaHei", sans-serif; }
      .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
      .head strong { font-size: 14px; }
      .close { width: 32px; height: 32px; padding: 0; border: 1px solid #c9d6c5; border-radius: 6px; background: #f2f6ed; color: #395c4b; font-size: 19px; line-height: 1; cursor: pointer; }
      .grab { width: 100%; min-height: 44px; border: 1px solid #1e503d; border-radius: 7px; background: #1e503d; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
      .grab:disabled { opacity: .62; cursor: wait; }
      .status { min-height: 20px; margin: 8px 2px 0; color: #617467; font-size: 12px; }
      .status.error { color: #9b4436; }
      .note { margin: 7px 2px 0; color: #738175; font-size: 10px; }
      button:focus-visible { outline: 3px solid #e5b83b; outline-offset: 2px; }
      @media (max-width: 560px) { .panel { width: calc(100vw - 16px); } }
    `;
    shadow.appendChild(style);
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'CSU 课表 Console 提取器');
    const head = document.createElement('div'); head.className = 'head';
    const title = document.createElement('strong'); title.textContent = 'CSU 课表 Console 提取器';
    const close = document.createElement('button'); close.className = 'close'; close.type = 'button'; close.setAttribute('aria-label', '关闭'); close.textContent = '×';
    const grab = document.createElement('button'); grab.className = 'grab'; grab.type = 'button'; grab.textContent = '提取并下载课表 CSV';
    const status = document.createElement('p'); status.className = 'status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.textContent = '只读取当前页面已显示的课表。';
    const note = document.createElement('p'); note.className = 'note'; note.textContent = '文件只在本地生成；不会读取登录信息。';
    head.append(title, close); panel.append(head, grab, status, note); shadow.appendChild(panel);
    const setStatus = (message, error = false) => { status.textContent = message; status.classList.toggle('error', Boolean(error)); };
    grab.addEventListener('click', () => {
      grab.disabled = true;
      try {
        const result = captureSchedule();
        if (!result.ok) { setStatus(result.error, true); return; }
        const filename = downloadCsv(result.payload);
        root[API_KEY].lastPayload = result.payload;
        if (root.console?.table) root.console.table(result.payload.courses.map((course) => ({ 课程: course.name, 星期: `星期${WEEKDAYS[course.weekday - 1]}`, 节次: course.periods, 地点: course.location })));
        setStatus(`已提取 ${result.payload.courses.length} 门课程，文件已下载：${filename}`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error), true);
      } finally {
        grab.disabled = false;
      }
    });
    close.addEventListener('click', destroy);
    return host;
  };

  const api = {
    version: VERSION,
    source: SOURCE,
    capture: captureSchedule,
    buildCsv,
    download: downloadCsv,
    install,
    destroy,
    lastPayload: null,
  };
  root[API_KEY] = api;
  install();
  if (root.console?.info) root.console.info('[CSU 课表] 提取器已就绪：点击页面右下角按钮，或运行 %s.capture()。', API_KEY);
})();

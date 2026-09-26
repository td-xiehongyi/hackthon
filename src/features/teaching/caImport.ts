/**
 * CSU 教务课表导入适配器。
 *
 * This module deliberately has no network or authentication code.  The caller
 * is expected to open the official teaching-system page in a browser, let the
 * student sign in there, and pass the already-rendered schedule table (or a
 * copied table) to one of the parsing functions below.  In particular, this
 * module never reads input/password fields and never receives credentials.
 *
 * CA pages have changed their table labels over time.  The adapter therefore
 * normalises common Chinese labels to the WakeUp seven-column shape and then
 * delegates validation (week ranges, periods, duplicate rows, building names,
 * etc.) to the shared schedule model.
 */

import {
  parseScheduleCsv,
  parseWeekday,
  type BuildingReference,
  type ImportIssue,
  type ImportPreview,
  type ParseScheduleCsvOptions,
  type StorageLike,
} from './model';

/** A DOM node is accepted without requiring a particular browser implementation. */
export type CaScheduleDomSource = Document | Element;

export type CaScheduleInput = string | CaScheduleDomSource;

export interface CaScheduleImportOptions extends ParseScheduleCsvOptions {
  /** Optional label used by callers when displaying the import source. */
  sourceLabel?: string;
}

export type CaScheduleSourceKind = 'dom' | 'html' | 'csv' | 'tsv' | 'json' | 'text';

/** ImportPreview plus diagnostics about how the CA page was recognised. */
export interface CaScheduleImportPreview extends ImportPreview {
  source: CaScheduleSourceKind;
  /** Number of HTML tables inspected (0 for plain text). */
  detectedTableCount: number;
  /** Number of non-empty data rows inspected before validation. */
  detectedRows: number;
  /** Rows that were intentionally ignored (navigation/login/empty rows). */
  skippedRows: number;
  sourceLabel?: string;
}

interface CellMatrix {
  rows: string[][];
  source: CaScheduleSourceKind;
  tableCount: number;
  skippedRows: number;
}

interface HeaderMapping {
  name?: number;
  teacher?: number;
  weekday?: number;
  startPeriod?: number;
  endPeriod?: number;
  periods?: number;
  weeks?: number;
  parity?: number;
  location?: number;
  buildingId?: number;
  buildingName?: number;
  tags?: number;
  notes?: number;
  color?: number;
  /** A catch-all time cell, useful on CA pages with “上课时间”. */
  time?: number;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalize = (value: string): string =>
  value
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\ufeff]/g, '')
    .replace(/\s+/g, '')
    .toLocaleLowerCase('zh-CN');

const nonEmptyRows = (rows: readonly string[][]): string[][] =>
  rows
    .map((row) => row.map((cell) => text(cell)))
    .filter((row) => row.some((cell) => cell !== ''));

/** Labels that identify login/account panels rather than course rows. */
// Match login-field labels, not ordinary course names such as “密码学”.
const SENSITIVE_LABEL = /^(?:登录)?(?:密码|验证码|用户名|登录名|账号登录)(?:\s*[:：=].*)?$|^(?:password|captcha|username)(?:\s*[:：=].*)?$/i;

const rowLooksSensitive = (row: readonly string[]): boolean =>
  row.some((cell) => SENSITIVE_LABEL.test(cell));

/** Markdown table delimiter rows are layout, not course data. */
const rowLooksMarkdownSeparator = (row: readonly string[]): boolean =>
  row.length > 0 && row.every((cell) => /^:?-{3,}:?$/.test(text(cell)));

/** Clock ranges (for example `08:00-09:40`) are not section numbers. */
const looksLikeClockTime = (value: string): boolean =>
  /\b\d{1,2}\s*:\s*\d{2}\b/.test(value.normalize('NFKC'));

const decodeHtml = (value: string): string => {
  // Decode the entities that occur in copied CA tables without depending on a
  // DOM implementation (Vitest and server-side callers may run in Node).
  const named: Record<string, string> = {
    nbsp: ' ',
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
  };
  return value
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (whole, code: string) => {
      const key = String(code).toLocaleLowerCase();
      if (key.startsWith('#x')) {
        const parsed = Number.parseInt(key.slice(2), 16);
        return Number.isInteger(parsed) && parsed >= 0 && parsed <= 0x10ffff
          ? String.fromCodePoint(parsed)
          : whole;
      }
      if (key.startsWith('#')) {
        const parsed = Number.parseInt(key.slice(1), 10);
        return Number.isInteger(parsed) && parsed >= 0 && parsed <= 0x10ffff
          ? String.fromCodePoint(parsed)
          : whole;
      }
      return named[key] ?? whole;
    })
    .replace(/\u00a0/g, ' ');
};

const stripMarkup = (value: string): string =>
  decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p\s*>/gi, '\n')
      .replace(/<[^>]*>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim();

const extractHtmlTables = (html: string): CellMatrix => {
  // Remove executable content and form controls before extraction.  Keep the
  // surrounding form markup itself out of the way, but retain its table
  // content: some teaching-system pages wrap the schedule table in a form for
  // filters or export actions.  Credential-looking rows are filtered again
  // below, so values from a login panel never become course data.
  const safeHtml = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<\/?form\b[^>]*>/gi, ' ')
    .replace(/<input\b[^>]*>/gi, ' ')
    .replace(/<textarea\b[\s\S]*?<\/textarea\s*>/gi, ' ')
    .replace(/<select\b[\s\S]*?<\/select\s*>/gi, ' ')
    .replace(/<button\b[\s\S]*?<\/button\s*>/gi, ' ');

  const tables: string[][][] = [];
  const tablePattern = /<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tablePattern.exec(safeHtml)) !== null) {
    const tableRows: string[][] = [];
    const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowPattern.exec(tableMatch[1])) !== null) {
      const cells: string[] = [];
      const cellPattern = /<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)\s*>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
        cells.push(stripMarkup(cellMatch[1]));
      }
      if (cells.length > 0) tableRows.push(cells);
    }
    if (tableRows.length > 0) tables.push(tableRows);
  }

  const rows = nonEmptyRows(tables.flat()).filter((row) => !rowLooksSensitive(row));
  const skippedRows = tables.flat().length - rows.length;
  return {
    rows,
    source: 'html',
    tableCount: tables.length,
    skippedRows,
  };
};

const extractDomTables = (source: CaScheduleDomSource): CellMatrix => {
  const tables: string[][][] = [];
  const root = source as Document | Element;
  const tableNodes: Element[] = [];
  if (typeof Element !== 'undefined' && root instanceof Element && root.tagName.toLocaleLowerCase() === 'table') {
    tableNodes.push(root);
  }
  // `querySelectorAll` is present on both Document and Element in browsers;
  // guard it for lightweight DOM shims used by consumers/tests.
  if (typeof root.querySelectorAll === 'function') {
    root.querySelectorAll('table').forEach((table) => {
      if (!tableNodes.includes(table)) tableNodes.push(table);
    });
  }
  for (const table of tableNodes) {
    const rows: string[][] = [];
    table.querySelectorAll('tr').forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll('th,td')).map((cell) =>
        text(cell.textContent).replace(/[ \t]+/g, ' ').trim(),
      );
      if (cells.length > 0) rows.push(cells);
    });
    if (rows.length > 0) tables.push(rows);
  }
  const flattened = nonEmptyRows(tables.flat());
  const rows = flattened.filter((row) => !rowLooksSensitive(row));
  return {
    rows,
    source: 'dom',
    tableCount: tables.length,
    skippedRows: flattened.length - rows.length,
  };
};

const splitDelimitedLine = (line: string, delimiter: '\t' | '|'): string[] => {
  const trimmed = line.trim();
  const withoutEdges = delimiter === '|' ? trimmed.replace(/^\|\s*|\s*\|$/g, '') : trimmed;
  return withoutEdges.split(delimiter).map((cell) => cell.trim());
};

const extractTextRows = (input: string): CellMatrix => {
  const normalized = input
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (normalized.length === 0) {
    return { rows: [], source: 'text', tableCount: 0, skippedRows: 0 };
  }

  const hasTabs = normalized.some((line) => line.includes('\t'));
  const hasPipes = !hasTabs && normalized.some((line) => /^\s*\|/.test(line) || line.includes('|'));
  const delimiter: '\t' | '|' | null = hasTabs ? '\t' : hasPipes ? '|' : null;
  if (delimiter) {
    const rawRows = normalized.map((line) => splitDelimitedLine(line, delimiter));
    const rows = rawRows.filter((row) => !rowLooksSensitive(row) && !rowLooksMarkdownSeparator(row));
    return {
      rows: nonEmptyRows(rows),
      source: delimiter === '\t' ? 'tsv' : 'text',
      tableCount: 0,
      skippedRows: rawRows.length - rows.length,
    };
  }

  // Pasted browser text may use two or more spaces as the column separator.
  // Avoid splitting ordinary course names/locations on single spaces.
  const spacedRows = normalized.map((line) => line.split(/\s{2,}/).map((cell) => cell.trim()));
  const spacedHasColumns = spacedRows.some((row) => row.length >= 3);
  if (spacedHasColumns) {
    const rows = spacedRows.filter((row) => !rowLooksSensitive(row));
    return { rows: nonEmptyRows(rows), source: 'text', tableCount: 0, skippedRows: spacedRows.length - rows.length };
  }

  // Finally retain one-cell lines.  `parseLabelledBlocks` can turn these into
  // rows when a CA page exposes labels such as “课程名称：…”.
  const rows = normalized.map((line) => [line]).filter((row) => !rowLooksSensitive(row));
  return { rows, source: 'text', tableCount: 0, skippedRows: normalized.length - rows.length };
};

const semanticAliases: Record<keyof HeaderMapping, readonly string[]> = {
  name: [
    '课程名称',
    '课程名',
    '课程简称',
    '课程',
    '科目',
    '课程中文名称',
    'course',
    'coursename',
    'subject',
    'name',
    'title',
  ],
  teacher: ['教师', '老师', '任课教师', '任课老师', '教师姓名', '教师名称', 'teacher', 'instructor'],
  weekday: ['星期', '星期几', '周几', '上课星期', '上课日期', 'weekday', 'day'],
  startPeriod: ['开始节次', '开始节数', '开始节', '起始节次', 'startperiod', 'startsection'],
  endPeriod: ['结束节次', '结束节数', '结束节', '终止节次', 'endperiod', 'endsection'],
  periods: ['节次', '节数', '上课节次', '时间段', '上课时段', '上课节段', 'periods', 'sections'],
  weeks: ['周次', '周数', '上课周次', '教学周', '上课周', 'weeks', 'week'],
  parity: ['单双周', '周类型', '周次类型', '单双', 'parity'],
  location: ['地点', '上课地点', '教室', '上课教室', '上课场地', '教室名称', 'location', 'classroom', 'room'],
  buildingId: ['楼座id', '教学楼id', '楼栋id', 'buildingid'],
  buildingName: ['楼座', '教学楼', '楼栋', '教学楼名称', 'building', 'buildingname'],
  tags: ['标签', '兴趣标签', '课程标签', '类别', 'tags', 'interests', 'category'],
  notes: ['备注', '说明', 'notes', 'note'],
  color: ['颜色', '色值', 'color'],
  time: ['上课时间', '上课时段', '时间', '上课安排', 'class time', 'classtime'],
};

const headerMatches = (header: string, alias: string): boolean => {
  const normalizedHeader = normalize(header);
  const normalizedAlias = normalize(alias);
  if (!normalizedHeader || !normalizedAlias) return false;
  if (normalizedHeader === normalizedAlias) return true;
  // CA often appends English/administrative hints, e.g. “上课地点(教室)”.
  return normalizedHeader.startsWith(normalizedAlias) || normalizedHeader.endsWith(normalizedAlias);
};

const mapHeaders = (headers: readonly string[]): HeaderMapping => {
  const mapping: HeaderMapping = {};
  const fields = Object.keys(semanticAliases) as (keyof HeaderMapping)[];
  const usedColumns = new Set<number>();

  // Exact labels win first.  Without this pass the generic “节数” alias can
  // claim both “开始节数” and “结束节数” and make the latter appear missing.
  for (const field of fields) {
    const aliases = semanticAliases[field].map(normalize);
    const index = headers.findIndex((header, candidateIndex) =>
      !usedColumns.has(candidateIndex) && aliases.includes(normalize(header)),
    );
    if (index >= 0) {
      mapping[field] = index;
      usedColumns.add(index);
    }
  }

  // Accept decorated labels (for example “上课地点(教室)”) only after exact
  // matches have been assigned, and never reuse a semantic column.
  for (const field of fields) {
    if (mapping[field] !== undefined) continue;
    const aliases = semanticAliases[field]
      .map(normalize)
      .filter((alias) => alias.length >= 3);
    const index = headers.findIndex((header, candidateIndex) =>
      !usedColumns.has(candidateIndex) && aliases.some((alias) => headerMatches(header, alias)),
    );
    if (index >= 0) {
      mapping[field] = index;
      usedColumns.add(index);
    }
  }
  return mapping;
};

const headerScore = (headers: readonly string[]): number => {
  const mapping = mapHeaders(headers);
  let score = 0;
  if (mapping.name !== undefined) score += 3;
  if (mapping.weekday !== undefined || mapping.time !== undefined) score += 2;
  if (
    mapping.periods !== undefined ||
    mapping.startPeriod !== undefined ||
    mapping.time !== undefined
  ) score += 2;
  if (mapping.weeks !== undefined) score += 2;
  if (mapping.teacher !== undefined) score += 1;
  if (mapping.location !== undefined || mapping.buildingName !== undefined) score += 1;
  return score;
};

interface SelectedMatrix {
  headers: string[];
  rows: string[][];
}

const selectScheduleMatrix = (rows: readonly string[][]): SelectedMatrix | null => {
  if (rows.length === 0) return null;
  let best: { score: number; index: number; headers: string[] } | null = null;
  // A two-line title or grouped header can precede the real header.  Evaluate
  // each row and choose the strongest semantic match.
  for (const [index, row] of rows.entries()) {
    const score = headerScore(row);
    if (!best || score > best.score) best = { score, index, headers: [...row] };
  }
  if (!best || best.score < 5) return null;
  const dataRows = rows.slice(best.index + 1).filter((row) => row.length > 0);
  return { headers: best.headers, rows: dataRows };
};

const cellAt = (row: readonly string[], index: number | undefined): string =>
  index === undefined ? '' : text(row[index] ?? '');

const firstWeekdayIn = (value: string): number | null => {
  const direct = parseWeekday(value);
  if (direct !== null) return direct;
  const match = value.match(/(?:星期|周)\s*([一二三四五六日天1-7])/i);
  if (match) return parseWeekday(match[1]);
  const english = value.match(/\b(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i);
  return english ? parseWeekday(english[1]) : null;
};

const firstPeriodsIn = (value: string): string => {
  const normalized = value.normalize('NFKC');
  if (looksLikeClockTime(normalized)) return '';

  // CSU's grid export writes a run of two-digit section numbers (`0708节`,
  // occasionally `01020304`) without separators. Decode every pair and use
  // the first/last section instead of silently truncating after two digits.
  const compact = normalized.match(/(?<!\d)((?:\d{2}){2,})(?!\d)/);
  if (compact) {
    const parts = compact[1].match(/\d{2}/g) ?? [];
    if (parts.length >= 2) {
      return `${Number(parts[0])}-${Number(parts[parts.length - 1])}`;
    }
  }

  const explicit = normalized.match(/(?:第\s*)?(\d{1,2})\s*(?:[-~～—–至到]\s*(\d{1,2}))?\s*(?:节|节次|课)?/);
  if (explicit) return explicit[2] ? `${explicit[1]}-${explicit[2]}` : explicit[1];
  const numbers = normalized.match(/\d+/g);
  if (!numbers?.length) return '';
  return numbers.length > 1 ? `${numbers[0]}-${numbers[1]}` : numbers[0];
};

/** Decode CSU's compact section notation such as `0708节` or `0304`. */
const periodPartsIn = (value: string): string[] => {
  const normalized = value.normalize('NFKC');
  if (looksLikeClockTime(normalized)) return [];
  const explicit = normalized.match(/(?:第\s*)?(\d{1,2})\s*[-~～—–至到、，,]\s*(\d{1,2})/);
  if (explicit) return [explicit[1], explicit[2]];
  const compact = normalized.match(/(?<!\d)((?:\d{2}){2,})(?!\d)/);
  if (compact) {
    const parts = compact[1].match(/\d{2}/g) ?? [];
    if (parts.length >= 2) {
      return [String(Number(parts[0])), String(Number(parts[parts.length - 1]))];
    }
  }
  const numbers = normalized.match(/\d{1,2}/g) ?? [];
  return numbers;
};

const jsonText = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) return value.map(jsonText).filter(Boolean).join(',');
  return '';
};

const jsonTitleText = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(jsonText).filter(Boolean).join('\n');
  return jsonText(value);
};

/**
 * CSU responses have appeared both as a top-level array and wrapped in one or
 * more `{data: [...]}`/`{result: {rows: [...]}}` containers. Walk only the
 * known container keys and a small, fixed depth; arbitrary nested values are
 * never treated as course records.
 */
const findJsonCourseItems = (value: unknown): unknown[] | null => {
  const containerKeys = ['courses', 'data', 'rows', 'list', 'items', 'records', 'result'] as const;
  const queue: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  const visited = new Set<object>();
  let emptyArray: unknown[] | null = null;
  while (queue.length > 0) {
    const entry = queue.shift()!;
    if (Array.isArray(entry.value)) {
      if (entry.value.length > 0) return entry.value;
      emptyArray ??= entry.value;
      continue;
    }
    if (!entry.value || typeof entry.value !== 'object' || entry.depth >= 4) continue;
    const record = entry.value as Record<string, unknown>;
    if (visited.has(record)) continue;
    visited.add(record);
    for (const key of containerKeys) {
      if (key in record) queue.push({ value: record[key], depth: entry.depth + 1 });
    }
  }
  return emptyArray;
};

const JSON_FREE_TIME = /(?:自由时间|自由活动|自由课时|自习时间)/;

const valueFor = (row: readonly string[], mapping: HeaderMapping, field: keyof HeaderMapping): string =>
  cellAt(row, mapping[field]);

/**
 * Convert a recognised CA matrix to the canonical CSV shape understood by
 * `parseScheduleCsv`.  Keeping this conversion explicit makes the adapter
 * easy to audit and avoids duplicating course validation rules.
 */
const matrixToCanonicalCsv = (
  selected: SelectedMatrix,
): { csv: string; dataRows: number; skippedRows: number } => {
  const mapping = mapHeaders(selected.headers);
  const output: string[][] = [[
    '课程名称', '星期', '开始节数', '结束节数', '老师', '地点', '周数', '单双周',
    '楼座ID', '楼座', '标签', '备注',
  ]];
  let skippedRows = 0;
  for (const row of selected.rows) {
    if (rowLooksSensitive(row) || rowLooksMarkdownSeparator(row) || row.every((cell) => !text(cell))) {
      skippedRows += 1;
      continue;
    }
    const name = valueFor(row, mapping, 'name');
    const time = valueFor(row, mapping, 'time');
    const weekdayRaw = valueFor(row, mapping, 'weekday') || time;
    const startRaw = valueFor(row, mapping, 'startPeriod');
    const endRaw = valueFor(row, mapping, 'endPeriod');
    // Prefer explicit start/end columns when present. A separate “上课时间”
    // column may contain a clock range and must not override valid section
    // columns.
    const periodRaw = valueFor(row, mapping, 'periods') || [startRaw, endRaw].filter(Boolean).join('-') || time;
    const weekday = firstWeekdayIn(weekdayRaw);
    const periods = firstPeriodsIn(periodRaw);
    const periodParts = periods.match(/\d+/g) ?? [];
    const start = periodParts[0] ?? '';
    const end = periodParts[1] ?? start;
    const location = valueFor(row, mapping, 'location') || valueFor(row, mapping, 'buildingName');
    const weeks = valueFor(row, mapping, 'weeks');
    const parity = valueFor(row, mapping, 'parity');
    const buildingId = valueFor(row, mapping, 'buildingId');
    const buildingName = valueFor(row, mapping, 'buildingName');
    const teacher = valueFor(row, mapping, 'teacher');
    const tags = valueFor(row, mapping, 'tags');
    const notes = valueFor(row, mapping, 'notes');
    // Rows that are obvious page decorations are ignored.  Rows with a course
    // name but malformed schedule data remain in the canonical CSV so the
    // shared parser can return a precise row-level error to the user.
    if (!name && !weekday && !start && !weeks) {
      skippedRows += 1;
      continue;
    }
    output.push([
      name,
      weekday === null ? weekdayRaw : String(weekday),
      start,
      end,
      teacher,
      location,
      weeks,
      parity,
      buildingId,
      buildingName,
      tags,
      notes,
    ]);
  }
  const csvEscape = (value: string) => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  return {
    csv: output.map((row) => row.map(csvEscape).join(',')).join('\r\n'),
    dataRows: Math.max(0, output.length - 1),
    skippedRows,
  };
};

const labelledValue = (line: string, labels: readonly string[]): string => {
  const normalizedLine = line.normalize('NFKC');
  for (const label of labels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^\\s*${escapedLabel}\\s*[:：]\\s*(.+)$`, 'i');
    const match = normalizedLine.match(pattern);
    if (match) return match[1].trim();
  }
  return '';
};

/** Parse a copied key/value block when the CA page does not expose a table. */
const parseLabelledBlocks = (rows: readonly string[][]): string[][] | null => {
  if (rows.length === 0 || rows.some((row) => row.length !== 1)) return null;
  const records: Record<string, string>[] = [];
  let current: Record<string, string> = {};
  const labels: Record<string, readonly string[]> = {
    name: semanticAliases.name,
    teacher: semanticAliases.teacher,
    weekday: semanticAliases.weekday,
    periods: [...semanticAliases.periods, ...semanticAliases.time],
    weeks: semanticAliases.weeks,
    location: semanticAliases.location,
    parity: semanticAliases.parity,
  };
  const keyForLine = (line: string): string | null => {
    for (const [key, aliases] of Object.entries(labels)) {
      if (labelledValue(line, aliases)) return key;
    }
    return null;
  };
  for (const row of rows) {
    const line = row[0];
    const key = keyForLine(line);
    if (!key) continue;
    const value = labelledValue(line, labels[key]);
    if (key === 'name' && current.name) {
      records.push(current);
      current = {};
    }
    current[key] = value;
  }
  // A copied block often ends with an unrecognised decoration/备注 line. Do
  // not lose the course accumulated before that line; flush once after the
  // scan rather than only when the final physical line is a known label.
  if (Object.keys(current).length > 0) records.push(current);
  if (records.length === 0 || !records.some((record) => record.name)) return null;
  const matrix: string[][] = [
    ['课程名称', '星期', '开始节数', '结束节数', '老师', '地点', '周数', '单双周'],
  ];
  records.forEach((record) => {
    const periodText = (record.periods ?? '').normalize('NFKC');
    const periods = periodPartsIn(periodText);
    matrix.push([
      record.name ?? '',
      record.weekday ?? record.periods ?? '',
      periods[0] ?? '',
      periods[1] ?? periods[0] ?? '',
      record.teacher ?? '',
      record.location ?? '',
      record.weeks ?? '',
      record.parity ?? '',
    ]);
  });
  return matrix;
};

const makeNoTablePreview = (
  source: CaScheduleSourceKind,
  skippedRows: number,
  detectedTableCount = 0,
  detectedRows = 0,
  sourceLabel?: string,
): CaScheduleImportPreview => {
  const issue: ImportIssue = {
    severity: 'error',
    row: 1,
    code: 'ca-no-schedule-table',
    message: '未找到可识别的课表表格。请先在教务系统打开“我的课表”，再复制课表内容。',
  };
  return {
    status: 'invalid',
    courses: [],
    errors: [issue],
    warnings: [],
    issues: [issue],
    headers: [],
    totalRows: 0,
    acceptedRows: 0,
    source,
    detectedTableCount,
    detectedRows,
    skippedRows,
    sourceLabel,
  };
};

const parseMatrix = (matrix: CellMatrix, options: CaScheduleImportOptions): CaScheduleImportPreview => {
  let selected = selectScheduleMatrix(matrix.rows);
  if (!selected) {
    const labelled = parseLabelledBlocks(matrix.rows);
    if (labelled) selected = selectScheduleMatrix(labelled);
  }
  if (!selected) {
    return makeNoTablePreview(
      matrix.source,
      matrix.skippedRows,
      matrix.tableCount,
      matrix.rows.length + matrix.skippedRows,
      options.sourceLabel,
    );
  }

  // If the source is already a normal CSV, preserve its columns and let the
  // shared parser handle quoted cells and all supported aliases.  Otherwise
  // normalise CA-specific labels and combined time cells first.
  const sourceLooksCsv = matrix.source === 'csv';
  const canonical = sourceLooksCsv
    ? {
        csv: matrix.rows.map((row) => row.map((value) => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value).join(',')).join('\r\n'),
        dataRows: Math.max(0, matrix.rows.length - 1),
        skippedRows: matrix.skippedRows,
      }
    : matrixToCanonicalCsv(selected);

  const parsed = parseScheduleCsv(canonical.csv, options);
  const effectiveSource: CaScheduleSourceKind = matrix.source === 'text' && sourceLooksCsv ? 'csv' : matrix.source;
  return {
    ...parsed,
    source: effectiveSource,
    detectedTableCount: matrix.tableCount,
    detectedRows: canonical.dataRows,
    skippedRows: matrix.skippedRows + canonical.skippedRows,
    sourceLabel: options.sourceLabel,
  };
};

/**
 * Convert the JSON payload used by several CSU timetable exporters to the
 * same canonical row model.  The exporter commonly puts course fields into a
 * newline-delimited `title` string, for example `课程名称：…\n周次：…\n节次：…`.
 * This parser is intentionally shape-limited and only consumes course fields;
 * it never accepts credentials or arbitrary object values.
 */
export const parseCsuScheduleJson = (input: string, options: CaScheduleImportOptions = {}): CaScheduleImportPreview | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return null;
  }
  const items = findJsonCourseItems(parsed);
  if (!items) return null;

  const rows: string[][] = [['课程名称', '星期', '开始节数', '结束节数', '老师', '地点', '周数', '单双周']];
  let skippedRows = 0;
  const jsonIssues: ImportIssue[] = [];
  for (const [itemIndex, item] of items.entries()) {
    const rowNumber = itemIndex + 1;
    if (!item || typeof item !== 'object') {
      skippedRows += 1;
      jsonIssues.push({
        severity: 'warning',
        row: rowNumber,
        code: 'json-non-course-record',
        message: '已跳过不是对象的 JSON 记录。',
      });
      continue;
    }
    const raw = item as Record<string, unknown>;
    const title = jsonTitleText(raw.title);
    const lines = decodeHtml(title)
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .split(/\r?\n|;(?=\s*(?:课程名称|课程名|周次|星期|上课星期|节次|上课节次|上课教师|教师|上课地点|地点)\s*[:：])/)
      .map((line) => line.trim())
      .filter(Boolean);
    const value = (...labels: string[]) => {
      for (const line of lines) {
        const parsedValue = labelledValue(line, labels);
        if (parsedValue) return parsedValue;
      }
      return '';
    };
    const rawXq = typeof raw.xq === 'number' || typeof raw.xq === 'string' ? Number(raw.xq) : NaN;
    // `xq=0` is emitted by the old endpoint for placeholders/free-time rows;
    // it must never become a course with a fabricated weekday.
    if (rawXq === 0) {
      skippedRows += 1;
      jsonIssues.push({
        severity: 'warning',
        row: rowNumber,
        code: 'json-skipped-placeholder',
        message: '已跳过 CSU JSON 中 xq=0 的占位记录。',
      });
      continue;
    }
    // `kcmc` is present on some CSU payloads for both real courses and
    // trailing practice/notice records. Only treat it as a course name when
    // the record also carries a structured schedule or an explicit course ID;
    // otherwise the notice would become a phantom course with default weeks.
    const explicitName = value('课程名称', '课程名') || jsonText(raw.name);
    const rawCourseId = raw.id ?? raw.kcid ?? raw.courseId;
    const hasStructuredSchedule = Boolean(
      value('星期', '上课星期', '节次', '上课节次', '周次', '教学周') ||
      raw.weekday || raw.periods || raw.weeks,
    );
    const name = explicitName || (
      jsonText(raw.kcmc) && (hasStructuredSchedule || rawCourseId !== undefined)
        ? jsonText(raw.kcmc)
        : ''
    );
    const teacher = jsonText(raw.teacher) || value('上课教师', '教师', '老师');
    const location = jsonText(raw.location) || value('上课地点', '地点', '教室');
    const weeks = jsonText(raw.weeks) || value('周次', '教学周');
    const parity = jsonText(raw.weekParity) || value('单双周');
    const recordText = [title, name, jsonText(raw.kcmc)].filter(Boolean).join('\n');
    if (JSON_FREE_TIME.test(recordText)) {
      skippedRows += 1;
      jsonIssues.push({
        severity: 'warning',
        row: rowNumber,
        code: 'json-skipped-free-time',
        message: '已跳过 CSU JSON 中的“自由时间”记录。',
      });
      continue;
    }
    const labelledWeekday = value('星期', '上课星期');
    // CSU's `xq` follows the Java/JavaScript weekday convention used by its
    // legacy exporter: 1=周日, 2=周一, …, 7=周六. Convert it to this app's
    // Monday-first weekday numbering. `xq=0` is a placeholder/non-course
    // record and out-of-range values are left blank so the shared validator
    // can report a row-level weekday error rather than inventing a day.
    const mappedXq = Number.isInteger(rawXq) && rawXq >= 1 && rawXq <= 7
      ? String(((rawXq + 5) % 7) + 1)
      : '';
    const dayRaw = labelledWeekday || jsonText(raw.weekday) || mappedXq;
    // `jc` in the CSU payload is often only the first period; the title's
    // labelled range (for example `03-04`) contains the complete span.
    const labelledPeriods = value('节次', '上课节次');
    const titlePeriodParts = periodPartsIn(labelledPeriods);
    const rawPeriodParts = periodPartsIn(jsonText(raw.periods) || jsonText(raw.jc));
    // A complete range in `title` is authoritative (some exports retain a
    // stale `jc` start value). If title has only an end section, combine it
    // with the single `jc` start; otherwise use `jc` as a one-period fallback.
    const periodParts = titlePeriodParts.length >= 2
      ? [titlePeriodParts[0], titlePeriodParts[titlePeriodParts.length - 1]]
      : titlePeriodParts.length === 1 && rawPeriodParts.length >= 1
        ? [rawPeriodParts[0], titlePeriodParts[0]]
        : rawPeriodParts.length >= 2
          ? [rawPeriodParts[0], rawPeriodParts[rawPeriodParts.length - 1]]
          : rawPeriodParts;
    const weekday = String(dayRaw ?? '');
    if (!name) {
      skippedRows += 1;
      jsonIssues.push({
        severity: 'warning',
        row: rowNumber,
        code: 'json-missing-course-name',
        message: '已跳过没有课程名称的 JSON 记录。',
      });
      continue;
    }
    rows.push([name, weekday, periodParts[0] ?? '', periodParts[1] ?? periodParts[0] ?? '', teacher, location, weeks, parity]);
  }
  if (rows.length === 1) {
    const error: ImportIssue = {
      severity: 'error',
      row: 1,
      code: 'json-no-courses',
      message: 'JSON 中没有可识别的有效课程记录；请确认复制的是已登录课表数据。',
    };
    return {
      status: 'invalid',
      courses: [],
      errors: [error],
      warnings: jsonIssues,
      issues: [...jsonIssues, error],
      headers: rows[0],
      totalRows: items.length,
      acceptedRows: 0,
      source: 'json',
      detectedTableCount: 0,
      detectedRows: items.length,
      skippedRows,
      sourceLabel: options.sourceLabel,
    };
  }
  const parsedPreview = parseMatrix({ rows, source: 'json', tableCount: 0, skippedRows }, options);
  const issues = [...jsonIssues, ...parsedPreview.issues];
  return {
    ...parsedPreview,
    errors: issues.filter((issue) => issue.severity === 'error'),
    warnings: issues.filter((issue) => issue.severity === 'warning'),
    issues,
    source: 'json',
    sourceLabel: options.sourceLabel,
  };
};

/** Parse a rendered `Document`/`Element` from the official CA page. */
export function parseCsuScheduleDom(
  source: CaScheduleDomSource,
  options: CaScheduleImportOptions = {},
): CaScheduleImportPreview {
  return parseMatrix(extractDomTables(source), options);
}

/** Parse an HTML snapshot copied or fetched by the caller (no fetch is done here). */
export function parseCsuScheduleHtml(
  html: string,
  options: CaScheduleImportOptions = {},
): CaScheduleImportPreview {
  if (!/<table\b/i.test(html)) return parseCsuScheduleText(stripMarkup(html), options);
  return parseMatrix(extractHtmlTables(html), options);
}

/** Parse TSV, markdown-table, CSV, or labelled text copied from the CA page. */
export function parseCsuScheduleText(
  input: string,
  options: CaScheduleImportOptions = {},
): CaScheduleImportPreview {
  const trimmed = input.trimStart();
  if (/^[\[{]/.test(trimmed)) {
    const jsonPreview = parseCsuScheduleJson(trimmed, options);
    if (jsonPreview) return jsonPreview;
  }
  if (/<table\b/i.test(trimmed)) return parseCsuScheduleHtml(input, options);
  // A comma-delimited WakeUp export can be delegated without losing quoted
  // fields.  Header detection prevents arbitrary prose containing commas from
  // being interpreted as a schedule.
  const firstLine = trimmed.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
  const commaCandidate = firstLine.includes(',') && headerScore(firstLine.split(',').map((cell) => cell.trim())) >= 5;
  if (commaCandidate) {
    const parsed = parseScheduleCsv(input, options);
    return {
      ...parsed,
      source: 'csv',
      detectedTableCount: 0,
      detectedRows: parsed.totalRows,
      skippedRows: 0,
      sourceLabel: options.sourceLabel,
    };
  }
  return parseMatrix(extractTextRows(input), options);
}

/** Automatically choose DOM, HTML, TSV, or text parsing. */
export function parseCsuSchedule(
  source: CaScheduleInput,
  options: CaScheduleImportOptions = {},
): CaScheduleImportPreview {
  if (typeof source === 'string') return parseCsuScheduleText(source, options);
  return parseCsuScheduleDom(source, options);
}

// Friendly aliases for callers that use the shorter “CA” spelling.
export const parseCaSchedule = parseCsuSchedule;
export const parseCaScheduleDom = parseCsuScheduleDom;
export const parseCaScheduleHtml = parseCsuScheduleHtml;
export const parseCaScheduleText = parseCsuScheduleText;
export const parseCaScheduleJson = parseCsuScheduleJson;

/**
 * Build a browser-safe import URL.  The caller may use this URL with
 * `window.open`; no credentials or query parameters are ever appended.
 */
export const CSU_CA_SCHEDULE_URL = 'https://ca.csu.edu.cn/';

/**
 * Small helper for UI code: open the official CA page in a new tab when the
 * browser allows it.  It intentionally does not automate login or scrape a
 * cross-origin page; the user copies/chooses the rendered schedule and then
 * passes it to `parseCsuSchedule`.
 */
export function openCsuSchedulePage(open: (url: string, target?: string, features?: string) => unknown =
  (url, target, features) => typeof window === 'undefined' ? null : window.open(url, target, features)):
  boolean {
  try {
    return Boolean(open(CSU_CA_SCHEDULE_URL, '_blank', 'noopener,noreferrer'));
  } catch {
    return false;
  }
}

// Re-exporting these types keeps UI imports focused on this adapter when it is
// used as the “从教务系统导入” entry point.
export type { BuildingReference, ImportIssue, ImportPreview, StorageLike };

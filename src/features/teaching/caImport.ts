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
const SENSITIVE_LABEL = /(?:密码|password|登录密码|验证码|captcha|用户名|username|登录名|账号登录)/i;

const rowLooksSensitive = (row: readonly string[]): boolean =>
  row.some((cell) => SENSITIVE_LABEL.test(cell));

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
        return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : whole;
      }
      if (key.startsWith('#')) {
        const parsed = Number.parseInt(key.slice(1), 10);
        return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : whole;
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
    const rows = rawRows.filter((row) => !rowLooksSensitive(row));
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
  const explicit = normalized.match(/(?:第\s*)?(\d{1,2})\s*(?:[-~～—–至到]\s*(\d{1,2}))?\s*(?:节|节次|课)?/);
  if (explicit) return explicit[2] ? `${explicit[1]}-${explicit[2]}` : explicit[1];
  const numbers = normalized.match(/\d+/g);
  if (!numbers?.length) return '';
  return numbers.length > 1 ? `${numbers[0]}-${numbers[1]}` : numbers[0];
};

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
  const output: string[][] = [['课程名称', '星期', '开始节数', '结束节数', '老师', '地点', '周数', '单双周', '标签', '备注']];
  let skippedRows = 0;
  for (const row of selected.rows) {
    if (rowLooksSensitive(row) || row.every((cell) => !text(cell))) {
      skippedRows += 1;
      continue;
    }
    const name = valueFor(row, mapping, 'name');
    const time = valueFor(row, mapping, 'time');
    const weekdayRaw = valueFor(row, mapping, 'weekday') || time;
    const startRaw = valueFor(row, mapping, 'startPeriod');
    const endRaw = valueFor(row, mapping, 'endPeriod');
    const periodRaw = valueFor(row, mapping, 'periods') || time || [startRaw, endRaw].filter(Boolean).join('-');
    const weekday = firstWeekdayIn(weekdayRaw);
    const periods = firstPeriodsIn(periodRaw);
    const periodParts = periods.match(/\d+/g) ?? [];
    const start = periodParts[0] ?? '';
    const end = periodParts[1] ?? start;
    const location = valueFor(row, mapping, 'location') || valueFor(row, mapping, 'buildingName');
    const weeks = valueFor(row, mapping, 'weeks');
    const parity = valueFor(row, mapping, 'parity');
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
    output.push([name, weekday === null ? weekdayRaw : String(weekday), start, end, teacher, location, weeks, parity, tags, notes]);
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
    const pattern = new RegExp(`^\\s*${label}\\s*[:：]\\s*(.+)$`, 'i');
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
  for (const [index, row] of rows.entries()) {
    const line = row[0];
    const key = keyForLine(line);
    if (!key) continue;
    const value = labelledValue(line, labels[key]);
    if (key === 'name' && current.name) {
      records.push(current);
      current = {};
    }
    current[key] = value;
    if (index === rows.length - 1 && Object.keys(current).length > 0) records.push(current);
  }
  if (records.length === 0 || !records.some((record) => record.name)) return null;
  const matrix: string[][] = [
    ['课程名称', '星期', '开始节数', '结束节数', '老师', '地点', '周数', '单双周'],
  ];
  records.forEach((record) => {
    const periodText = (record.periods ?? '').normalize('NFKC');
    const periodRange = periodText.match(/(\d{1,2})\s*[^\d\s]+\s*(\d{1,2})/);
    const periods = periodRange ? [periodRange[1], periodRange[2]] : (periodText.match(/\d{1,2}/g) ?? []);
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
    detectedTableCount: 0,
    detectedRows: 0,
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
  if (!selected) return makeNoTablePreview(matrix.source, matrix.skippedRows, options.sourceLabel);

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
const parseCsuJson = (input: string, options: CaScheduleImportOptions): CaScheduleImportPreview | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return null;
  }
  const items = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { courses?: unknown[] }).courses)
      ? (parsed as { courses: unknown[] }).courses
      : null;
  if (!items) return null;

  const rows: string[][] = [['课程名称', '星期', '开始节数', '结束节数', '老师', '地点', '周数', '单双周']];
  let skippedRows = 0;
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      skippedRows += 1;
      continue;
    }
    const raw = item as Record<string, unknown>;
    const title = typeof raw.title === 'string' ? raw.title : '';
    const lines = title.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const value = (...labels: string[]) => {
      for (const label of labels) {
        const line = lines.find((candidate) => candidate.startsWith(`${label}：`) || candidate.startsWith(`${label}:`));
        if (line) return line.replace(new RegExp(`^${label}\s*[:：]\s*`), '').trim();
      }
      return '';
    };
    const name = typeof raw.name === 'string' ? raw.name.trim() : value('课程名称', '课程名');
    const teacher = typeof raw.teacher === 'string' ? raw.teacher.trim() : value('上课教师', '教师', '老师');
    const location = typeof raw.location === 'string' ? raw.location.trim() : value('上课地点', '地点', '教室');
    const weeks = typeof raw.weeks === 'string' ? raw.weeks.trim() : value('周次', '教学周');
    const parity = typeof raw.weekParity === 'string' ? raw.weekParity.trim() : value('单双周');
    const dayRaw = raw.weekday ?? raw.xq ?? value('星期', '上课星期');
    // `jc` in the CSU payload is often only the first period; the title's
    // labelled range (for example `03-04`) contains the complete span.
    const labelledPeriods = value('节次', '上课节次');
    const periodRaw = raw.periods ?? (labelledPeriods || raw.jc || '');
    const weekday = typeof dayRaw === 'number' ? String(dayRaw) : String(dayRaw ?? '');
    const periodText = String(periodRaw ?? '');
    const periodParts = periodText.match(/\d+/g) ?? [];
    if (!name && !title) {
      skippedRows += 1;
      continue;
    }
    rows.push([name, weekday, periodParts[0] ?? '', periodParts[1] ?? periodParts[0] ?? '', teacher, location, weeks, parity]);
  }
  if (rows.length === 1) return null;
  const parsedPreview = parseMatrix({ rows, source: 'json', tableCount: 0, skippedRows }, options);
  return { ...parsedPreview, source: 'json', skippedRows: parsedPreview.skippedRows + skippedRows, sourceLabel: options.sourceLabel };
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
    const jsonPreview = parseCsuJson(trimmed, options);
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

import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import {
  DEFAULT_MAX_PERIOD,
  DEFAULT_MAX_WEEK,
  WEEKDAY_LABELS,
  compareCourses,
  courseOccursInWeek,
  coursesConflict,
  createCourse,
  exportScheduleCsv,
  formatWeekExpression,
  loadCourses,
  saveCourses,
  type Course,
  type CourseDraft,
  type ImportPreview,
  type Weekday,
  type WeekParity,
} from './model';
import {
  getSharingEnabled,
  loadCommunityCourses,
  setSharingEnabled,
  syncCommunityCourses,
  withdrawCommunityCourses,
  type CommunityCourse,
  type CommunitySnapshot,
} from './community';
import { CSU_CA_SCHEDULE_URL, openCsuSchedulePage, parseCsuScheduleText } from './caImport';

type TeachingTab = 'schedule' | 'discover' | 'manage';
type SaveState = { kind: 'saved' | 'saving' | 'error'; message: string };
type CommunityState = 'loading' | 'ready' | 'offline' | 'disabled';

type CourseFormState = {
  name: string;
  teacher: string;
  weekday: Weekday;
  startPeriod: number;
  endPeriod: number;
  weekExpression: string;
  weekParity: WeekParity;
  buildingName: string;
  location: string;
  tags: string;
  notes: string;
};

const TERM_ID = 'current-term';
const SELECTED_WEEK_KEY = 'csu-campus-selected-week';
const INTERESTS_KEY = 'csu-campus-schedule-interests';
const range = (count: number) => Array.from({ length: count }, (_, index) => index + 1);
const weekdays = range(7) as Weekday[];
const periods = range(DEFAULT_MAX_PERIOD);

const emptyCourseForm = (): CourseFormState => ({
  name: '',
  teacher: '',
  weekday: 1,
  startPeriod: 1,
  endPeriod: 2,
  weekExpression: `1-${DEFAULT_MAX_WEEK}`,
  weekParity: 'all',
  buildingName: '',
  location: '',
  tags: '',
  notes: '',
});

const formFromCourse = (course: Course): CourseFormState => ({
  name: course.name,
  teacher: course.teacher,
  weekday: course.weekday,
  startPeriod: course.startPeriod,
  endPeriod: course.endPeriod,
  weekExpression: course.weekExpression || formatWeekExpression(course.weeks),
  weekParity: course.weekParity,
  buildingName: course.buildingName,
  location: course.location,
  tags: course.tags.join('、'),
  notes: course.notes,
});

const courseLocationLabel = (course: Pick<Course, 'buildingName' | 'location'>) =>
  [course.buildingName, course.location].filter(Boolean).join(' · ') || '地点未填写';

const locationFilterKey = (course: Pick<Course, 'buildingId' | 'buildingName' | 'location'>) => {
  if (course.buildingId) return `id:${course.buildingId}`;
  if (course.buildingName) return `name:${course.buildingName}`;
  if (course.location) return `raw:${course.location}`;
  return 'unlinked';
};

const courseFingerprint = (course: Course) => [
  course.name.trim().toLocaleLowerCase('zh-CN'),
  course.teacher.trim().toLocaleLowerCase('zh-CN'),
  course.weekday,
  course.startPeriod,
  course.endPeriod,
  course.weeks.join('.'),
  course.location.trim().toLocaleLowerCase('zh-CN'),
].join('|');

const stableTone = (text: string) => {
  let sum = 0;
  for (let index = 0; index < text.length; index += 1) sum = (sum + text.charCodeAt(index) * 13) % 997;
  return (sum % 6) + 1;
};

const formatSavedTime = (iso?: string) => {
  if (!iso) return '已保存到此浏览器';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '已保存到此浏览器';
  return `已保存 · ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
};

const formatCommunityTime = (iso?: string) => {
  if (!iso || iso === new Date(0).toISOString()) return '尚无汇总记录';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '更新时间未知';
  return `${date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 更新`;
};

const dialogFocusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function useDialogFocus(dialogRef: RefObject<HTMLElement | null>, onEscape: () => void) {
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const focusableElements = () => Array.from(dialog.querySelectorAll<HTMLElement>(dialogFocusableSelector))
      .filter((element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');

    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      const preferred = dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]');
      (preferred ?? focusableElements()[0] ?? dialog).focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = focusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const active = document.activeElement;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [dialogRef]);
}

const triggerDownload = (content: string, filename: string, type = 'text/csv;charset=utf-8') => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

function WeekPicker({ week, onChange }: { week: number; onChange: (week: number) => void }) {
  return (
    <div className="week-picker" aria-label="教学周选择">
      <button type="button" aria-label="上一周" disabled={week <= 1} onClick={() => onChange(week - 1)}>‹</button>
      <label>
        <span>教学周</span>
        <select aria-label="当前教学周" value={week} onChange={(event) => onChange(Number(event.target.value))}>
          {range(DEFAULT_MAX_WEEK).map((value) => <option key={value} value={value}>第 {value} 周</option>)}
        </select>
      </label>
      <span className={`parity-badge ${week % 2 === 1 ? 'odd' : 'even'}`}>{week % 2 === 1 ? '单周' : '双周'}</span>
      <button type="button" aria-label="下一周" disabled={week >= DEFAULT_MAX_WEEK} onClick={() => onChange(week + 1)}>›</button>
    </div>
  );
}

function EmptyState({
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  description: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="teaching-empty">
      <div className="empty-sign" aria-hidden="true"><span /> <span /> <span /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      {(primaryLabel || secondaryLabel) && (
        <div className="empty-actions">
          {primaryLabel && <button className="primary-button" type="button" onClick={onPrimary}>{primaryLabel}</button>}
          {secondaryLabel && <button className="secondary-button" type="button" onClick={onSecondary}>{secondaryLabel}</button>}
        </div>
      )}
    </div>
  );
}

function ScheduleGrid({
  courses,
  week,
  onEdit,
}: {
  courses: Course[];
  week: number;
  onEdit: (course: Course) => void;
}) {
  return (
    <div className="schedule-scroll" aria-label={`第 ${week} 周课表`}>
      <div className="schedule-grid">
        <div className="schedule-corner"><span>W{String(week).padStart(2, '0')}</span></div>
        {weekdays.map((day) => (
          <div className="schedule-day" style={{ gridColumn: day + 1, gridRow: 1 }} key={day}>
            <strong>{WEEKDAY_LABELS[day]}</strong>
            <span>{day <= 5 ? '教学日' : '周末'}</span>
          </div>
        ))}
        {periods.map((period) => (
          <div className="schedule-period" style={{ gridColumn: 1, gridRow: period + 1 }} key={period}>
            <strong>{String(period).padStart(2, '0')}</strong>
            <span>节</span>
          </div>
        ))}
        {periods.flatMap((period) => weekdays.map((day) => (
          <span
            aria-hidden="true"
            className={`schedule-cell ${day > 5 ? 'weekend-cell' : ''}`}
            key={`${day}-${period}`}
            style={{ gridColumn: day + 1, gridRow: period + 1 }}
          />
        )))}
        {courses.map((course) => (
          <button
            className={`course-block course-tone-${stableTone(course.name)}`}
            key={course.id}
            type="button"
            onClick={() => onEdit(course)}
            style={{
              gridColumn: course.weekday + 1,
              gridRow: `${course.startPeriod + 1} / ${course.endPeriod + 2}`,
            }}
            aria-label={`${course.name}，${WEEKDAY_LABELS[course.weekday]}第${course.startPeriod}至${course.endPeriod}节`}
          >
            <strong>{course.name}</strong>
            <span>{course.startPeriod}–{course.endPeriod}节</span>
            <small>{courseLocationLabel(course)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function CourseFormModal({
  editing,
  onClose,
  onSubmit,
}: {
  editing: Course | null;
  onClose: () => void;
  onSubmit: (course: Course) => void;
}) {
  const initialForm = useMemo(() => editing ? formFromCourse(editing) : emptyCourseForm(), [editing]);
  const [form, setForm] = useState<CourseFormState>(initialForm);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLElement>(null);

  const requestClose = () => {
    const changed = JSON.stringify(form) !== JSON.stringify(initialForm);
    if (changed && !window.confirm('还有未保存的课程信息，确定放弃吗？')) return;
    onClose();
  };

  useDialogFocus(dialogRef, requestClose);

  const update = <Key extends keyof CourseFormState>(key: Key, value: CourseFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      const draft: CourseDraft = {
        id: editing?.id,
        name: form.name,
        teacher: form.teacher,
        weekday: form.weekday,
        startPeriod: form.startPeriod,
        endPeriod: form.endPeriod,
        weekExpression: form.weekExpression,
        weekParity: form.weekParity,
        buildingId: null,
        buildingName: form.buildingName,
        location: form.location,
        tags: form.tags,
        notes: form.notes,
        source: editing?.source ?? 'manual',
        createdAt: editing?.createdAt,
      };
      onSubmit(createCourse(draft));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '请检查课程信息。');
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
      <section ref={dialogRef} className="course-modal" role="dialog" aria-modal="true" aria-labelledby="course-modal-title" tabIndex={-1}>
        <header>
          <div>
            <span className="modal-kicker">{editing ? '编辑课程' : '课程录入'}</span>
            <h2 id="course-modal-title">{editing ? editing.name : '添加一门课'}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={requestClose}>×</button>
        </header>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="span-2">
              <span>课程名称 <b>*</b></span>
              <input autoFocus data-dialog-initial-focus required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="例如：数字媒体艺术" />
            </label>
            <label>
              <span>任课教师</span>
              <input value={form.teacher} onChange={(event) => update('teacher', event.target.value)} placeholder="可留空" />
            </label>
            <label>
              <span>星期 <b>*</b></span>
              <select value={form.weekday} onChange={(event) => update('weekday', Number(event.target.value) as Weekday)}>
                {weekdays.map((day) => <option key={day} value={day}>{WEEKDAY_LABELS[day]}</option>)}
              </select>
            </label>
            <label>
              <span>开始节次 <b>*</b></span>
              <select value={form.startPeriod} onChange={(event) => update('startPeriod', Number(event.target.value))}>
                {periods.map((period) => <option key={period} value={period}>第 {period} 节</option>)}
              </select>
            </label>
            <label>
              <span>结束节次 <b>*</b></span>
              <select value={form.endPeriod} onChange={(event) => update('endPeriod', Number(event.target.value))}>
                {periods.map((period) => <option key={period} value={period}>第 {period} 节</option>)}
              </select>
            </label>
            <label>
              <span>周次 <b>*</b></span>
              <input required value={form.weekExpression} onChange={(event) => update('weekExpression', event.target.value)} placeholder="1-16 或 1,3,5" />
              <small>支持 1-16、1,3,5 和多段周次</small>
            </label>
            <label>
              <span>单双周</span>
              <select value={form.weekParity} onChange={(event) => update('weekParity', event.target.value as WeekParity)}>
                <option value="all">每周</option>
                <option value="odd">仅单周</option>
                <option value="even">仅双周</option>
                <option value="custom">按填写周次</option>
              </select>
            </label>
            <label>
              <span>教学楼 / 楼座原文</span>
              <input value={form.buildingName} onChange={(event) => update('buildingName', event.target.value)} placeholder="从课表中原样保留" />
              <small>尚未核验的楼座不会自动关联地图</small>
            </label>
            <label>
              <span>教室 / 详细地点</span>
              <input value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="例如：201" />
            </label>
            <label className="span-2">
              <span>兴趣标签</span>
              <input value={form.tags} onChange={(event) => update('tags', event.target.value)} placeholder="计算机、设计、创业（用顿号分隔）" />
              <small>标签会用于蹭课兴趣筛选，不会自动猜测。</small>
            </label>
            <label className="span-2">
              <span>备注</span>
              <textarea rows={2} value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="可留空" />
            </label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <footer>
            <span>保存后自动更新周课表</span>
            <div>
              <button className="secondary-button" type="button" onClick={requestClose}>取消</button>
              <button className="primary-button" type="submit">{editing ? '保存修改' : '添加课程'}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

function ImportModal({
  preview,
  filename,
  onClose,
  onConfirm,
}: {
  preview: ImportPreview;
  filename: string;
  onClose: () => void;
  onConfirm: (mode: 'append' | 'replace') => void;
}) {
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(dialogRef, onClose);
  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={dialogRef} className="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title" tabIndex={-1}>
        <header>
          <div>
            <span className="modal-kicker">课表导入预览</span>
            <h2 id="import-title">{filename}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>×</button>
        </header>
        <div className="import-summary">
          <div><strong>{preview.acceptedRows}</strong><span>可导入</span></div>
          <div><strong>{preview.warnings.length}</strong><span>提醒</span></div>
          <div className={preview.errors.length ? 'has-error' : ''}><strong>{preview.errors.length}</strong><span>错误</span></div>
        </div>
        {preview.issues.length > 0 ? (
          <div className="import-issues" aria-label="导入检查结果">
            {preview.issues.slice(0, 12).map((issue, index) => (
              <div className={`issue-row ${issue.severity}`} key={`${issue.row}-${issue.code}-${index}`}>
                <span>{issue.severity === 'error' ? '错误' : '提醒'}</span>
                <strong>第 {issue.row} 行</strong>
                <p>{issue.message}</p>
              </div>
            ))}
            {preview.issues.length > 12 && <p className="more-issues">还有 {preview.issues.length - 12} 条未展开。</p>}
          </div>
        ) : (
          <p className="import-clean">字段、周次和节次检查通过。</p>
        )}
        <fieldset className="import-mode" disabled={preview.status === 'invalid'}>
          <legend>如何合并</legend>
          <label className={mode === 'append' ? 'selected' : ''}>
            <input type="radio" name="import-mode" checked={mode === 'append'} onChange={() => setMode('append')} />
            <span><strong>追加到当前课表</strong><small>相同课程已在预览中跳过</small></span>
          </label>
          <label className={mode === 'replace' ? 'selected' : ''}>
            <input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
            <span><strong>替换当前课表</strong><small>建议先导出现有课表备份</small></span>
          </label>
        </fieldset>
        <footer>
          <p>{preview.status === 'invalid' ? '存在错误，当前课表不会被修改。' : `确认后将写入 ${preview.acceptedRows} 条课程。`}</p>
          <div>
            <button className="secondary-button" type="button" onClick={onClose}>取消</button>
            <button className="primary-button" type="button" disabled={preview.status === 'invalid' || preview.courses.length === 0} onClick={() => onConfirm(mode)}>确认导入</button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function CaImportModal({
  onClose,
  onChooseFile,
  onPreview,
}: {
  onClose: () => void;
  onChooseFile: () => void;
  onPreview: (preview: ImportPreview) => void;
}) {
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(dialogRef, onClose);
  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={dialogRef} className="import-modal ca-import-modal" role="dialog" aria-modal="true" aria-labelledby="ca-import-title" tabIndex={-1}>
        <header><div><span className="modal-kicker">教务系统辅助导入</span><h2 id="ca-import-title">从 CSU 教务系统带入课表</h2></div><button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>×</button></header>
        <div className="ca-import-body">
          <p>先打开官方统一认证并由你本人完成登录，再进入网上办事大厅的教务服务，打开“我的课表”。目前学校没有提供可供本页面跨站直接读取的公开接口，因此请复制课表表格内容粘贴到这里，或下载 CSV、TSV、HTML 等课表文件后使用下方的文件导入。我们不会读取或保存账号、密码，也不会代替你登录。</p>
          <button className="secondary-button" type="button" onClick={() => { if (!openCsuSchedulePage()) setError('浏览器阻止了新标签页，请手动打开教务系统。'); }}>打开 CSU 教务系统</button>
          <a href={CSU_CA_SCHEDULE_URL} target="_blank" rel="noreferrer">打开 https://ca.csu.edu.cn/（官方登录页）</a>
          <div className="ca-import-file-action">
            <strong>已经下载课表文件？</strong>
            <button className="secondary-button" type="button" onClick={onChooseFile}>选择 CSV / TSV / HTML / JSON 文件</button>
            <small>Excel 文件请先在教务系统中另存为 CSV；本页不会上传文件。</small>
          </div>
          <label><span>粘贴课表内容</span><textarea rows={9} value={source} onChange={(event) => { setSource(event.target.value); setError(''); }} placeholder="可粘贴网页表格、复制的 TSV/CSV 或课程信息文本" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <footer><p>解析后仍会进入原有预览、错误检查和追加/替换确认。</p><div><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="button" onClick={() => { const preview = parseCsuScheduleText(source, { sourceLabel: 'CSU 教务系统' }); if (preview.status === 'invalid') { setError(preview.errors[0]?.message || '未识别到有效课表。'); return; } onPreview(preview); }}>解析并预览</button></div></footer>
      </section>
    </div>
  );
}

export default function TeachingPage({ onBack }: { onBack: () => void }) {
  const initialLoad = useMemo(() => loadCourses(), []);
  const [courses, setCourses] = useState<Course[]>(initialLoad.courses);
  const [tab, setTab] = useState<TeachingTab>('schedule');
  const [week, setWeek] = useState(() => {
    const stored = Number(window.localStorage.getItem(SELECTED_WEEK_KEY));
    return Number.isInteger(stored) && stored >= 1 && stored <= DEFAULT_MAX_WEEK ? stored : 1;
  });
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [editing, setEditing] = useState<Course | null | undefined>(undefined);
  const [saveState, setSaveState] = useState<SaveState>(() => initialLoad.status === 'error' || initialLoad.status === 'unavailable'
    ? { kind: 'error', message: initialLoad.message || '课表读取失败' }
    : { kind: 'saved', message: '已保存到此浏览器' });
  const [sharing, setSharing] = useState(() => getSharingEnabled());
  const [communityState, setCommunityState] = useState<CommunityState>('loading');
  const [community, setCommunity] = useState<CommunitySnapshot | null>(null);
  const [communityMessage, setCommunityMessage] = useState('');
  const [discoverDay, setDiscoverDay] = useState<'all' | Weekday>('all');
  const [discoverBuilding, setDiscoverBuilding] = useState('all');
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [myInterests, setMyInterests] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(INTERESTS_KEY) ?? '[]');
      return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string').slice(0, 12) : [];
    } catch { return []; }
  });
  const [interestDraft, setInterestDraft] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importFilename, setImportFilename] = useState('');
  const [caImportOpen, setCaImportOpen] = useState(false);
  const [toast, setToast] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const mainElement = useRef<HTMLElement>(null);

  useEffect(() => {
    mainElement.current?.focus();
  }, []);

  const refreshCommunity = async (personal = courses, shouldSync = sharing) => {
    setCommunityState('loading');
    setCommunityMessage('');
    try {
      const snapshot = shouldSync
        ? await syncCommunityCourses(personal, TERM_ID)
        : await loadCommunityCourses(TERM_ID);
      setCommunity(snapshot);
      setCommunityState(shouldSync ? 'ready' : 'disabled');
    } catch (reason) {
      setCommunityState(shouldSync ? 'offline' : 'disabled');
      setCommunityMessage(reason instanceof Error ? reason.message : '社区课程暂时无法读取。');
      try {
        const snapshot = await loadCommunityCourses(TERM_ID);
        setCommunity(snapshot);
      } catch {
        // Personal schedules stay available even when the aggregate is offline.
      }
    }
  };

  useEffect(() => {
    void refreshCommunity(initialLoad.courses, getSharingEnabled());
    // The first contribution/load belongs to this page session only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.localStorage.setItem(INTERESTS_KEY, JSON.stringify(myInterests));
  }, [myInterests]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshCommunity(courses, sharing);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [courses, sharing]);

  useEffect(() => {
    window.localStorage.setItem(SELECTED_WEEK_KEY, String(week));
  }, [week]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const persistCourses = (next: Course[], successMessage: string) => {
    setSaveState({ kind: 'saving', message: '正在保存…' });
    const result = saveCourses(next);
    if (result.status !== 'saved') {
      setSaveState({ kind: 'error', message: result.message || '浏览器保存失败' });
      setToast(result.message || '保存失败，原课表未被覆盖。');
      return false;
    }
    setCourses(result.courses);
    setSaveState({ kind: 'saved', message: formatSavedTime(result.savedAt) });
    setToast(successMessage);
    if (sharing) void refreshCommunity(result.courses, true);
    return true;
  };

  const activeCourses = useMemo(() => courses
    .filter((course) => courseOccursInWeek(course, week))
    .filter((course) => buildingFilter === 'all' || locationFilterKey(course) === buildingFilter)
    .sort(compareCourses), [buildingFilter, courses, week]);

  const locationOptions = useMemo(() => {
    const map = new Map<string, string>();
    courses.forEach((course) => map.set(locationFilterKey(course), courseLocationLabel(course)));
    return [...map.entries()].sort((first, second) => first[1].localeCompare(second[1], 'zh-CN'));
  }, [courses]);

  const communityCourses = community?.courses ?? [];
  const interestOptions = useMemo(() => [...new Set(communityCourses.flatMap((course) => course.tags))]
    .filter(Boolean)
    .sort((first, second) => first.localeCompare(second, 'zh-CN')), [communityCourses]);
  const discoverLocations = useMemo(() => {
    const map = new Map<string, string>();
    communityCourses.forEach((course) => map.set(locationFilterKey(course), courseLocationLabel(course)));
    return [...map.entries()].sort((first, second) => first[1].localeCompare(second[1], 'zh-CN'));
  }, [communityCourses]);

  const discoverCourses = useMemo(() => {
    const personalFingerprints = new Set(courses.map(courseFingerprint));
    const query = discoverQuery.trim().toLocaleLowerCase('zh-CN');
    return communityCourses
      .filter((course) => !personalFingerprints.has(courseFingerprint(course)))
      .filter((course) => courseOccursInWeek(course, week))
      .filter((course) => discoverDay === 'all' || course.weekday === discoverDay)
      .filter((course) => discoverBuilding === 'all' || locationFilterKey(course) === discoverBuilding)
      .filter((course) => selectedInterests.length === 0 || selectedInterests.some((tag) => [course.name, course.teacher, course.location, course.buildingName, ...course.tags].join(' ').toLocaleLowerCase('zh-CN').includes(tag.toLocaleLowerCase('zh-CN'))))
      .filter((course) => !query || [course.name, course.teacher, course.location, course.buildingName, ...course.tags]
        .join(' ').toLocaleLowerCase('zh-CN').includes(query))
      .filter((course) => !courses.some((personal) => coursesConflict(course, personal, week)))
      .sort(compareCourses);
  }, [communityCourses, courses, discoverBuilding, discoverDay, discoverQuery, selectedInterests, week]);

  const addInterest = () => {
    const value = interestDraft.trim();
    if (!value) return;
    setMyInterests((current) => current.includes(value) ? current : [...current, value].slice(-12));
    setSelectedInterests((current) => current.includes(value) ? current : [...current, value]);
    setInterestDraft('');
  };

  const handleCourseSubmit = (course: Course) => {
    const next = editing
      ? courses.map((existing) => existing.id === editing.id ? course : existing)
      : [...courses, course];
    if (persistCourses(next, editing ? '课程已更新' : '课程已添加')) setEditing(undefined);
  };

  const handleDelete = (course: Course) => {
    if (!window.confirm(`确定删除“${course.name}”吗？`)) return;
    persistCourses(courses.filter((candidate) => candidate.id !== course.id), '课程已删除');
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setToast('文件超过 2 MB，请检查后重试。');
      return;
    }
    try {
      const text = await file.text();
      const preview = parseCsuScheduleText(text, {
        existingCourses: courses,
        sourceLabel: file.name,
      });
      // The file picker is also reachable from the CSU helper dialog. Close
      // that dialog before showing the shared preview so two modal backdrops
      // cannot remain stacked after a successful file selection.
      setCaImportOpen(false);
      setImportFilename(file.name);
      setImportPreview(preview);
    } catch {
      setToast('无法读取文件，请使用 UTF-8 编码的 CSV、TSV、HTML 或 JSON。');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const confirmImport = (mode: 'append' | 'replace') => {
    if (!importPreview || importPreview.status === 'invalid') return;
    if (mode === 'replace' && courses.length > 0 && !window.confirm('替换会移除当前课表。是否已导出备份并继续？')) return;
    const next = mode === 'replace' ? importPreview.courses : [...courses, ...importPreview.courses];
    if (persistCourses(next, `已导入 ${importPreview.courses.length} 条课程`)) setImportPreview(null);
  };

  const acceptCaPreview = (preview: ImportPreview) => {
    setImportFilename('CSU 教务系统课表');
    setImportPreview(preview);
    setCaImportOpen(false);
  };

  const handleSharing = async (enabled: boolean) => {
    setSharing(enabled);
    setSharingEnabled(enabled);
    setCommunityState('loading');
    try {
      if (enabled) {
        const snapshot = await syncCommunityCourses(courses, TERM_ID);
        setCommunity(snapshot);
        setCommunityState('ready');
        setToast('已开启匿名课程汇总');
      } else {
        await withdrawCommunityCourses();
        const snapshot = await loadCommunityCourses(TERM_ID);
        setCommunity(snapshot);
        setCommunityState('disabled');
        setToast('已撤回你的共享课程');
      }
    } catch (reason) {
      setCommunityState(enabled ? 'offline' : 'disabled');
      setCommunityMessage(reason instanceof Error ? reason.message : '课池设置暂时无法更新。');
      setToast(reason instanceof Error ? reason.message : '课池设置更新失败');
    }
  };

  const downloadTemplate = () => {
    triggerDownload('\uFEFF课程名称,星期,开始节数,结束节数,老师,地点,周数,兴趣标签\r\n', 'WakeUp-兼容课表模板.csv');
  };

  return (
    <main ref={mainElement} className="teaching-page" tabIndex={-1}>
      <header className="teaching-header">
        <button className="back-to-map" type="button" onClick={onBack}><span aria-hidden="true">←</span><em>返回校园</em></button>
        <div className="teaching-title-mark" aria-hidden="true"><span>课</span></div>
        <div className="teaching-title">
          <p>潇湘校区 · 教学楼群</p>
          <h1>课表与蹭课中心</h1>
        </div>
        <div className="teaching-statuses">
          <div className={`save-state ${saveState.kind}`}><i /> <span>{saveState.message}</span></div>
          <label className="sharing-switch" title="只上传课程字段，聚合结果不显示用户身份">
            <input type="checkbox" checked={sharing} disabled={communityState === 'loading'} onChange={(event) => void handleSharing(event.target.checked)} />
            <span aria-hidden="true" />
            匿名汇总
          </label>
        </div>
      </header>

      <div className="teaching-nav-row">
        <nav className="teaching-tabs" aria-label="教学楼功能">
          <button type="button" aria-current={tab === 'schedule' ? 'page' : undefined} className={tab === 'schedule' ? 'active' : ''} onClick={() => setTab('schedule')}><span aria-hidden="true">▦</span>个人课表</button>
          <button type="button" aria-current={tab === 'discover' ? 'page' : undefined} className={tab === 'discover' ? 'active' : ''} onClick={() => setTab('discover')}><span aria-hidden="true">✦</span>蹭课发现</button>
          <button type="button" aria-current={tab === 'manage' ? 'page' : undefined} className={tab === 'manage' ? 'active' : ''} onClick={() => setTab('manage')}><span aria-hidden="true">≡</span>课表管理</button>
        </nav>
        <WeekPicker week={week} onChange={setWeek} />
      </div>

      {tab === 'schedule' && (
        <section className="schedule-view">
          <div className="section-heading schedule-heading">
            <div>
              <p>当前学期未绑定校历，手动选择教学周</p>
              <h2>第 {week} 周课表</h2>
            </div>
            <div className="heading-actions">
              <label className="select-field">
                <span>楼座筛选</span>
                <select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}>
                  <option value="all">全部地点</option>
                  {locationOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <button className="primary-button" type="button" onClick={() => setEditing(null)}>+  添加课程</button>
            </div>
          </div>
          {courses.length === 0 ? (
            <EmptyState
              title="这学期的课表还是空的"
              description="录入一门课，或导入 WakeUp 兼容 CSV，就能生成完整周课表。"
              primaryLabel="添加课程"
              onPrimary={() => setEditing(null)}
              secondaryLabel="导入 CSV"
              onSecondary={() => fileInput.current?.click()}
            />
          ) : activeCourses.length === 0 ? (
            <EmptyState
              title={`第 ${week} 周没有符合条件的课`}
              description={buildingFilter === 'all' ? '这可能是一个空课周，可以切换教学周查看。' : '当前楼座筛选下没有课程。'}
              primaryLabel={buildingFilter === 'all' ? '下一周' : '清除筛选'}
              onPrimary={() => buildingFilter === 'all' ? setWeek(Math.min(DEFAULT_MAX_WEEK, week + 1)) : setBuildingFilter('all')}
            />
          ) : (
            <ScheduleGrid courses={activeCourses} week={week} onEdit={(course) => setEditing(course)} />
          )}
          <footer className="schedule-legend">
            <span><i className="legend-personal" />点击课程可编辑</span>
            <span><i className="legend-unlinked" />楼座仅保留原文，待地图目录核验</span>
          </footer>
        </section>
      )}

      {tab === 'discover' && (
        <section className="discover-view">
          <div className="discover-intro">
            <div>
              <p>基于你的空闲节次和同学匿名课表汇总</p>
              <h2>今周有什么值得去听？</h2>
            </div>
            <div className="community-pulse">
              <i className={communityState} />
              <strong>{community?.contributorCount ?? 0}</strong>
              <span>位本机参与者<br />{formatCommunityTime(community?.updatedAt)}</span>
              <button type="button" aria-label="刷新社区课池" onClick={() => void refreshCommunity(courses, sharing)} disabled={communityState === 'loading'}>刷新</button>
            </div>
          </div>

          <div className="discover-layout">
            <aside className="discover-filters">
              <div className="filter-title"><strong>蹭课条件</strong><button type="button" onClick={() => { setDiscoverDay('all'); setDiscoverBuilding('all'); setSelectedInterests([]); setDiscoverQuery(''); }}>重置筛选</button></div>
              <label className="search-field"><span aria-hidden="true">⌕</span><input value={discoverQuery} onChange={(event) => setDiscoverQuery(event.target.value)} placeholder="搜课程或教师" /></label>
              <fieldset>
                <legend>星期</legend>
                <div className="filter-chips compact">
                  <button type="button" aria-pressed={discoverDay === 'all'} className={discoverDay === 'all' ? 'active' : ''} onClick={() => setDiscoverDay('all')}>全部</button>
                  {weekdays.map((day) => <button type="button" aria-pressed={discoverDay === day} className={discoverDay === day ? 'active' : ''} onClick={() => setDiscoverDay(day)} key={day}>{WEEKDAY_LABELS[day].slice(1)}</button>)}
                </div>
              </fieldset>
              <label className="filter-select">
                <span>教学楼 / 楼座</span>
                <select value={discoverBuilding} onChange={(event) => setDiscoverBuilding(event.target.value)}>
                  <option value="all">不限地点</option>
                  {discoverLocations.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <fieldset>
                <legend>我的兴趣</legend>
                <div className="interest-entry">
                  <input aria-label="添加兴趣关键词" value={interestDraft} onChange={(event) => setInterestDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addInterest(); } }} placeholder="例如：人工智能" />
                  <button type="button" onClick={addInterest}>添加</button>
                </div>
                {myInterests.length > 0 ? (
                  <div className="filter-chips interests">
                    {myInterests.map((tag) => (
                      <button
                        type="button"
                        aria-pressed={selectedInterests.includes(tag)}
                        className={selectedInterests.includes(tag) ? 'active' : ''}
                        onClick={() => setSelectedInterests((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])}
                      key={tag}
                    >{tag}</button>
                    ))}
                  </div>
                ) : <p className="filter-hint">添加关键词后，蹭课结果会按课程名、教师、地点和课程标签筛选。</p>}
              </fieldset>
              <div className="privacy-note"><strong>如何判断空闲？</strong><p>候选课程与你第 {week} 周的任一课程有节次重叠时，会自动排除。</p></div>
            </aside>

            <div className="discover-results">
              <div className="results-bar">
                <div><strong>{discoverCourses.length}</strong><span>门课符合你的空闲时段</span></div>
                <span className="week-stamp">W{String(week).padStart(2, '0')} · {week % 2 ? '单周' : '双周'}</span>
              </div>
              {courses.length === 0 ? (
                <EmptyState title="先完成你的课表" description="没有个人课表时，无法准确判断哪些节次是空闲的。" primaryLabel="去录入课程" onPrimary={() => setTab('manage')} />
              ) : communityState === 'offline' && !community ? (
                <EmptyState title="社区课池暂时不可用" description={`${communityMessage}你的个人课表仍已保存，可稍后重试。`} primaryLabel="重新加载" onPrimary={() => void refreshCommunity()} />
              ) : discoverCourses.length === 0 ? (
                <EmptyState title="还没有合适的蹭课线索" description="这不代表学校没有开课。可能是课池样本较少，或筛选条件较窄。" primaryLabel="清空筛选" onPrimary={() => { setDiscoverDay('all'); setDiscoverBuilding('all'); setSelectedInterests([]); setDiscoverQuery(''); }} />
              ) : (
                <div className="opportunity-list">
                  {discoverCourses.map((course) => (
                    <article className="opportunity-row" key={course.id}>
                      <div className="opportunity-time">
                        <strong>{WEEKDAY_LABELS[course.weekday]}</strong>
                        <span>{course.startPeriod}–{course.endPeriod}节</span>
                      </div>
                      <div className="opportunity-main">
                        <div><h3>{course.name}</h3>{course.contributorCount > 1 && <span className="source-count">{course.contributorCount} 份课表印证</span>}</div>
                        <p>{course.teacher || '教师未填'} <i /> {courseLocationLabel(course)}</p>
                        <div className="course-tags">{course.tags.length > 0 ? course.tags.map((tag) => <span key={tag}>{tag}</span>) : <span className="muted-tag">未分类</span>}</div>
                      </div>
                      <div className="opportunity-action"><span>你此时没课</span><small>{formatWeekExpression(course.weeks)}</small></div>
                    </article>
                  ))}
                </div>
              )}
              <p className="discover-disclaimer">社区课表来自用户自行录入，只作为蹭课线索；不代表学校完整排课、教室实时占用或课程允许旁听。</p>
            </div>
          </div>
        </section>
      )}

      {tab === 'manage' && (
        <section className="manage-view">
          <div className="manage-hero">
            <div><p>课表管理</p><h2>把一学期收进一张表</h2><span>手动录入，或使用 WakeUp 七列 CSV 一次导入。</span></div>
            <div className="manage-actions">
              <button className="primary-button" type="button" onClick={() => setEditing(null)}>+  新增课程</button>
              <button className="secondary-button" type="button" onClick={() => fileInput.current?.click()}>导入 CSV</button>
              <button className="secondary-button" type="button" onClick={() => setCaImportOpen(true)}>从教务系统导入</button>
              <button className="secondary-button" type="button" disabled={courses.length === 0} onClick={() => triggerDownload(exportScheduleCsv(courses), '我的课表.csv')}>导出备份</button>
            </div>
          </div>

          <div className="manage-layout">
            <div className="course-list-panel">
              <header><div><strong>已录入课程</strong><span>{courses.length} 条排课</span></div><button type="button" onClick={() => setTab('schedule')}>查看周表</button></header>
              {courses.length === 0 ? (
                <EmptyState title="还没有课程" description="新增课程或导入 CSV 后，这里会按星期与节次排列。" primaryLabel="新增课程" onPrimary={() => setEditing(null)} />
              ) : (
                <div className="course-list">
                  {[...courses].sort(compareCourses).map((course) => (
                    <article key={course.id}>
                      <div className={`course-list-date course-tone-${stableTone(course.name)}`}><strong>{WEEKDAY_LABELS[course.weekday]}</strong><span>{course.startPeriod}–{course.endPeriod}节</span></div>
                      <div className="course-list-main"><h3>{course.name}</h3><p>{course.teacher || '教师未填'} · {courseLocationLabel(course)}</p><span>{formatWeekExpression(course.weeks)}{course.weekParity === 'odd' ? ' · 单周' : course.weekParity === 'even' ? ' · 双周' : ''}</span></div>
                      <div className="course-list-tags">{course.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>
                      <div className="row-actions"><button type="button" onClick={() => setEditing(course)}>编辑</button><button className="danger" type="button" onClick={() => handleDelete(course)}>删除</button></div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <aside className="import-panel">
              <div className="import-illustration" aria-hidden="true"><span>CSV</span><i /><i /><i /></div>
              <h3>导入现有课表</h3>
              <p>兼容 WakeUp 常用七列模板，也可以从 CSU 教务系统复制课表后解析，支持周次范围、离散周和单双周。</p>
              <ol><li><span>1</span>选择 CSV，或打开教务系统</li><li><span>2</span>查看错误与未匹配地点</li><li><span>3</span>确认追加或替换</li></ol>
              <button className="primary-button full-button" type="button" onClick={() => fileInput.current?.click()}>选择 CSV 文件</button>
              <button className="secondary-button full-button" type="button" onClick={() => setCaImportOpen(true)}>从 CSU 教务系统导入</button>
              <button className="text-button" type="button" onClick={downloadTemplate}>下载空白模板</button>
              <div className="browser-storage-note"><i /> <div><strong>浏览器自动保存</strong><p>个人课表保存在当前浏览器。换设备或清理网站数据前，请先导出备份。</p></div></div>
            </aside>
          </div>
        </section>
      )}

      <input ref={fileInput} className="visually-hidden" type="file" accept=".csv,.tsv,.txt,.html,.htm,.json,text/csv,text/tab-separated-values,text/plain,text/html,application/json" onChange={(event) => void handleFile(event.target.files?.[0])} />
      {editing !== undefined && <CourseFormModal editing={editing} onClose={() => setEditing(undefined)} onSubmit={handleCourseSubmit} />}
      {importPreview && <ImportModal preview={importPreview} filename={importFilename} onClose={() => setImportPreview(null)} onConfirm={confirmImport} />}
      {caImportOpen && <CaImportModal onClose={() => setCaImportOpen(false)} onChooseFile={() => fileInput.current?.click()} onPreview={acceptCaPreview} />}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}

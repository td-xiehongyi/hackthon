import { useEffect, useMemo, useRef, useState } from 'react';
import { coursesToCsv, PERIODS, WEEKDAYS, parseCoursesCsv } from '../teaching/domain';
import { loadTimetable, saveTimetable } from '../teaching/storage';
import { EMPTY_TIMETABLE, type TimetableCourse, type TimetableSnapshot, type WeekParity } from '../teaching/types';
import './TimetableEditor.css';

export interface TimetableEditorProps {
  buildings?: readonly { id: string; name: string }[];
  onDirtyChange?: (dirty: boolean) => void;
}

type Cell = { weekday: number; period: number };
type Draft = Omit<TimetableCourse, 'id'>;

const EMPTY_DRAFT: Draft = {
  title: '', teacher: '', weekday: 0, startPeriod: 0, endPeriod: 0,
  weeks: '', parity: 'all', buildingId: '', location: '', room: '',
};
const COURSE_COLORS = ['#2f7d58', '#8d6b2f', '#477aa2', '#9d5846', '#72528e'];

function makeId(prefix = 'course') {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function TimetableEditor({ buildings = [], onDirtyChange }: TimetableEditorProps) {
  const [snapshot, setSnapshot] = useState<TimetableSnapshot>(EMPTY_TIMETABLE);
  const [ready, setReady] = useState(false);
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [filterBuilding, setFilterBuilding] = useState('all');
  const [notice, setNotice] = useState('点击一个时间格，开始录入课程');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const draftDirty = Boolean(selectedCell && (
    draft.title || draft.teacher || draft.weeks || draft.location || draft.room || draft.buildingId || draft.parity !== 'all' ||
    draft.weekday !== selectedCell.weekday || draft.startPeriod !== selectedCell.period || draft.endPeriod !== selectedCell.period
  ));
  useEffect(() => { onDirtyChange?.(draftDirty); }, [draftDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  useEffect(() => {
    let mounted = true;
    void loadTimetable().then((value) => {
      if (!mounted) return;
      setSnapshot(value);
      setReady(true);
      if (value.courses.length) setNotice(`已恢复 ${value.courses.length} 门课程`);
    }).catch(() => {
      if (mounted) { setReady(true); setNotice('课表读取失败，仍可继续录入；保存时会再次尝试'); }
    });
    return () => { mounted = false; };
  }, []);

  const visibleCourses = useMemo(() => snapshot.courses.filter((course) => {
    if (filterBuilding === 'unlinked') return !course.buildingId;
    return filterBuilding === 'all' || course.buildingId === filterBuilding;
  }), [filterBuilding, snapshot.courses]);

  async function persist(next: TimetableSnapshot, message: string): Promise<boolean> {
    setSaving(true);
    try {
      await saveTimetable(next);
      setSnapshot(next);
      setNotice(message);
      return true;
    } catch {
      setNotice('保存失败，当前改动未确认；请导出课表备份后重试');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openCell(weekday: number, period: number) {
    const existing = visibleCourses.find((course) => course.weekday === weekday && course.startPeriod <= period && course.endPeriod >= period);
    setSelectedCell({ weekday, period });
    setEditingId(existing?.id ?? null);
    setDraft(existing ? { ...existing } : { ...EMPTY_DRAFT, weekday, startPeriod: period, endPeriod: period });
    setNotice(existing ? '正在编辑这门课' : '填写课程信息后保存');
  }

  async function saveCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    const conflict = snapshot.courses.some((item) => item.id !== editingId && item.weekday === draft.weekday && item.startPeriod <= draft.endPeriod && item.endPeriod >= draft.startPeriod);
    if (conflict) {
      setNotice('这个星期与节次已有课程，请先编辑原课程或调整节次');
      return;
    }
    const course: TimetableCourse = { ...draft, id: editingId ?? makeId(), title: draft.title.trim() };
    const courses = editingId
      ? snapshot.courses.map((item) => item.id === editingId ? course : item)
      : [...snapshot.courses, course];
    if (await persist({ ...snapshot, courses }, editingId ? '课程已更新' : '课程已加入课表')) closeForm();
  }

  async function removeCourse() {
    if (!editingId) return;
    if (await persist({ ...snapshot, courses: snapshot.courses.filter((course) => course.id !== editingId) }, '课程已删除')) closeForm();
  }

  async function clearCourses() {
    if (!snapshot.courses.length || !window.confirm('确定清空当前学期课表吗？建议先导出备份。')) return;
    if (await persist({ ...snapshot, courses: [] }, '课表已清空')) closeForm();
  }

  function closeForm() {
    setSelectedCell(null);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  function exportCsv() {
    const blob = new Blob([coursesToCsv(snapshot)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '我的课表.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice('课表备份已导出');
  }

  async function importCsv(file: File) {
    setImporting(true);
    try {
      const result = parseCoursesCsv(await file.text());
      if (result.errors.length || !result.courses.length) {
        setNotice(`导入未完成：${result.errors[0] ?? '没有可导入的课程'}`);
        return;
      }
      const imported = result.courses.map((course) => ({ ...course, id: makeId('import') }));
      await persist({ ...snapshot, courses: [...snapshot.courses, ...imported] }, `已追加导入 ${imported.length} 门课程`);
    } catch {
      setNotice('导入失败，已有课表未改变');
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = '';
    }
  }

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="timetable-editor" aria-label="我的课表">
      <div className="timetable-head">
        <div>
          <span className="timetable-kicker">我的课表</span>
          <h3>把每一节课放回校园地图</h3>
          <p className="timetable-semester">{snapshot.semester} · {ready ? `${snapshot.courses.length} 门课程` : '正在读取…'}</p>
        </div>
        <div className="timetable-actions">
          <button type="button" onClick={exportCsv} disabled={!ready}>导出 CSV / 模板</button>
          <button type="button" onClick={() => importRef.current?.click()} disabled={!ready || importing}>{importing ? '导入中…' : '导入 CSV'}</button>
          <button type="button" className="timetable-clear" onClick={() => void clearCourses()} disabled={!ready || !snapshot.courses.length}>清空</button>
          <input ref={importRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file); }} />
        </div>
      </div>

      <div className="timetable-filters">
        <label>按楼座筛选
          <select value={filterBuilding} onChange={(event) => setFilterBuilding(event.target.value)}>
            <option value="all">全部课程</option>
            <option value="unlinked">未关联楼座</option>
            {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
          </select>
        </label>
        {!buildings.length && <span>楼座目录待核验；可先保留地点原文。</span>}
      </div>

      <div className="timetable-grid-wrap">
        <div className="timetable-grid" role="grid" aria-label="每周课程表">
          <div className="timetable-corner" aria-hidden="true">节次</div>
          {WEEKDAYS.map((day) => <div className="timetable-day" role="columnheader" key={day}>星期{day}</div>)}
          {PERIODS.map((periodLabel, period) => (
            <div className="timetable-row" role="row" key={periodLabel}>
              <div className="timetable-period" role="rowheader">{periodLabel}</div>
              {WEEKDAYS.map((_day, weekday) => {
                const course = visibleCourses.find((item) => item.weekday === weekday && item.startPeriod <= period && item.endPeriod >= period);
                const isSelected = selectedCell?.weekday === weekday && selectedCell.period === period;
                return <button type="button" role="gridcell" className={`timetable-cell ${isSelected ? 'is-selected' : ''}`} key={`${weekday}-${period}`} onClick={() => openCell(weekday, period)} aria-label={`星期${WEEKDAYS[weekday]} ${periodLabel}${course ? `：${course.title}` : '，空'}`}>
                  {course ? <span className="course-card" style={{ '--course-color': COURSE_COLORS[(weekday + course.startPeriod) % COURSE_COLORS.length] } as React.CSSProperties}>
                    <strong>{course.title}</strong>
                    <small>{course.startPeriod !== course.endPeriod ? `${PERIODS[course.startPeriod]}节` : ''}{course.parity !== 'all' ? ` · ${course.parity === 'odd' ? '单周' : '双周'}` : ''}{course.weeks ? ` · ${course.weeks}周` : ''}{course.room || course.location || course.teacher ? ` · ${course.room || course.location || course.teacher}` : ''}</small>
                  </span> : <span className="cell-plus" aria-hidden="true">+</span>}
                </button>;
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="timetable-editor-form" aria-live="polite">
        {selectedCell ? <form onSubmit={(event) => void saveCourse(event)}>
          <div className="form-title"><strong>{editingId ? '编辑课程' : '录入课程'}</strong><span>星期{WEEKDAYS[draft.weekday]} · {PERIODS[draft.startPeriod]}</span></div>
          <div className="form-row form-row-wide">
            <label>课程名称<input autoFocus value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="例如：大学生心理健康教育" required /></label>
            <label>教师<input value={draft.teacher} onChange={(event) => updateDraft('teacher', event.target.value)} placeholder="可选" /></label>
          </div>
          <div className="form-row">
            <label>起始节次<select value={draft.startPeriod} onChange={(event) => { const start = Number(event.target.value); updateDraft('startPeriod', start); if (draft.endPeriod < start) updateDraft('endPeriod', start); }}>{PERIODS.map((period, index) => <option key={period} value={index}>{period}</option>)}</select></label>
            <label>结束节次<select value={draft.endPeriod} onChange={(event) => updateDraft('endPeriod', Number(event.target.value))}>{PERIODS.map((period, index) => <option key={period} value={index} disabled={index < draft.startPeriod}>{period}</option>)}</select></label>
            <label>周次<input value={draft.weeks} onChange={(event) => updateDraft('weeks', event.target.value)} placeholder="如 1–16" /></label>
            <label>单双周<select value={draft.parity} onChange={(event) => updateDraft('parity', event.target.value as WeekParity)}><option value="all">每周</option><option value="odd">单周</option><option value="even">双周</option></select></label>
          </div>
          <div className="form-row form-row-wide">
            <label>楼座<select value={draft.buildingId} onChange={(event) => updateDraft('buildingId', event.target.value)}><option value="">未关联 / 待核验</option>{buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select></label>
            <label>地点原文<input value={draft.location} onChange={(event) => updateDraft('location', event.target.value)} placeholder="无法匹配时保留教务系统原文" /></label>
            <label>教室<input value={draft.room} onChange={(event) => updateDraft('room', event.target.value)} placeholder="如 A203" /></label>
          </div>
          <div className="form-actions"><button type="submit" className="timetable-save" disabled={saving}>{saving ? '保存中…' : '保存课程'}</button>{editingId && <button type="button" className="timetable-delete" onClick={() => void removeCourse()}>删除</button>}<button type="button" className="timetable-cancel" onClick={closeForm}>取消</button></div>
        </form> : <p className="timetable-notice">{notice}。课程只保存在当前浏览器的 IndexedDB；不会上传教务系统。</p>}
      </div>
    </section>
  );
}

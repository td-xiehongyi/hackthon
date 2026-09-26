export type WeekParity = 'all' | 'odd' | 'even';

export interface TimetableCourse {
  id: string;
  title: string;
  teacher: string;
  weekday: number;
  startPeriod: number;
  endPeriod: number;
  weeks: string;
  parity: WeekParity;
  buildingId: string;
  location: string;
  room: string;
}

export interface TimetableSnapshot {
  schemaVersion: 1;
  semester: string;
  courses: TimetableCourse[];
}

export const EMPTY_TIMETABLE: TimetableSnapshot = {
  schemaVersion: 1,
  semester: '2026–2027 第一学期',
  courses: [],
};

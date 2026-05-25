import { api } from './client';

export interface AcademicCalendarEvent {
  id: number;
  title: string;
  description: string;
  category: string;
  start_date: string;
  end_date: string | null;
  academic_year: string;
  semester: string;
  is_important: boolean;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  description: string;
  department: string;
  credit_hours: number;
  lecturer: any;
}

export interface Exam {
  id: number;
  course: Course;
  exam_type: string;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
}

export interface Assignment {
  id: number;
  title: string;
  description: string;
  course: Course | null;
  assignment_type: string;
  due_date: string;
  max_score: number;
}

export interface Grade {
  id: number;
  course: Course;
  score: string;
  max_score: string;
  percentage: number;
  grade_letter: string;
  remarks: string;
}

export const fetchAcademicCalendar = async (params?: Record<string, any>) => {
  const { data } = await api.get('/academic/calendar/', { params });
  return data;
};

export const fetchCourses = async (params?: Record<string, any>) => {
  const { data } = await api.get('/academic/courses/', { params });
  return data;
};

export const fetchExams = async (params?: Record<string, any>) => {
  const { data } = await api.get('/academic/exams/', { params });
  return data;
};

export const fetchAssignments = async (params?: Record<string, any>) => {
  const { data } = await api.get('/academic/assignments/', { params });
  return data;
};

export const fetchGrades = async () => {
  const { data } = await api.get('/academic/grades/');
  return data;
};

export const fetchMyGPA = async () => {
  const { data } = await api.get('/academic/grades/my-gpa/');
  return data;
};

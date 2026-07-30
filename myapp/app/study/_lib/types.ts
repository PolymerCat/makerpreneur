export type Course = {
  id: string;
  name: string;
};

export type Material = {
  id: string;
  courseId: string;
  title: string;
  fileUrl: string;
  fileType: string;
  status: string;
  createdAt: string;
  category: string;
  year: number;
  semester: string;
};

export type Chunk = {
  id: string;
  materialId: string;
  page: number;
  chunkIndex: number;
  text: string;
  embedding: number[];
};

export type Summary = {
  id: string;
  materialId: string;
  mode: string;
  language: string;
  content: string;
};

export type Deck = {
  id: string;
  materialId: string;
  title: string;
};

export type Card = {
  id: string;
  deckId: string;
  front: string;
  back: string;
  easiness: number;
  interval: number;
  repetitions: number;
  dueDate: string;
};

export type Quiz = {
  id: string;
  materialId: string;
  title: string;
};

export type Question = {
  id: string;
  quizId: string;
  kind: string;
  prompt: string;
  options: string[];
  answer: string;
  rubric: string;
  explanations?: Record<string, string> | null;
};

export type StudyPlan = {
  id: string;
  courseId: string;
  examDate: string;
  goals: string;
};

export type PlanDay = {
  id: string;
  planId: string;
  dayNumber: number;
  date: string;
  topic: string;
  tasks: string;
  done: boolean;
};

export type ScheduleBlock = {
  id: string;
  title: string;
  kind: string;
  startsAt: string;
  endsAt: string;
};

export type Prediction = {
  id: string;
  courseId: string;
  createdAt: string;
  freqJson: string;
  questionsJson: string;
  studiedIds: string;
};



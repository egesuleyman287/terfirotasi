import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ImportedQuestion } from './htmlQuestionImporter';
import type { LocalUser } from './localAuth';

export type StoredQuestion = ImportedQuestion & {
  id: string;
  role: string;
  topic: string;
  createdAt: string;
};

const STORAGE_KEY = 'terfi_question_pool_v1';
const SUPABASE_URL = 'https://hkfjjyltkfoiqujvelug.supabase.co';
const PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZmpqeWx0a2ZvaXF1anZlbHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NjQ2MDIsImV4cCI6MjEwMTQ0MDYwMn0.JI04LXbh5Lt4RACcFfEmB7FxsOe1Gr4xVXNBZ5f8En0';

export async function loadQuestionPool(): Promise<StoredQuestion[]> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  if (!value) return [];
  try {
    return JSON.parse(value) as StoredQuestion[];
  } catch {
    return [];
  }
}

export async function saveImportedQuestions(input: {
  questions: ImportedQuestion[];
  role: string;
  topic: string;
}): Promise<StoredQuestion[]> {
  const current = await loadQuestionPool();
  const timestamp = new Date().toISOString();
  const additions = input.questions.map((question, index) => ({
    ...question,
    id: `${timestamp}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    role: input.role,
    topic: input.topic,
    createdAt: timestamp,
  }));
  const next = [...current, ...additions];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

type CloudQuestion = {
  id: string;
  role: string;
  topic: string;
  text: string;
  choices: string[];
  correct_answer: number;
  reference: string | null;
  created_at: string;
};

function asStoredQuestion(question: CloudQuestion): StoredQuestion {
  return { id: question.id, role: question.role, topic: question.topic, text: question.text, choices: question.choices, correctAnswer: question.correct_answer, reference: question.reference ?? undefined, createdAt: question.created_at };
}

async function cloudRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { message?: string }).message ?? 'Merkezi soru havuzuna ulaşılamadı.');
  return body as T;
}

export async function loadCloudQuestionPool(): Promise<StoredQuestion[]> {
  const rows = await cloudRequest<CloudQuestion[]>('/rest/v1/question_bank?select=id,role,topic,text,choices,correct_answer,reference,created_at&order=created_at.asc');
  return rows.map(asStoredQuestion);
}

export async function saveCloudImportedQuestions(input: { questions: ImportedQuestion[]; role: string; topic: string; user: LocalUser }): Promise<StoredQuestion[]> {
  if (!input.user.accessToken) throw new Error('Yönetici oturumu bulunamadı. Lütfen yeniden giriş yap.');
  const rows = input.questions.map(question => ({ role: input.role, topic: input.topic, text: question.text, choices: question.choices, correct_answer: question.correctAnswer, reference: question.reference ?? null }));
  await cloudRequest('/rest/v1/question_bank?on_conflict=role,topic,text', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows) }, input.user.accessToken);
  return loadCloudQuestionPool();
}

export async function syncLocalQuestionPool(user: LocalUser): Promise<StoredQuestion[]> {
  const local = await loadQuestionPool();
  if (!local.length) return loadCloudQuestionPool();
  if (!user.accessToken) throw new Error('Yönetici oturumu bulunamadı.');
  const rows = local.map(question => ({ role: question.role, topic: question.topic, text: question.text, choices: question.choices, correct_answer: question.correctAnswer, reference: question.reference ?? null }));
  await cloudRequest('/rest/v1/question_bank?on_conflict=role,topic,text', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows) }, user.accessToken);
  return loadCloudQuestionPool();
}

export function countByRoleAndTopic(questions: StoredQuestion[]) {
  return questions.reduce<Record<string, number>>((counts, question) => {
    const key = `${question.role}__${question.topic}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

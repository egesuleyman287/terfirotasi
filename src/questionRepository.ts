import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ImportedQuestion } from './htmlQuestionImporter';

export type StoredQuestion = ImportedQuestion & {
  id: string;
  role: string;
  topic: string;
  createdAt: string;
};

const STORAGE_KEY = 'terfi_question_pool_v1';

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

export function countByRoleAndTopic(questions: StoredQuestion[]) {
  return questions.reduce<Record<string, number>>((counts, question) => {
    const key = `${question.role}__${question.topic}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

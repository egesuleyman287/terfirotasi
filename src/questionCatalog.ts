import { SEED_QUESTIONS_399 } from './seedQuestions';
import { SEED_QUESTIONS_TURKISH } from './seedQuestionsTurkish';
import { SEED_QUESTIONS_COMMON } from './seedQuestionsCommon';
import { SEED_QUESTIONS_399_EXAM_STYLE } from './seedQuestions399ExamStyle';
import { SEED_QUESTIONS_ETHICS_EXAM } from './seedQuestionsEthicsExam';

export const COMMON_QUESTION_CATALOG = {
  '399 Sayılı Kanun Hükmünde Kararname': [...SEED_QUESTIONS_399, ...SEED_QUESTIONS_399_EXAM_STYLE],
  'Türkçe ve Dil Bilgisi': SEED_QUESTIONS_TURKISH,
  '657 Sayılı Devlet Memurları Kanunu': SEED_QUESTIONS_COMMON.filter(question => question.topic === '657 Sayılı Devlet Memurları Kanunu'),
  '6698 Sayılı Kişisel Verilerin Korunması Kanunu': SEED_QUESTIONS_COMMON.filter(question => question.topic === '6698 Sayılı Kişisel Verilerin Korunması Kanunu'),
  '6331 Sayılı İş Sağlığı ve Güvenliği Kanunu': SEED_QUESTIONS_COMMON.filter(question => question.topic === '6331 Sayılı İş Sağlığı ve Güvenliği Kanunu'),
  '4857 Sayılı İş Kanunu': SEED_QUESTIONS_COMMON.filter(question => question.topic === '4857 Sayılı İş Kanunu'),
  'Kamu Görevlileri Etik Davranış İlkeleri ile Başvuru Usul ve Esasları Hakkında Yönetmelik': [...SEED_QUESTIONS_COMMON.filter(question => question.topic === 'Kamu Görevlileri Etik Davranış İlkeleri ile Başvuru Usul ve Esasları Hakkında Yönetmelik'), ...SEED_QUESTIONS_ETHICS_EXAM],
  'Resmî Yazışmalarda Uygulanacak Usul ve Esaslar Hakkında Yönetmelik': SEED_QUESTIONS_COMMON.filter(question => question.topic === 'Resmî Yazışmalarda Uygulanacak Usul ve Esaslar Hakkında Yönetmelik'),
};

export const COMMON_QUESTION_COUNT = Object.values(COMMON_QUESTION_CATALOG)
  .reduce((total, questions) => total + questions.length, 0);

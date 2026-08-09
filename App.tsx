import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { importQuestionsFromHtml, type ImportedQuestion } from './src/htmlQuestionImporter';
import { loadQuestionPool, saveImportedQuestions, type StoredQuestion } from './src/questionRepository';
import { currentLocalUser, removeLocalUser, saveLocalUser, type LocalUser } from './src/localAuth';
import { clearRemoteSession, createRemoteAccount, EmailVerificationRequiredError, loginRemoteAccount, remoteProfile, resendVerificationEmail, sendPasswordResetEmail } from './src/supabaseAuth';
import { SEED_QUESTIONS_399 } from './src/seedQuestions';
import { COMMON_QUESTION_CATALOG, COMMON_QUESTION_COUNT } from './src/questionCatalog';

type Role = 'Büro Şefi' | 'Lojistik Şefi' | 'Araç Bakım Servis Müdür Yardımcısı' | 'EYS Kontrolörü' | 'Personel ve Mali İşler Servis Müdür Yardımcısı' | 'Satın Alma ve Stok Kontrol Servis İkinci Müdürü' | 'Yük Servis Müdür Yardımcısı' | 'Yolcu Hizmetleri Müdürü' | 'Destek Hizmetleri Servis İkinci Müdürü';
type Screen = 'home' | 'exams' | 'role-info' | 'study' | 'quiz' | 'result' | 'membership' | 'progress' | 'admin' | 'auth';
type Plan = 'free' | 'premium';
type Question = { topic: string; text: string; choices: string[]; answer: number; reference: string; explanation: string };
type Attempt = { id: string; role: Role; correct: number; total: number; date: string };
type WrongQuestion = Question & { id: string; role: Role; date: string };

const COLORS = { blue: '#087DB6', navy: '#075A86', red: '#E83F4A', bg: '#F7F9FB', ink: '#2E3742', muted: '#8A98A6', line: '#E1E8EE', white: '#FFFFFF', green: '#147A45', gold: '#9A5B00' };
const TERFI_AMBLEM = require('./assets/terfi-rotasi-amblem.png');
const TCDD_LOGO = require('./assets/tcdd-tasimacilik-logo.png');
const REGISTER_ILLUSTRATION = require('./assets/register-illustration.png');
const ADMIN_EMAILS = ['egesuleyman287@gmail.com'];
const ROLES: { name: Role; special: string }[] = [
  { name: 'Büro Şefi', special: '4688 Sayılı Kanun' },
  { name: 'Lojistik Şefi', special: 'Trenlerin Hazırlanması ve Trafiği' },
  { name: 'Araç Bakım Servis Müdür Yardımcısı', special: 'Emniyet Kritik Görevler' },
  { name: 'EYS Kontrolörü', special: 'TCDD Acil Eylem Yönergesi' },
  { name: 'Personel ve Mali İşler Servis Müdür Yardımcısı', special: 'Özel konu bilgisi eklenecek' },
  { name: 'Satın Alma ve Stok Kontrol Servis İkinci Müdürü', special: 'Özel konu bilgisi eklenecek' },
  { name: 'Yük Servis Müdür Yardımcısı', special: 'Özel konu bilgisi eklenecek' },
  { name: 'Yolcu Hizmetleri Müdürü', special: 'Özel konu bilgisi eklenecek' },
  { name: 'Destek Hizmetleri Servis İkinci Müdürü', special: 'Özel konu bilgisi eklenecek' },
];
const CITIES = ['Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin', 'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkâri', 'Hatay', 'Isparta', 'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce'];
const COMMON_TOPICS = ['Türkçe ve Dil Bilgisi', '399 Sayılı Kanun Hükmünde Kararname', 'Resmî Yazışmalarda Uygulanacak Usul ve Esaslar Hakkında Yönetmelik', '233 Sayılı Kamu İktisadi Teşebbüsleri Hakkında Kanun Hükmünde Kararname', 'Kamu Görevlileri Etik Davranış İlkeleri ile Başvuru Usul ve Esasları Hakkında Yönetmelik', '6698 Sayılı Kişisel Verilerin Korunması Kanunu', '657 Sayılı Devlet Memurları Kanunu', '6331 Sayılı İş Sağlığı ve Güvenliği Kanunu', '4857 Sayılı İş Kanunu', '31. Dönem Grup Toplu İş Sözleşmesi (Demiryol-İş)'];
const SPECIAL_TOPICS: Record<Role, string> = {
  'Büro Şefi': '4688 Sayılı Kamu Görevlileri Sendikaları ve Toplu Sözleşme Kanunu',
  'Lojistik Şefi': 'Trenlerin Hazırlanması ve Trafiğine Ait Yönetmelik',
  'Araç Bakım Servis Müdür Yardımcısı': 'Demiryolu Emniyet Kritik Görevler Yönetmeliği',
  'EYS Kontrolörü': 'TCDD Acil Eylem Yönergesi',
  'Personel ve Mali İşler Servis Müdür Yardımcısı': 'Özel konu bilgisi eklenecek',
  'Satın Alma ve Stok Kontrol Servis İkinci Müdürü': 'Özel konu bilgisi eklenecek',
  'Yük Servis Müdür Yardımcısı': 'Özel konu bilgisi eklenecek',
  'Yolcu Hizmetleri Müdürü': 'Özel konu bilgisi eklenecek',
  'Destek Hizmetleri Servis İkinci Müdürü': 'Özel konu bilgisi eklenecek',
};
let QUESTIONS: Question[] = SEED_QUESTIONS_399;

export default function App() {
  const { width: windowWidth } = useWindowDimensions();
  const compactHeader = windowWidth < 760;
  const isAdmin = !!user && ADMIN_EMAILS.includes(user.email.trim().toLowerCase());
  const [screen, setScreen] = useState<Screen>('home');
  const [infoRole, setInfoRole] = useState<Role>(ROLES[0].name);
  const [plan, setPlan] = useState<Plan>('free');
  const [user, setUser] = useState<LocalUser | null>(null);
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authCity, setAuthCity] = useState('');
  const [authCityOpen, setAuthCityOpen] = useState(false);
  const [authRole, setAuthRole] = useState<Role>(ROLES[0].name);
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('');
  const [authRemember, setAuthRemember] = useState(false);
  const [authAccepted, setAuthAccepted] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [emailVerificationPending, setEmailVerificationPending] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [role, setRole] = useState<Role>('Büro Şefi');
  const [studyRole, setStudyRole] = useState<Role>(ROLES[0].name);
  const [studyTopic, setStudyTopic] = useState(COMMON_TOPICS[0]);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [studyMode, setStudyMode] = useState<'topic' | 'quick' | 'mock' | 'mistakes'>('topic');
  const [questionCount, setQuestionCount] = useState(10);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(QUESTIONS);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [importName, setImportName] = useState('Henüz bir dosya seçilmedi');
  const [importCount, setImportCount] = useState(0);
  const [pendingQuestions, setPendingQuestions] = useState<ImportedQuestion[]>([]);
  const [adminRole, setAdminRole] = useState<Role>('Büro Şefi');
  const [adminTopic, setAdminTopic] = useState(COMMON_TOPICS[0]);
  const [published, setPublished] = useState(COMMON_QUESTION_COUNT);
  const [storedQuestions, setStoredQuestions] = useState<StoredQuestion[]>([]);
  const [freeMockUsed, setFreeMockUsed] = useState(false);
  const [freeTopicUsed, setFreeTopicUsed] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(75 * 60);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestion[]>([]);
  const [comments, setComments] = useState<{ id: string; author: string; text: string; date: string }[]>([]);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    loadQuestionPool().then(pool => { setStoredQuestions(pool); setPublished(COMMON_QUESTION_COUNT + pool.length); });
    AsyncStorage.getItem('terfi_free_mock_used').then(value => setFreeMockUsed(value === 'yes'));
    AsyncStorage.getItem('terfi_free_topic_used').then(value => setFreeTopicUsed(Number(value) || 0));
    AsyncStorage.getItem('terfi_remembered_email').then(email => { if (email) { setAuthEmail(email); setAuthRemember(true); } });
    AsyncStorage.getItem('terfi_attempts_v1').then(value => { if (value) setAttempts(JSON.parse(value) as Attempt[]); });
    AsyncStorage.getItem('terfi_wrongs_v1').then(value => { if (value) setWrongQuestions(JSON.parse(value) as WrongQuestion[]); });
    currentLocalUser().then(async saved => {
      if (!saved) return;
      setUser(saved);
      if (saved.id && saved.accessToken) {
        try { const profile = await remoteProfile(saved); setPlan(profile.plan); setFreeTopicUsed(profile.free_topic_used); setFreeMockUsed(profile.free_mock_used); } catch { /* Offline use keeps the last local session. */ }
      }
    });
  }, []);
  useEffect(() => {
    if (screen !== 'quiz' || studyMode !== 'mock') return;
    if (secondsLeft <= 0) { void recordAttempt(answers); Alert.alert('Süre doldu', '75 dakikalık deneme süresi tamamlandı. Sonuç analizin hazırlanıyor.'); setScreen('result'); return; }
    const timer = setInterval(() => setSecondsLeft(value => value - 1), 1000);
    return () => clearInterval(timer);
  }, [screen, secondsLeft]);
  useEffect(() => {
    if (authFeedback?.type === 'error') setAuthFeedback(null);
  }, [authName, authEmail, authPhone, authCity, authRole, authPassword, authPasswordConfirm, authAccepted]);
  const current = activeQuestions[index];
  const score = answers.filter((answer, i) => answer === activeQuestions[i].answer).length;
  const topics = useMemo(() => {
    const group: Record<string, { all: number; correct: number }> = {};
    activeQuestions.forEach((question, i) => { group[question.topic] ??= { all: 0, correct: 0 }; group[question.topic].all += 1; if (answers[i] === question.answer) group[question.topic].correct += 1; });
    return Object.entries(group);
  }, [answers, activeQuestions]);

  function openStudy(nextRole: Role) { if (!user) { setAuthRole(nextRole); Alert.alert('Ücretsiz üyelik oluştur', 'Sorulara başlamadan önce ücretsiz hesabını oluşturmalısın.'); setScreen('auth'); return; } setStudyRole(nextRole); setStudyTopic(COMMON_TOPICS[0]); setTopicsOpen(false); setStudyMode('topic'); setQuestionCount(10); setScreen('study'); }
  function toFourOptions(question: Question): Question {
    if (question.choices.length <= 4) return question;
    if (question.answer < 4) return { ...question, choices: question.choices.slice(0, 4) };
    return { ...question, choices: [...question.choices.slice(0, 3), question.choices[question.answer]], answer: 3 };
  }
  function questionPoolFor(nextRole: Role, nextTopic: string) {
    const common = COMMON_QUESTION_CATALOG[nextTopic as keyof typeof COMMON_QUESTION_CATALOG] ?? [];
    const uploaded = storedQuestions
      .filter(question => question.role === nextRole && question.topic === nextTopic)
      .map(question => ({ topic: question.topic, text: question.text, choices: question.choices, answer: question.correctAnswer, reference: question.reference ?? 'Yüklenen soru', explanation: 'Bu soru yönetici tarafından soru havuzuna eklenmiştir.' }));
    return [...common, ...uploaded].map(toFourOptions) as Question[];
  }
  function allQuestionPoolFor(nextRole: Role) {
    const common = Object.values(COMMON_QUESTION_CATALOG).flat() as Question[];
    const uploaded = storedQuestions
      .filter(question => question.role === nextRole)
      .map(question => ({ topic: question.topic, text: question.text, choices: question.choices, answer: question.correctAnswer, reference: question.reference ?? 'Yüklenen soru', explanation: 'Bu soru yönetici tarafından soru havuzuna eklenmiştir.' }));
    return [...common, ...uploaded].map(toFourOptions);
  }
  async function startQuiz(_ignored?: unknown) {
    const byTopic = questionPoolFor(studyRole, studyTopic);
    const pool = studyMode === 'topic' ? byTopic : allQuestionPoolFor(studyRole);
    if (!pool.length) { Alert.alert('Henüz soru yok', 'Bu konu için soru havuzu oluşturulmamış. Yönetici panelinden HTML soru dosyası yükleyebilirsin.'); return; }
    if (plan === 'free' && studyMode === 'mock' && freeMockUsed) { setScreen('membership'); Alert.alert('Deneme hakkın kullanıldı', 'Ücretsiz üyelikte bir adet, her konudan bir soruluk deneme hakkı bulunur.'); return; }
    const freeMockQuestions = Array.from(pool.reduce((selected, question) => selected.has(question.topic) ? selected : selected.set(question.topic, question), new Map<string, Question>()).values());
    if (plan === 'free' && studyMode === 'topic' && freeTopicUsed >= 10) { setScreen('membership'); Alert.alert('Ücretsiz soru hakkın kullanıldı', 'Ücretsiz üyelikte toplam 10 soru çözme hakkı bulunur.'); return; }
    const allowedCount = plan === 'free' && studyMode === 'topic' ? 10 - freeTopicUsed : studyMode === 'mock' && plan === 'premium' ? 50 : questionCount;
    const chosen = plan === 'free' && studyMode === 'mock' ? freeMockQuestions : pool.slice(0, Math.min(allowedCount, pool.length));
    if (plan === 'free' && studyMode === 'mock') { await AsyncStorage.setItem('terfi_free_mock_used', 'yes'); setFreeMockUsed(true); }
    if (plan === 'free' && studyMode === 'topic') { const nextUsed = freeTopicUsed + chosen.length; await AsyncStorage.setItem('terfi_free_topic_used', String(nextUsed)); setFreeTopicUsed(nextUsed); }
    if (studyMode === 'mock') { setSecondsLeft(75 * 60); Alert.alert('Deneme başladı', 'Süre: 75 dakika. Süre dolduğunda analiz ekranı otomatik açılır.'); }
    QUESTIONS = chosen; setRole(studyRole); setActiveQuestions(chosen); setIndex(0); setSelected(null); setChecked(false); setAnswers([]); setScreen('quiz');
  }
  async function recordAttempt(finalAnswers: number[]) {
    const correct = finalAnswers.filter((answer, questionIndex) => answer === activeQuestions[questionIndex]?.answer).length;
    const date = new Date().toLocaleString('tr-TR');
    const attempt: Attempt = { id: `${Date.now()}`, role, correct, total: activeQuestions.length, date };
    const nextAttempts = [attempt, ...attempts].slice(0, 20);
    const newlyWrong = activeQuestions
      .map((question, questionIndex) => ({ question, answer: finalAnswers[questionIndex] }))
      .filter(item => item.answer !== item.question.answer)
      .map(item => ({ ...item.question, id: `${Date.now()}-${item.question.text.slice(0, 12)}`, role, date }));
    const nextWrongs = [...newlyWrong, ...wrongQuestions].slice(0, 100);
    setAttempts(nextAttempts); setWrongQuestions(nextWrongs);
    await AsyncStorage.multiSet([['terfi_attempts_v1', JSON.stringify(nextAttempts)], ['terfi_wrongs_v1', JSON.stringify(nextWrongs)]]);
  }
  function checkOrNext() {
    if (selected === null) return Alert.alert('Cevap seçilmedi', 'Devam etmeden önce bir şık seçmelisin.');
    if (!checked) { setChecked(true); return; }
    const nextAnswers = [...answers, selected];
    setAnswers(nextAnswers);
    if (index === activeQuestions.length - 1) { void recordAttempt(nextAnswers); setScreen('result'); return; }
    setSelected(null); setChecked(false); setIndex(currentIndex => currentIndex + 1);
  }
  async function changePlan(nextPlan: Plan) { setPlan(nextPlan); await AsyncStorage.setItem('terfi_plan', nextPlan); Alert.alert(nextPlan === 'premium' ? 'Premium etkin' : 'Ücretsiz plan etkin', nextPlan === 'premium' ? 'Bu ilk sürümde Premium durumu cihazında kaydedildi.' : 'Toplam 10 soru ve bir adet, her konudan birer soruluk deneme aktif.'); }
  async function signInRemote() {
    if (!authEmail.includes('@') || authPassword.length < 6) { setAuthFeedback({ type: 'error', text: 'Geçerli e-posta ve en az 6 karakterlik şifre zorunludur.' }); return; }
    if (authMode === 'signup' && (!authName.trim() || !authCity.trim() || authPhone.replace(/\D/g, '').length < 10)) { setAuthFeedback({ type: 'error', text: 'Ad soyad, unvan, il ve en az 10 haneli telefon numarası zorunludur.' }); return; }
    if (authMode === 'signup' && authPassword !== authPasswordConfirm) { setAuthFeedback({ type: 'error', text: 'Şifreler eşleşmiyor. Lütfen iki alana da aynı şifreyi yaz.' }); return; }
    if (authMode === 'signup' && !authAccepted) { setAuthFeedback({ type: 'error', text: 'Devam etmek için üyelik bilgilerini saklama açıklamasını onaylamalısın.' }); return; }
    setAuthFeedback(null);
    try {
      const signedUser = authMode === 'signup'
        ? await createRemoteAccount({ name: authName.trim(), email: authEmail.trim().toLowerCase(), role: authRole, city: authCity.trim(), phone: authPhone.trim() }, authPassword)
        : await loginRemoteAccount(authEmail.trim().toLowerCase(), authPassword);
      await saveLocalUser(signedUser);
      if (authMode === 'login') { if (authRemember) await AsyncStorage.setItem('terfi_remembered_email', signedUser.email); else await AsyncStorage.removeItem('terfi_remembered_email'); }
      let profile = { plan: 'free' as Plan, free_topic_used: 0, free_mock_used: false };
      try { profile = await remoteProfile(signedUser); } catch { /* The profile trigger may need a moment; the signed-in user can still continue. */ }
      setUser(signedUser); setPlan(profile.plan); setFreeTopicUsed(profile.free_topic_used); setFreeMockUsed(profile.free_mock_used);
      setStudyRole((signedUser.role as Role) ?? authRole); setStudyTopic(COMMON_TOPICS[0]); setTopicsOpen(false); setStudyMode('topic'); setQuestionCount(10); setScreen('home');
      Alert.alert(authMode === 'signup' ? 'Ücretsiz üyeliğin oluşturuldu' : 'Giriş yapıldı', `${signedUser.name}, şimdi konunu seçip çalışmaya başlayabilirsin.`);
    } catch (error) {
      if (error instanceof EmailVerificationRequiredError) {
        setPendingVerificationEmail(authEmail.trim().toLowerCase());
        setEmailVerificationPending(true);
        setAuthFeedback(null);
        return;
      }
      setAuthFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Bağlantını kontrol edip tekrar dene.' });
    }
  }
  async function signIn() {
    if (!authName.trim() || !authEmail.includes('@') || !authCity.trim() || authPhone.replace(/\D/g, '').length < 10) return Alert.alert('Eksik bilgi', 'Ad soyad, unvan, il, geçerli e-posta ve telefon numarası zorunludur.');
    const signedUser = await saveLocalUser({ name: authName.trim(), email: authEmail.trim().toLowerCase(), role: authRole, city: authCity.trim(), phone: authPhone.trim() });
    setUser(signedUser); setPlan('free'); await AsyncStorage.setItem('terfi_plan', 'free'); setStudyRole(authRole); setStudyTopic(COMMON_TOPICS[0]); setTopicsOpen(false); setStudyMode('topic'); setQuestionCount(10); setScreen('study'); Alert.alert('Ücretsiz üyeliğin oluşturuldu', `${signedUser.name}, şimdi konunu seçip çalışmaya başlayabilirsin.`);
  }
  async function signOut() { await removeLocalUser(); await clearRemoteSession(); setUser(null); setPlan('free'); setScreen('home'); }
  async function inspectHtml() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['text/html', 'text/plain'] });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const source = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
    const imported = importQuestionsFromHtml(source);
    setImportName(asset.name); setImportCount(imported.length); setPendingQuestions(imported);
    if (!imported.length) Alert.alert('Uygun soru bulunamadı', 'Bu dosyada beklenen soru formatı bulunamadı veya soruların dört şıktan az seçeneği var.');
  }
  async function publishQuestions() {
    if (!pendingQuestions.length) return Alert.alert('Dosya bekleniyor', 'Önce bir HTML dosyası seçip incelemelisin.');
    const pool = await saveImportedQuestions({ questions: pendingQuestions, role: adminRole, topic: adminTopic });
    setStoredQuestions(pool); setPublished(COMMON_QUESTION_COUNT + pool.length); setPendingQuestions([]); setImportCount(0);
    Alert.alert('Sorular yayınlandı', `${pendingQuestions.length} soru ${adminRole} → ${adminTopic} havuzuna eklendi.`);
  }

  const timerLabel = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const Header = useMemo(() => <View style={{ backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingHorizontal: compactHeader ? 12 : 20, paddingVertical: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: compactHeader ? 10 : 26, flex: compactHeader ? undefined : 1 }}><Pressable onPress={() => setScreen('home')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}><Image source={TERFI_AMBLEM} style={{ width: 44, height: 44, resizeMode: 'contain' }} /><View><Text style={{ color: COLORS.navy, fontSize: 21, fontWeight: '900' }}>TERFİ <Text style={{ color: COLORS.red }}>ROTASI</Text></Text><Text style={{ color: COLORS.muted, fontSize: 10, marginTop: 2 }}>SINAV HAZIRLIK PLATFORMU</Text></View></Pressable><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: compactHeader ? 11 : 18, alignItems: 'center' }}><Pressable onPress={() => setScreen('home')}><Text style={{ color: screen === 'home' ? COLORS.blue : COLORS.ink, fontSize: compactHeader ? 13 : 15, fontWeight: '800' }}>Ana Sayfa</Text></Pressable><Pressable onPress={() => setScreen('exams')}><Text style={{ color: screen === 'exams' ? COLORS.blue : COLORS.ink, fontSize: compactHeader ? 13 : 15, fontWeight: '800' }}>Sınavlar</Text></Pressable><Pressable onPress={() => setScreen('membership')}><Text style={{ color: screen === 'membership' ? COLORS.blue : COLORS.ink, fontSize: compactHeader ? 13 : 15, fontWeight: '800' }}>Paketler</Text></Pressable></View></View><View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>{screen === 'quiz' && studyMode === 'mock' && <Text style={{ color: COLORS.red, fontWeight: '800' }}>{timerLabel}</Text>}{user ? <Pressable onPress={() => setScreen('auth')} style={{ backgroundColor: '#EAF5FA', borderRadius: 7, paddingHorizontal: 14, paddingVertical: 9 }}><Text style={{ color: COLORS.blue, fontSize: 13, fontWeight: '800' }}>Hesabım</Text></Pressable> : <><Pressable onPress={() => { setAuthMode('login'); setAuthFeedback(null); setScreen('auth'); }} style={{ borderWidth: 1, borderColor: COLORS.blue, borderRadius: 7, paddingHorizontal: 14, paddingVertical: 9 }}><Text style={{ color: COLORS.blue, fontSize: 13, fontWeight: '800' }}>Giriş Yap</Text></Pressable><Pressable onPress={() => { setAuthMode('signup'); setAuthFeedback(null); setScreen('auth'); }} style={{ backgroundColor: COLORS.blue, borderRadius: 7, paddingHorizontal: 14, paddingVertical: 9 }}><Text style={{ color: COLORS.white, fontSize: 13, fontWeight: '800' }}>Üye Ol</Text></Pressable></>}</View></View>, [screen, user, studyMode, timerLabel, compactHeader]);

  function Home() { const memberRole = (user?.role as Role) ?? ROLES[0].name; return <ScrollView contentContainerStyle={styles.page}><View style={{ backgroundColor: COLORS.navy, borderRadius: 12, padding: 26, gap: 10 }}><Text style={{ color: '#DFF3FC', fontWeight: '800', fontSize: 12 }}>TCDD TAŞIMACILIK A.Ş.</Text><Text style={{ color: COLORS.white, fontSize: 27, fontWeight: '900' }}>Görevde Yükselme Sınavı Hazırlık Platformu</Text><Text style={{ color: '#E7F4FA', lineHeight: 21 }}>Konu anlatımı, güncel soru bankası ve sınav analizi tek yerde.</Text><Pressable onPress={() => user ? openStudy(memberRole) : (() => { setAuthMode('signup'); setAuthFeedback(null); setScreen('auth'); })()} style={{ alignSelf: 'flex-start', backgroundColor: COLORS.blue, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 6, marginTop: 7 }}><Text style={{ color: COLORS.white, fontWeight: '900' }}>{user ? 'Sınava Başla' : 'Ücretsiz Üye Ol'}</Text></Pressable></View><View style={{ flexDirection: 'row', gap: 9 }}><View style={styles.stat}><Text style={styles.statValue}>9</Text><Text style={styles.small}>Unvan</Text></View><View style={styles.stat}><Text style={styles.statValue}>11</Text><Text style={styles.small}>Sınav konusu</Text></View><View style={styles.stat}><Text style={styles.statValue}>{published}+</Text><Text style={styles.small}>Mevcut soru</Text></View></View><CurrentExamCards /><Footer /></ScrollView>; }
  function CurrentExamCards() { const carouselRef = useRef<ScrollView>(null); const carouselOffset = useRef(0); const carouselPaused = useRef(false); useEffect(() => { const movement = setInterval(() => { if (carouselPaused.current) return; carouselOffset.current += 1; if (carouselOffset.current > (ROLES.length * 259) - 360) carouselOffset.current = 0; carouselRef.current?.scrollTo({ x: carouselOffset.current, animated: false }); }, 30); return () => clearInterval(movement); }, []); useEffect(() => { if (typeof document === 'undefined') return; const scrollNode = document.getElementById('roles-carousel'); if (!scrollNode) return; const pause = () => { carouselPaused.current = true; }; const resume = () => { carouselPaused.current = false; }; scrollNode.addEventListener('mouseenter', pause); scrollNode.addEventListener('mouseleave', resume); return () => { scrollNode.removeEventListener('mouseenter', pause); scrollNode.removeEventListener('mouseleave', resume); }; }, []); const showInfo = (selectedRole: Role) => { setInfoRole(selectedRole); setScreen('role-info'); }; return <View style={{ padding: 18, gap: 12, backgroundColor: COLORS.bg }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={styles.heading}>Güncel Sınavlar</Text><Text style={{ color: COLORS.muted, fontSize: 12 }}>Unvanları keşfet →</Text></View><ScrollView nativeID="roles-carousel" ref={carouselRef} horizontal showsHorizontalScrollIndicator={false}><View style={{ flexDirection: 'row', gap: 14 }}>{ROLES.map(item => <Pressable key={item.name} onPress={() => showInfo(item.name)} style={[styles.card, { width: 245, minHeight: 270, alignItems: 'center', justifyContent: 'space-between' }]}><Image source={require('./assets/tcdd-tasimacilik-logo.png')} style={{ width: 142, height: 142, resizeMode: 'contain' }} /><Text style={{ textAlign: 'center', color: COLORS.ink, fontWeight: '800' }}>{item.name}</Text><Text style={{ textAlign: 'center', color: COLORS.muted, fontSize: 12 }}>{item.special}</Text><View style={styles.primaryButton}><Text style={styles.primaryText}>Konuları İncele</Text></View></Pressable>)}</View></ScrollView></View>; }
  function RoleInfo() { const specialTopic = SPECIAL_TOPICS[infoRole]; const topics = [...COMMON_TOPICS, specialTopic]; return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={() => setScreen('exams')} style={[styles.outlineButton, { alignSelf: 'flex-start' }]}><Text style={styles.outlineText}>← Sınavlara dön</Text></Pressable><View style={styles.hero}><Text style={styles.heroTitle}>{infoRole}</Text><Text style={styles.heroText}>Bu unvan için sınav kapsamındaki konu başlıklarını aşağıda inceleyebilirsin.</Text></View><View style={styles.card}><Text style={styles.cardTitle}>Sorumlu olunan konular</Text><Text style={styles.cardText}>İlk 10 konu tüm unvanlarda ortaktır. Son konu bu unvana özeldir.</Text><View style={{ gap: 9, marginTop: 6 }}>{topics.map((topic, index) => <View key={topic} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderBottomWidth: index === topics.length - 1 ? 0 : 1, borderBottomColor: COLORS.line, paddingBottom: 9 }}><View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: index === topics.length - 1 ? '#FFF0F1' : '#E8F0F6', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: index === topics.length - 1 ? COLORS.red : COLORS.blue, fontWeight: '900', fontSize: 12 }}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={{ color: COLORS.ink, fontWeight: '700', lineHeight: 20 }}>{topic}</Text>{index === topics.length - 1 && <Text style={{ color: COLORS.red, fontSize: 12, marginTop: 3, fontWeight: '700' }}>Bu unvana özel konu</Text>}</View></View>)}</View></View><Pressable style={styles.primaryButton} onPress={() => user ? openStudy(infoRole) : (() => { setAuthMode('signup'); setScreen('auth'); })()}><Text style={styles.primaryText}>{user ? 'Bu unvan için çalışmaya başla' : 'Ücretsiz üyelikle çalışmaya başla'}</Text></Pressable></ScrollView>; }
  function Footer() { return <View style={{ backgroundColor: COLORS.navy, borderRadius: 12, padding: 20, gap: 18 }}><View style={{ gap: 5 }}><Text style={{ color: COLORS.white, fontSize: 20, fontWeight: '900' }}>TERFİ <Text style={{ color: '#FF8A8E' }}>ROTASI</Text></Text><Text style={{ color: '#C7D8E5', fontSize: 12, lineHeight: 18 }}>TCDD Taşımacılık görevde yükselme sınavlarına odaklanan dijital hazırlık platformu.</Text></View><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 22 }}><View style={{ gap: 7, minWidth: 120 }}><Text style={{ color: '#FFB0B3', fontWeight: '800', fontSize: 12 }}>HIZLI BAĞLANTILAR</Text><Pressable onPress={() => setScreen('exams')}><Text style={{ color: COLORS.white }}>Sınavlar</Text></Pressable><Pressable onPress={() => setScreen('membership')}><Text style={{ color: COLORS.white }}>Üyelik paketleri</Text></Pressable><Pressable onPress={() => setScreen('auth')}><Text style={{ color: COLORS.white }}>Hesabım</Text></Pressable></View><View style={{ gap: 7 }}><Text style={{ color: '#FFB0B3', fontWeight: '800', fontSize: 12 }}>DESTEK</Text><Text style={{ color: COLORS.white }}>Sıkça sorulan sorular</Text><Text style={{ color: COLORS.white }}>İletişim</Text><Text style={{ color: COLORS.white }}>Kullanım koşulları</Text></View></View><View style={{ height: 1, backgroundColor: '#FFFFFF2A' }} /><Text style={{ color: '#B8CBD9', fontSize: 11 }}>© 2026 Terfi Rotası · TCDD Taşımacılık A.Ş. için sınav hazırlık platformu</Text></View>; }
  function Exams() { return <ScrollView contentContainerStyle={styles.page}><View style={styles.hero}><Text style={styles.heroTitle}>Güncel Sınavlar</Text><Text style={styles.heroText}>Sınavını incele; üyelik oluşturarak soru çözmeye başla.</Text></View><CurrentExamCards /></ScrollView>; }
  function Quiz() { const correct = selected === current.answer; return <ScrollView contentContainerStyle={styles.page}><View style={styles.row}><Pressable style={styles.outlineButton} onPress={() => setScreen('home')}><Text style={styles.outlineText}>← Ana sayfa</Text></Pressable><Text style={styles.badge}>{role}</Text></View><View key={`question-${index}`} style={styles.card}><Text style={styles.small}>Soru {index + 1} / {QUESTIONS.length} · {current.topic}</Text><View style={styles.progressBg}><View style={[styles.progress, { width: `${((index + 1) / QUESTIONS.length) * 100}%` }]} /></View><Text style={styles.question}>{current.text}</Text>{current.choices.map((choice, choiceIndex) => <Pressable key={choice} disabled={checked} onPress={() => setSelected(choiceIndex)} style={[styles.choice, selected === choiceIndex && styles.selected, checked && choiceIndex === current.answer && styles.correct, checked && selected === choiceIndex && !correct && styles.wrong]}><Text style={styles.choiceText}>{String.fromCharCode(65 + choiceIndex)}) {choice}</Text></Pressable>)}{checked && <View style={[styles.answerCard, correct ? styles.answerCorrect : styles.answerWrong]}><Text style={[styles.feedback, correct ? styles.green : styles.red]}>{correct ? 'Doğru cevap!' : `Doğru cevap: ${String.fromCharCode(65 + current.answer)}) ${current.choices[current.answer]}`}</Text><Text style={styles.answerReference}>Dayanak: {current.reference}</Text><Text style={styles.answerExplanation}>{current.explanation}</Text></View>}<Pressable style={styles.primaryButton} onPress={checkOrNext}><Text style={styles.primaryText}>{checked ? index === QUESTIONS.length - 1 ? 'Analizi gör' : 'Sonraki soru' : 'Cevabı kontrol et'}</Text></Pressable></View></ScrollView>; }
  function Result() { const percent = Math.round((score / QUESTIONS.length) * 100); const weak = [...topics].sort((a, b) => a[1].correct / a[1].all - b[1].correct / b[1].all)[0]?.[0]; return <ScrollView contentContainerStyle={styles.page}><View style={styles.hero}><Text style={styles.heroTitle}>Sınav analizin hazır.</Text><Text style={styles.heroText}>Güçlü ve tekrar etmen gereken konuları aşağıda görebilirsin.</Text></View><View style={styles.stats}><Stat value={`%${percent}`} label="Başarı oranı" /><Stat value={String(score)} label="Doğru cevap" /><Stat value={String(QUESTIONS.length - score)} label="Yanlış cevap" /></View><View style={styles.card}><Text style={styles.cardTitle}>Konu bazlı başarı</Text>{topics.map(([topic, value]) => { const pct = Math.round((value.correct / value.all) * 100); return <View key={topic} style={styles.topicRow}><Text style={styles.topicName}>{topic}</Text><View style={styles.topicBarBg}><View style={[styles.topicBar, { width: `${pct}%` }]} /></View><Text style={styles.topicPercent}>%{pct}</Text></View>; })}</View><View style={styles.card}><Text style={styles.cardTitle}>Tekrar önerisi</Text><Text style={styles.cardText}><Text style={styles.bold}>{weak}</Text> konusunda tekrar yapmanı öneriyoruz. Premium üyelikte yanlışların ayrıca kaydedilir.</Text></View><Pressable style={styles.primaryButton} onPress={() => startQuiz(role)}><Text style={styles.primaryText}>Tekrar çöz</Text></Pressable></ScrollView>; }
  function Membership() { const freeItems = ['Toplam 10 soru çözme hakkı', '11 soruluk 1 genel deneme', 'Sınırlı sınav analizi', 'Yorum yazabilme', 'Ders notlarına erişim']; const premiumItems = ['Sınırsız konu testi ve soru çözümü', '50 soruluk genel denemeler', 'Sınırsız ayrıntılı analiz', 'Yorum yazabilme ve ders notları', 'Özel mesaj ve deneme oluşturma', 'İnteraktif içerikler ve infografikler']; const sendComment = () => { if (!user) { setAuthMode('signup'); setScreen('auth'); Alert.alert('Üyelik gerekli', 'Yorum yazmak için ücretsiz üyelik oluşturmalısın.'); return; } if (!commentText.trim()) return; setComments(items => [{ id: String(Date.now()), author: user.name, text: commentText.trim(), date: new Date().toLocaleDateString('tr-TR') }, ...items]); setCommentText(''); }; return <ScrollView contentContainerStyle={styles.page}><View style={styles.hero}><Text style={styles.heroTitle}>Sana uygun paketi seç</Text><Text style={styles.heroText}>Ücretsiz başla; ihtiyacın olduğunda Premium ile sınırsız çalış.</Text></View><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 0, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, overflow: 'hidden' }}><View style={{ flex: 1, minWidth: compactHeader ? 0 : 300, padding: compactHeader ? 18 : 30, gap: 18 }}><Text style={{ color: COLORS.blue, fontSize: 28, fontWeight: '900', textAlign: 'center' }}>ÜCRETSİZ</Text><View style={{ gap: 14 }}>{freeItems.map(item => <View key={item} style={{ flexDirection: 'row', gap: 10 }}><Text style={{ color: COLORS.blue, fontWeight: '900' }}>✓</Text><Text style={{ color: COLORS.ink }}>{item}</Text></View>)}</View><Pressable style={[styles.primaryButton, { marginTop: 20 }]} onPress={() => user ? setScreen('home') : (() => { setAuthMode('signup'); setScreen('auth'); })()}><Text style={styles.primaryText}>ÜCRETSİZ BAŞLA</Text></Pressable></View><View style={{ width: 1, backgroundColor: COLORS.blue }} /><View style={{ flex: 1, minWidth: compactHeader ? 0 : 300, padding: compactHeader ? 18 : 30, gap: 18, backgroundColor: '#FBFDFF' }}><View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', gap: 7 }}><Text style={{ color: COLORS.blue, fontSize: 34, fontWeight: '900' }}>500₺</Text><Text style={{ color: COLORS.blue, fontSize: 17 }}>/ Yıllık</Text></View><Text style={{ color: COLORS.muted, textAlign: 'center', fontWeight: '800' }}>PREMİUM</Text><View style={{ gap: 14 }}>{premiumItems.map(item => <View key={item} style={{ flexDirection: 'row', gap: 10 }}><Text style={{ color: COLORS.blue, fontWeight: '900' }}>✓</Text><Text style={{ color: COLORS.ink }}>{item}</Text></View>)}</View><Pressable style={[styles.primaryButton, { marginTop: 20 }]} onPress={() => Alert.alert('Premium yakında', '500 TL yıllık Premium için güvenli ödeme adımını bir sonraki aşamada ekleyeceğiz.')}><Text style={styles.primaryText}>SATIN AL</Text></Pressable></View></View><View style={[styles.card, { gap: 13 }]}><Text style={styles.cardTitle}>Yorumlar</Text><Text style={styles.cardText}>Çalışma deneyimini diğer adaylarla paylaşabilirsin.</Text><TextInput value={commentText} onChangeText={setCommentText} placeholder={user ? 'Yorumunu yaz...' : 'Yorum yazmak için üye ol'} multiline style={[styles.input, { minHeight: 76, textAlignVertical: 'top' }]} /><Pressable style={[styles.primaryButton, { alignSelf: 'flex-start', paddingHorizontal: 22 }]} onPress={sendComment}><Text style={styles.primaryText}>YORUM YAYINLA</Text></Pressable>{comments.length ? comments.map(comment => <View key={comment.id} style={{ borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 12, gap: 4 }}><Text style={{ color: COLORS.ink, fontWeight: '800' }}>{comment.author} <Text style={{ color: COLORS.muted, fontWeight: '500', fontSize: 12 }}>· {comment.date}</Text></Text><Text style={styles.cardText}>{comment.text}</Text></View>) : <Text style={{ color: COLORS.muted, fontSize: 13 }}>Henüz yorum yok. İlk yorumu sen yazabilirsin.</Text>}</View></ScrollView>; }
  function StudySetup() {
    const availableTopics = [...COMMON_TOPICS, SPECIAL_TOPICS[studyRole]];
    const availableCount = questionPoolFor(studyRole, studyTopic).length;
    const modes: { id: typeof studyMode; title: string; text: string; premium?: boolean }[] = [
      { id: 'topic', title: 'Konu testi', text: 'Seçtiğin konudan odaklı çalışma.' },
      { id: 'mock', title: 'Genel deneme', text: 'Sınav düzeninde karışık sorular.' },
    ];
    return <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.hero}><Text style={styles.heroTitle}>Çalışmanı hazırla.</Text><Text style={styles.heroText}>Seçimlerini yap, sonra sınava odaklan.</Text></View>
      <View style={styles.card}><Text style={styles.setupLabel}>SEÇİLEN UNVAN</Text><Text style={styles.cardTitle}>{studyRole}</Text><Pressable onPress={() => setScreen('home')}><Text style={styles.outlineText}>Unvanı değiştir</Text></Pressable></View>
      <View style={styles.card}><Text style={styles.setupLabel}>2 · KONU</Text><Text style={styles.cardText}>{studyTopic}</Text><Pressable style={styles.outlineButton} onPress={() => setTopicsOpen(value => !value)}><Text style={styles.outlineText}>{topicsOpen ? 'Konu listesini kapat' : 'Konuyu değiştir'}</Text></Pressable>{topicsOpen && <View style={styles.chipWrap}>{availableTopics.map(topic => <Pressable key={topic} onPress={() => { setStudyTopic(topic); setTopicsOpen(false); }} style={[styles.chip, studyTopic === topic && styles.chipActive]}><Text style={[styles.chipText, studyTopic === topic && styles.chipTextActive]}>{topic}</Text></Pressable>)}</View>}</View>
      <View style={styles.card}><Text style={styles.setupLabel}>3 · SINAV AYARLARI</Text><View style={styles.optionGrid}>{modes.map(mode => <Pressable key={mode.id} onPress={() => setStudyMode(mode.id)} style={[styles.optionCard, studyMode === mode.id && styles.optionCardActive]}><Text style={styles.optionTitle}>{mode.title}</Text><Text style={styles.optionText}>{mode.text}</Text></Pressable>)}</View>{plan === 'premium' ? <View style={styles.countRow}>{[10, 20, 50].map(count => <Pressable key={count} onPress={() => setQuestionCount(count)} style={[styles.countButton, questionCount === count && styles.countButtonActive]}><Text style={[styles.countText, questionCount === count && styles.countTextActive]}>{count}</Text></Pressable>)}</View> : <Text style={styles.helperText}>Ücretsiz üyelikte toplam {Math.max(0, 10 - freeTopicUsed)} soru hakkın kaldı; deneme ise her konudan birer soru içerir.</Text>}</View>
      <View style={styles.readyCard}><Text style={styles.readyTitle}>Hazır olduğunda sınav başlar</Text><Text style={styles.readyText}>{studyRole} · {studyTopic}</Text><Text style={styles.readyText}>{availableCount} soru hazır · {plan === 'free' && studyMode === 'topic' ? `Ücretsiz kalan hak: ${Math.max(0, 10 - freeTopicUsed)} soru` : studyMode === 'mock' && plan === 'free' ? freeMockUsed ? 'Ücretsiz deneme hakkın kullanıldı.' : 'Ücretsiz deneme: 11 konudan birer soru' : studyMode === 'mock' ? 'Premium deneme: 50 soru' : `${questionCount} soru seçildi`}</Text><Text style={styles.readyText}>Süre: 75 dakika</Text><Pressable style={styles.primaryButton} onPress={startQuiz}><Text style={styles.primaryText}>Sınavı başlat</Text></Pressable></View>
    </ScrollView>;
  }
  function Progress() {
    const latest = attempts[0];
    return <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.hero}><Text style={styles.heroTitle}>İlerlemen</Text><Text style={styles.heroText}>Denemelerin ve tekrar etmen gereken sorular burada saklanır.</Text></View>
      <View style={styles.stats}><Stat value={String(attempts.length)} label="Çözülen deneme" /><Stat value={String(wrongQuestions.length)} label="Kaydedilen yanlış" /><Stat value={latest ? `%${Math.round((latest.correct / latest.total) * 100)}` : '—'} label="Son başarı" /></View>
      <View style={styles.card}><Text style={styles.cardTitle}>Son denemeler</Text>{attempts.length ? attempts.slice(0, 5).map(item => <View key={item.id} style={styles.topicRow}><Text style={styles.topicName}>{item.role} · {item.correct}/{item.total} doğru</Text><Text style={styles.small}>{item.date}</Text></View>) : <Text style={styles.cardText}>Henüz çözülen deneme yok.</Text>}</View>
      <View style={styles.card}><Text style={styles.cardTitle}>Yanlışlarım</Text>{wrongQuestions.length ? wrongQuestions.slice(0, 10).map(item => <View key={item.id} style={styles.topicRow}><Text style={styles.topicName}>{item.topic}</Text><Text style={styles.cardText}>{item.text}</Text><Text style={styles.small}>Doğru cevap: {String.fromCharCode(65 + item.answer)} · {item.reference}</Text></View>) : <Text style={styles.cardText}>Yanlış yaptığın sorular burada görünecek.</Text>}</View>
    </ScrollView>;
  }
  function Auth() {
    if (emailVerificationPending) return <ScrollView contentContainerStyle={styles.page}><View style={styles.hero}><Text style={styles.heroTitle}>E-posta onayı bekleniyor</Text><Text style={styles.heroText}>Üyelik talebin oluşturuldu. Hesabını etkinleştirmek için e-postandaki doğrulama bağlantısına tıkla.</Text></View><View style={styles.card}><Text style={styles.cardTitle}>Son bir adım kaldı</Text><Text style={styles.cardText}><Text style={styles.bold}>{pendingVerificationEmail}</Text> adresine doğrulama e-postası gönderildi.</Text><View style={{ backgroundColor: '#EAF5FA', borderLeftWidth: 4, borderLeftColor: COLORS.blue, padding: 12, borderRadius: 8, gap: 5 }}><Text style={{ color: COLORS.ink, fontWeight: '800' }}>E-posta görünmüyorsa</Text><Text style={styles.cardText}>Gereksiz / Spam klasörünü kontrol et. Birkaç dakika bekledikten sonra “Tekrar gönder” düğmesini kullan.</Text></View>{authFeedback && <Text style={{ color: authFeedback.type === 'success' ? COLORS.green : COLORS.red, fontWeight: '700' }}>{authFeedback.text}</Text>}<Pressable style={styles.primaryButton} onPress={async () => { try { await resendVerificationEmail(pendingVerificationEmail); setAuthFeedback({ type: 'success', text: 'Doğrulama e-postası tekrar gönderildi.' }); } catch (error) { setAuthFeedback({ type: 'error', text: error instanceof Error ? error.message : 'E-posta tekrar gönderilemedi.' }); } }}><Text style={styles.primaryText}>E-postayı tekrar gönder</Text></Pressable><Pressable style={styles.outlineButton} onPress={() => { setEmailVerificationPending(false); setAuthMode('login'); setAuthFeedback(null); }}><Text style={styles.outlineText}>E-postayı onayladım, giriş yap</Text></Pressable><Pressable onPress={() => { setEmailVerificationPending(false); setAuthMode('signup'); setAuthFeedback(null); }}><Text style={[styles.outlineText, { textAlign: 'center' }]}>Farklı e-posta ile kayıt ol</Text></Pressable></View></ScrollView>;
    if (user) { const initials = user.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase(); return <ScrollView contentContainerStyle={styles.page}><Text style={styles.heading}>Üyelik Bilgilerim</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}><View style={[styles.card, { width: compactHeader ? '100%' : '31%', minWidth: compactHeader ? 0 : 250, alignItems: 'center' }]}><View style={{ width: 86, height: 86, borderRadius: 43, backgroundColor: '#E8F0F6', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: COLORS.blue, fontSize: 28, fontWeight: '900' }}>{initials}</Text></View><Text style={styles.cardTitle}>{user.name}</Text><Text style={styles.cardText}>{user.phone ?? 'Telefon bilgisi yok'}</Text><Text style={styles.cardText}>{user.email}</Text><Pressable style={styles.primaryButton} onPress={() => openStudy((user.role as Role) ?? ROLES[0].name)}><Text style={styles.primaryText}>Sınav Ekranı</Text></Pressable>{isAdmin && <Pressable style={styles.outlineButton} onPress={() => setScreen('admin')}><Text style={styles.outlineText}>Yönetici Paneli</Text></Pressable>}<Pressable style={styles.outlineButton} onPress={() => setScreen('progress')}><Text style={styles.outlineText}>İstatistiklerim</Text></Pressable><Pressable onPress={signOut}><Text style={{ color: COLORS.red, fontWeight: '800' }}>Çıkış Yap</Text></Pressable></View><View style={[styles.card, { flex: 1, minWidth: compactHeader ? 0 : 300 }]}><Text style={[styles.cardTitle, { textAlign: 'center', marginBottom: 10 }]}>Profil Bilgilerim</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{[['Ad Soyad', user.name], ['Telefon', user.phone ?? '—'], ['E-posta', user.email], ['İl', user.city ?? '—'], ['Unvan', user.role ?? '—'], ['Üyelik Türü', plan === 'premium' ? 'Premium Üyelik' : 'Ücretsiz Üyelik'], ['Çözülen Deneme', String(attempts.length)], ['Kaydedilen Yanlış', String(wrongQuestions.length)]].map(([label, value]) => <View key={label} style={{ width: compactHeader ? '100%' : '47%', minWidth: 0, borderWidth: 1, borderColor: COLORS.line, borderRadius: 9, padding: 13, gap: 5 }}><Text style={{ color: COLORS.blue, fontWeight: '800', fontSize: 12 }}>{label}</Text><Text style={{ color: COLORS.ink }}>{value}</Text></View>)}</View></View></View></ScrollView>; }
    const register = authMode === 'signup';
    return <ScrollView contentContainerStyle={styles.page}><View style={{ flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, overflow: 'hidden', backgroundColor: COLORS.white, shadowColor: '#15354B', shadowOpacity: 0.06, shadowRadius: 18, elevation: 2 }}><View style={{ flex: 1, minWidth: compactHeader ? 0 : 340, padding: compactHeader ? 14 : 22, gap: 14 }}>
      <View style={styles.hero}><Text style={styles.heroTitle}>{register ? 'Kayıt Oluştur' : 'Giriş Yap'}</Text><Text style={styles.heroText}>{register ? 'Terfi Rotası’ndan ücretsiz yararlanmak için bilgilerini gir.' : 'E-posta adresin ve şifrenle devam et.'}</Text></View>
      <View style={styles.card}>
        {register && <><Text style={styles.inputLabel}>Ad Soyad</Text><TextInput value={authName} onChangeText={setAuthName} placeholder="Adın ve soyadın" style={styles.input} autoCapitalize="words" /><Text style={styles.inputLabel}>Telefon</Text><TextInput value={authPhone} onChangeText={setAuthPhone} placeholder="05XX XXX XX XX" style={styles.input} keyboardType="phone-pad" /></>}
        <Text style={styles.inputLabel}>E-posta adresin</Text><TextInput value={authEmail} onChangeText={setAuthEmail} placeholder="ornek@email.com" style={styles.input} autoCapitalize="none" keyboardType="email-address" />
        <Text style={styles.inputLabel}>Şifre</Text><TextInput value={authPassword} onChangeText={setAuthPassword} placeholder="En az 6 karakter" style={styles.input} secureTextEntry autoCapitalize="none" />
        {!register && <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}><Pressable onPress={() => setAuthRemember(value => !value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: authRemember ? COLORS.blue : COLORS.line, backgroundColor: authRemember ? COLORS.blue : COLORS.white, alignItems: 'center', justifyContent: 'center' }}>{authRemember && <Text style={{ color: COLORS.white, fontWeight: '900' }}>✓</Text>}</View><Text style={{ color: COLORS.muted, fontSize: 13 }}>Beni Hatırla</Text></Pressable><Pressable onPress={async () => { if (!authEmail.includes('@')) { setAuthFeedback({ type: 'error', text: 'Önce e-posta adresini yazmalısın.' }); return; } try { await sendPasswordResetEmail(authEmail.trim().toLowerCase()); setAuthFeedback({ type: 'success', text: 'Şifre sıfırlama bağlantısı e-posta adresine gönderildi.' }); } catch (error) { setAuthFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Şifre sıfırlama bağlantısı gönderilemedi.' }); } }}><Text style={{ color: COLORS.blue, fontWeight: '800', fontSize: 13 }}>Şifremi Unuttum</Text></Pressable></View>}
        {register && <><Text style={styles.inputLabel}>Şifre Tekrar</Text><TextInput value={authPasswordConfirm} onChangeText={setAuthPasswordConfirm} placeholder="Şifreni yeniden yaz" style={styles.input} secureTextEntry autoCapitalize="none" /><Text style={styles.inputLabel}>Kurumunuz</Text><View style={[styles.input, { justifyContent: 'center', backgroundColor: '#F7FAFC' }]}><Text style={styles.cardText}>TCDD Taşımacılık A.Ş.</Text></View><Text style={styles.inputLabel}>Unvanın</Text><View style={styles.chipWrap}>{ROLES.map(item => <Pressable key={item.name} onPress={() => setAuthRole(item.name)} style={[styles.chip, authRole === item.name && styles.chipActive]}><Text style={[styles.chipText, authRole === item.name && styles.chipTextActive]}>{item.name}</Text></Pressable>)}</View><Text style={styles.inputLabel}>İlin</Text><Pressable onPress={() => setAuthCityOpen(value => !value)} style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}><Text style={{ color: authCity ? COLORS.ink : COLORS.muted }}>{authCity || 'İl seç'}</Text><Text style={{ color: COLORS.blue, fontSize: 16, fontWeight: '900' }}>{authCityOpen ? '⌃' : '⌄'}</Text></Pressable>{authCityOpen && <View style={{ maxHeight: 300, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, backgroundColor: COLORS.white, overflow: 'hidden' }}><ScrollView nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={{ paddingVertical: 4 }}><View style={{ paddingHorizontal: 15, paddingVertical: 10, backgroundColor: COLORS.blue }}><Text style={{ color: COLORS.white, fontWeight: '800' }}>Bir İl Seçin</Text></View>{CITIES.map(city => <Pressable key={city} onPress={() => { setAuthCity(city); setAuthCityOpen(false); }} style={{ borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingHorizontal: 15, paddingVertical: 11, backgroundColor: authCity === city ? '#EAF5FA' : COLORS.white }}><Text style={{ color: authCity === city ? COLORS.blue : COLORS.ink, fontSize: 14, fontWeight: authCity === city ? '800' : '500' }}>{city}</Text></Pressable>)}</ScrollView></View>}<Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 4 }} onPress={() => setAuthAccepted(value => !value)}><View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: authAccepted ? COLORS.blue : COLORS.line, backgroundColor: authAccepted ? COLORS.blue : COLORS.white, alignItems: 'center', justifyContent: 'center' }}>{authAccepted && <Text style={{ color: COLORS.white, fontWeight: '800' }}>✓</Text>}</View><Text style={{ flex: 1, color: COLORS.muted, fontSize: 12, lineHeight: 17 }}>Bilgilerimin üyelik hesabım için saklanmasını kabul ediyorum.</Text></Pressable></>}
        <Text style={styles.cardText}>Ücretsiz üyelik: toplam 10 soru ve 1 deneme hakkı.</Text>
        {authFeedback && <View style={{ backgroundColor: authFeedback.type === 'success' ? '#EAF7EF' : '#FFF0F1', borderLeftWidth: 4, borderLeftColor: authFeedback.type === 'success' ? COLORS.green : COLORS.red, borderRadius: 7, padding: 11 }}><Text style={{ color: authFeedback.type === 'success' ? COLORS.green : '#B4232C', fontWeight: '700', lineHeight: 19 }}>{authFeedback.text}</Text></View>}
        <Pressable style={styles.primaryButton} onPress={signInRemote}><Text style={styles.primaryText}>{register ? 'Kayıt Oluştur' : 'Giriş Yap'}</Text></Pressable>
        <Pressable onPress={() => { setAuthMode(register ? 'login' : 'signup'); setAuthFeedback(null); }}><Text style={[styles.outlineText, { textAlign: 'center' }]}>{register ? 'Zaten üye misin? Giriş yap' : 'Hesabın yok mu? Kayıt oluştur'}</Text></Pressable>
      </View>
      </View>
      <View style={{ flex: 1, minWidth: compactHeader ? 0 : 330, minHeight: compactHeader ? 340 : 640, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', padding: compactHeader ? 16 : 28, gap: 18 }}><Image source={REGISTER_ILLUSTRATION} style={{ width: '100%', height: compactHeader ? 240 : 470, resizeMode: 'contain' }} /><View style={{ alignItems: 'center', gap: 5 }}><Text style={{ color: COLORS.white, fontWeight: '900', fontSize: 22 }}>Hedefine bir adım daha yaklaş</Text><Text style={{ color: '#DDEFFC', textAlign: 'center', fontSize: 14 }}>Konu çalış, denemeni çöz ve gelişimini takip et.</Text></View></View>
      </View>
    </ScrollView>;
  }
  function Admin() {
    const adminTopics = [...COMMON_TOPICS, SPECIAL_TOPICS[adminRole]];
    return <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.hero}><Text style={styles.heroTitle}>Yönetici paneli</Text><Text style={styles.heroText}>HTML soru dosyanı seç, unvan ve konusunu belirle, ardından havuza yayınla.</Text></View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Unvanı seç</Text>
        <View style={styles.chipWrap}>{ROLES.map(item => <Pressable key={item.name} onPress={() => { setAdminRole(item.name); setAdminTopic(COMMON_TOPICS[0]); }} style={[styles.chip, adminRole === item.name && styles.chipActive]}><Text style={[styles.chipText, adminRole === item.name && styles.chipTextActive]}>{item.name}</Text></Pressable>)}</View>
        <Text style={styles.cardTitle}>2. Konuyu seç</Text>
        <View style={styles.chipWrap}>{adminTopics.map(topic => <Pressable key={topic} onPress={() => setAdminTopic(topic)} style={[styles.chip, adminTopic === topic && styles.chipActive]}><Text style={[styles.chipText, adminTopic === topic && styles.chipTextActive]}>{topic}</Text></Pressable>)}</View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>3. HTML soru dosyası</Text><Text style={styles.cardText}>{importName}</Text>
        <Pressable style={styles.primaryButton} onPress={inspectHtml}><Text style={styles.primaryText}>Dosyayı seç ve incele</Text></Pressable>
        {importCount > 0 && <Text style={styles.importInfo}>{importCount} soru bulundu. Dosya {adminRole} → {adminTopic} için yayınlanmaya hazır.</Text>}
        <Pressable style={styles.outlineButton} onPress={publishQuestions}><Text style={styles.outlineText}>Soruları yayınla</Text></Pressable>
      </View>
      <View style={styles.card}><Text style={styles.cardTitle}>Yayınlanan soru havuzu</Text><Text style={styles.cardText}>Toplam {published} soru cihazda kalıcı olarak saklanıyor.</Text></View>
    </ScrollView>;
  }
  return <SafeAreaView style={styles.safe}><StatusBar style="light" />{Header}{screen === 'home' && Home()}{screen === 'exams' && Exams()}{screen === 'role-info' && RoleInfo()}{screen === 'study' && StudySetup()}{screen === 'quiz' && Quiz()}{screen === 'result' && Result()}{screen === 'membership' && Membership()}{screen === 'progress' && Progress()}{screen === 'admin' && isAdmin && Admin()}{screen === 'auth' && Auth()}</SafeAreaView>;
}

function Stat({ value, label }: { value: string; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.small}>{label}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg }, header: { backgroundColor: COLORS.navy, borderBottomWidth: 4, borderBottomColor: COLORS.red, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 }, brand: { color: COLORS.white, fontSize: 20, fontWeight: '800' }, brandRed: { color: '#FF6267' }, subtitle: { color: '#D9E7F1', fontSize: 11, marginTop: 2 }, planPill: { borderWidth: 1, borderColor: '#FFFFFF66', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 }, planPillText: { color: COLORS.white, fontSize: 12, fontWeight: '700' }, premiumPill: { backgroundColor: '#FFF3D2', borderColor: '#FFF3D2' }, premiumPillText: { color: '#805100' }, userPill: { borderWidth: 1, borderColor: '#FFFFFF66', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 100 }, userPillText: { color: COLORS.white, fontSize: 12, fontWeight: '700' }, nav: { flexDirection: 'row', gap: 8, padding: 10, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.line }, navButton: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 7 }, navActive: { backgroundColor: '#E8F0F6' }, navText: { color: COLORS.muted, fontWeight: '700', fontSize: 12 }, navTextActive: { color: COLORS.blue }, page: { padding: 18, gap: 14 }, hero: { padding: 22, backgroundColor: COLORS.blue, borderLeftWidth: 5, borderLeftColor: COLORS.red, borderRadius: 12 }, heroTitle: { color: COLORS.white, fontSize: 24, fontWeight: '800', marginBottom: 5 }, heroText: { color: '#E3EFF6' }, heading: { color: COLORS.ink, fontSize: 19, fontWeight: '800', marginTop: 8 }, roleGrid: { gap: 12 }, card: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, padding: 16, gap: 10 }, premiumCard: { borderColor: '#E3C17B' }, cardTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '800' }, cardText: { color: COLORS.muted }, primaryButton: { backgroundColor: COLORS.blue, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center' }, primaryText: { color: COLORS.white, fontWeight: '800' }, outlineButton: { borderWidth: 1, borderColor: COLORS.blue, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 13, alignItems: 'center' }, outlineText: { color: COLORS.blue, fontWeight: '800' }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, badge: { backgroundColor: '#E7F0F6', color: COLORS.blue, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, fontSize: 12, fontWeight: '800', overflow: 'hidden' }, small: { color: COLORS.muted, fontSize: 12 }, inputLabel: { color: COLORS.ink, fontWeight: '700', marginTop: 4 }, input: { borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.ink }, progressBg: { height: 8, backgroundColor: '#E6EDF3', borderRadius: 99, overflow: 'hidden' }, progress: { height: '100%', backgroundColor: COLORS.red }, question: { fontSize: 19, fontWeight: '800', color: COLORS.ink, marginVertical: 8 }, choice: { borderWidth: 1, borderColor: COLORS.line, padding: 13, borderRadius: 9 }, choiceText: { color: COLORS.ink, fontWeight: '600' }, selected: { borderWidth: 2, borderColor: COLORS.blue, backgroundColor: '#EDF6FB' }, correct: { borderWidth: 2, borderColor: COLORS.green, backgroundColor: '#EAF7EF' }, wrong: { borderWidth: 2, borderColor: COLORS.red, backgroundColor: '#FFF0F1' }, feedback: { fontWeight: '800' }, green: { color: COLORS.green }, red: { color: '#B4232C' }, answerCard: { borderLeftWidth: 4, borderRadius: 8, padding: 12, gap: 5 }, answerCorrect: { backgroundColor: '#EAF7EF', borderLeftColor: COLORS.green }, answerWrong: { backgroundColor: '#FFF0F1', borderLeftColor: COLORS.red }, answerReference: { color: COLORS.ink, fontWeight: '800', fontSize: 12 }, answerExplanation: { color: COLORS.ink, fontSize: 13, lineHeight: 19 }, stats: { flexDirection: 'row', gap: 10 }, stat: { flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, padding: 13, borderRadius: 10 }, statValue: { color: COLORS.blue, fontSize: 25, fontWeight: '800' }, topicRow: { marginTop: 12, gap: 6 }, topicName: { color: COLORS.ink, fontWeight: '700', fontSize: 13 }, topicBarBg: { height: 9, backgroundColor: '#E6EDF3', borderRadius: 99, overflow: 'hidden' }, topicBar: { height: '100%', backgroundColor: COLORS.blue }, topicPercent: { color: COLORS.muted, fontWeight: '700', fontSize: 12 }, bold: { fontWeight: '800', color: COLORS.ink }, importInfo: { color: COLORS.green, fontWeight: '700' }, chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 }, chipActive: { backgroundColor: COLORS.blue, borderColor: COLORS.blue }, chipText: { color: COLORS.ink, fontSize: 12, fontWeight: '700' }, chipTextActive: { color: COLORS.white }, setupLabel: { color: COLORS.blue, fontSize: 12, fontWeight: '800', letterSpacing: .4 }, optionGrid: { gap: 9 }, optionCard: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, padding: 12, backgroundColor: COLORS.white }, optionCardActive: { borderColor: COLORS.blue, borderWidth: 2, backgroundColor: '#EDF6FB' }, optionLocked: { opacity: .65 }, optionTitle: { color: COLORS.ink, fontWeight: '800' }, optionText: { color: COLORS.muted, fontSize: 12, marginTop: 3 }, countRow: { flexDirection: 'row', gap: 9 }, countButton: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 9, paddingVertical: 12 }, countButtonActive: { borderColor: COLORS.blue, backgroundColor: COLORS.blue }, countText: { color: COLORS.ink, fontWeight: '800' }, countTextActive: { color: COLORS.white }, helperText: { color: COLORS.muted, fontSize: 12, lineHeight: 17 }, readyCard: { backgroundColor: '#E8F0F6', borderRadius: 12, padding: 16, gap: 8, borderWidth: 1, borderColor: '#B9CEDF' }, readyTitle: { color: COLORS.blue, fontSize: 16, fontWeight: '800' }, readyText: { color: COLORS.muted, fontSize: 12 }
});

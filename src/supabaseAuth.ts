import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocalUser } from './localAuth';

const SUPABASE_URL = 'https://hkfjjyltkfoiqujvelug.supabase.co';
const PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZmpqeWx0a2ZvaXF1anZlbHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NjQ2MDIsImV4cCI6MjEwMTQ0MDYwMn0.JI04LXbh5Lt4RACcFfEmB7FxsOe1Gr4xVXNBZ5f8En0';
const SESSION_KEY = 'terfi_supabase_session_v1';

type AuthPayload = { access_token?: string; user?: { id: string; email?: string; user_metadata?: Record<string, string> }; message?: string };
export type ProfilePayload = { plan: 'free' | 'premium'; free_topic_used: number; free_mock_used: boolean };

export class EmailVerificationRequiredError extends Error {
  constructor() {
    super('Üyeliğin oluşturuldu. Devam etmek için e-posta adresine gönderilen doğrulama bağlantısına tıkla; ardından uygulamada “Giriş yap” seçeneğini kullan.');
    this.name = 'EmailVerificationRequiredError';
  }
}

async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.msg ?? body.message ?? 'İşlem tamamlanamadı.');
  return body as T;
}

function toUser(payload: AuthPayload, fallback: Omit<LocalUser, 'id' | 'accessToken'>): LocalUser {
  if (!payload.user?.id || !payload.access_token) throw new Error('E-posta doğrulaması gerekiyor. E-postandaki bağlantıya tıklayıp ardından giriş yapmalısın.');
  return { ...fallback, id: payload.user.id, accessToken: payload.access_token };
}

export async function createRemoteAccount(data: Omit<LocalUser, 'id' | 'accessToken'>, password: string): Promise<LocalUser> {
  const payload = await api<AuthPayload>('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: data.email, password, data: { full_name: data.name, city: data.city, phone: data.phone, role: data.role } }) });
  if (payload.user?.id && !payload.access_token) throw new EmailVerificationRequiredError();
  const user = toUser(payload, data); await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user)); return user;
}

export async function resendVerificationEmail(email: string) {
  await api('/auth/v1/resend', { method: 'POST', body: JSON.stringify({ type: 'signup', email }) });
}

export async function sendPasswordResetEmail(email: string) {
  await api('/auth/v1/recover', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function loginRemoteAccount(email: string, password: string): Promise<LocalUser> {
  const payload = await api<AuthPayload>('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  const meta = payload.user?.user_metadata ?? {};
  const user = toUser(payload, { name: meta.full_name ?? email.split('@')[0], email, city: meta.city, phone: meta.phone, role: meta.role });
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user)); return user;
}

export async function remoteProfile(user: LocalUser): Promise<ProfilePayload> {
  if (!user.id || !user.accessToken) throw new Error('Oturum bilgisi bulunamadı.');
  const rows = await api<ProfilePayload[]>(`/rest/v1/profiles?id=eq.${user.id}&select=plan,free_topic_used,free_mock_used`, {}, user.accessToken);
  if (!rows[0]) throw new Error('Üyelik profilin henüz hazırlanıyor. Birkaç saniye sonra tekrar dene.');
  return rows[0];
}

export async function clearRemoteSession() { await AsyncStorage.removeItem(SESSION_KEY); }

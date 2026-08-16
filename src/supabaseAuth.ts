import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocalUser } from './localAuth';

const SUPABASE_URL = 'https://hkfjjyltkfoiqujvelug.supabase.co';
const PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZmpqeWx0a2ZvaXF1anZlbHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NjQ2MDIsImV4cCI6MjEwMTQ0MDYwMn0.JI04LXbh5Lt4RACcFfEmB7FxsOe1Gr4xVXNBZ5f8En0';
const SESSION_KEY = 'terfi_supabase_session_v1';

type AuthPayload = { access_token?: string; refresh_token?: string; expires_in?: number; user?: { id: string; email?: string; user_metadata?: Record<string, string>; identities?: unknown[] }; message?: string };
type ErrorPayload = { message?: string; msg?: string; error?: string; error_description?: string; code?: string };
export type ProfilePayload = { plan: 'free' | 'premium'; free_topic_used: number; free_mock_used: boolean };

export class EmailVerificationRequiredError extends Error {
  constructor() {
    super('Üyeliğin oluşturuldu. Devam etmek için e-posta adresine gönderilen doğrulama bağlantısına tıkla; ardından uygulamada “Giriş yap” seçeneğini kullan.');
    this.name = 'EmailVerificationRequiredError';
  }
}

function turkishAuthError(body: ErrorPayload): string {
  const raw = [body.message, body.msg, body.error, body.error_description, body.code].filter(Boolean).join(' ').toLowerCase();
  if (raw.includes('rate limit') || raw.includes('over_email_send_rate_limit')) return 'E-posta gönderim sınırına ulaşıldı. Lütfen tekrar göndermeden önce bir süre bekle.';
  if (raw.includes('invalid login credentials') || raw.includes('invalid_credentials')) return 'E-posta adresi veya şifre hatalı. Şifreni bilmiyorsan “Şifremi Unuttum” bağlantısını kullanabilirsin.';
  if (raw.includes('email not confirmed') || raw.includes('email_not_confirmed')) return 'E-posta adresin henüz onaylanmamış. Gelen kutundaki doğrulama bağlantısına tıklayıp tekrar giriş yap.';
  if (raw.includes('user already registered') || raw.includes('email_exists') || raw.includes('already been registered')) return 'Bu e-posta adresiyle daha önce üyelik oluşturulmuş. “Giriş Yap” seçeneğini kullan veya şifreni sıfırla.';
  if (raw.includes('password should be at least') || raw.includes('weak_password')) return 'Şifren en az 6 karakter olmalıdır.';
  if (raw.includes('unable to validate email') || raw.includes('invalid email') || raw.includes('email_address_invalid')) return 'Geçerli bir e-posta adresi yazmalısın.';
  if (raw.includes('signup is disabled')) return 'Yeni üyelik oluşturma şu anda geçici olarak kapalı. Lütfen daha sonra tekrar dene.';
  if (raw.includes('network') || raw.includes('fetch')) return 'Sunucuya bağlanılamadı. İnternet bağlantını kontrol edip tekrar dene.';
  return 'İşlem tamamlanamadı. Lütfen bilgilerini kontrol edip tekrar dene.';
}

async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers ?? {}) } });
  const body = await response.json().catch(() => ({})) as ErrorPayload;
  if (!response.ok) throw new Error(turkishAuthError(body));
  return body as T;
}

function toUser(payload: AuthPayload, fallback: Omit<LocalUser, 'id' | 'accessToken'>): LocalUser {
  if (!payload.user?.id || !payload.access_token) throw new Error('E-posta doğrulaması gerekiyor. E-postandaki bağlantıya tıklayıp ardından giriş yapmalısın.');
  return { ...fallback, id: payload.user.id, accessToken: payload.access_token, refreshToken: payload.refresh_token, accessTokenExpiresAt: Date.now() + Math.max(60, payload.expires_in ?? 3300) * 1000 };
}

export async function createRemoteAccount(data: Omit<LocalUser, 'id' | 'accessToken'>, password: string): Promise<LocalUser> {
  const payload = await api<AuthPayload>('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: data.email, password, data: { full_name: data.name, institution: data.institution, city: data.city, phone: data.phone, role: data.role } }) });
  if (payload.user?.identities && payload.user.identities.length === 0) throw new Error('Bu e-posta adresiyle daha önce üyelik oluşturulmuş. Lütfen “Giriş Yap” seçeneğini kullan. Şifreni bilmiyorsan “Şifremi Unuttum” bağlantısına bas.');
  if (payload.user?.id && !payload.access_token) throw new EmailVerificationRequiredError();
  const user = toUser(payload, data); await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user)); return user;
}

export async function resendVerificationEmail(email: string) {
  await api('/auth/v1/resend', { method: 'POST', body: JSON.stringify({ type: 'signup', email }) });
}

export async function sendPasswordResetEmail(email: string, redirectTo?: string) {
  await api('/auth/v1/recover', { method: 'POST', body: JSON.stringify({ email, ...(redirectTo ? { redirect_to: redirectTo } : {}) }) });
}

export async function updateRemotePassword(accessToken: string, password: string) {
  await api('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password }) }, accessToken);
}

export async function loginRemoteAccount(email: string, password: string): Promise<LocalUser> {
  const payload = await api<AuthPayload>('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  const meta = payload.user?.user_metadata ?? {};
  const user = toUser(payload, { name: meta.full_name ?? email.split('@')[0], email, institution: meta.institution, city: meta.city, phone: meta.phone, role: meta.role });
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user)); return user;
}

export async function refreshRemoteSession(user: LocalUser): Promise<LocalUser> {
  // Refresh shortly before expiry instead of interrupting an active member mid-study.
  if (user.accessToken && user.accessTokenExpiresAt && user.accessTokenExpiresAt > Date.now() + 90_000) return user;
  if (!user.refreshToken) throw new Error('Oturum süresi doldu. Güvenliğin için lütfen tekrar giriş yap.');
  const payload = await api<AuthPayload>('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: user.refreshToken }) });
  const refreshed = toUser(payload, user);
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(refreshed));
  return refreshed;
}

export async function remoteProfile(user: LocalUser): Promise<ProfilePayload> {
  if (!user.id || !user.accessToken) throw new Error('Oturum bilgisi bulunamadı.');
  const rows = await api<ProfilePayload[]>(`/rest/v1/profiles?id=eq.${user.id}&select=plan,free_topic_used,free_mock_used`, {}, user.accessToken);
  if (!rows[0]) throw new Error('Üyelik profilin henüz hazırlanıyor. Birkaç saniye sonra tekrar dene.');
  return rows[0];
}

export async function clearRemoteSession() { await AsyncStorage.removeItem(SESSION_KEY); }

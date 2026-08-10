import type { LocalUser } from './localAuth';

const SUPABASE_URL = 'https://hkfjjyltkfoiqujvelug.supabase.co';
const PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZmpqeWx0a2ZvaXF1anZlbHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NjQ2MDIsImV4cCI6MjEwMTQ0MDYwMn0.JI04LXbh5Lt4RACcFfEmB7FxsOe1Gr4xVXNBZ5f8En0';

export type MemberComment = { id: string; author: string; text: string; date: string };
type CloudComment = { id: string; author: string; body: string; created_at: string };

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers ?? {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { message?: string }).message ?? 'Yorumlar kaydedilemedi. Lütfen tekrar dene.');
  return payload as T;
}

function mapComment(row: CloudComment): MemberComment {
  return { id: row.id, author: row.author, text: row.body, date: new Date(row.created_at).toLocaleDateString('tr-TR') };
}

export async function loadMemberComments(): Promise<MemberComment[]> {
  const rows = await request<CloudComment[]>('/rest/v1/member_comments?select=id,author,body,created_at&is_visible=eq.true&order=created_at.desc&limit=50');
  return rows.map(mapComment);
}

export async function publishMemberComment(user: LocalUser, text: string): Promise<MemberComment> {
  if (!user.accessToken || !user.id) throw new Error('Yorum yazmak için oturumunu yenileyip tekrar giriş yapmalısın.');
  const body = text.trim();
  if (body.length < 2) throw new Error('Yorumun en az 2 karakter olmalı.');
  if (body.length > 1000) throw new Error('Yorum en fazla 1000 karakter olabilir.');
  const rows = await request<CloudComment[]>('/rest/v1/member_comments', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ user_id: user.id, author: user.name.trim() || user.email.split('@')[0], body }) }, user.accessToken);
  if (!rows[0]) throw new Error('Yorum kaydedildi ancak yanıt alınamadı. Sayfayı yenileyip kontrol et.');
  return mapComment(rows[0]);
}

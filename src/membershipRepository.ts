import type { LocalUser } from './localAuth';

const SUPABASE_URL = 'https://hkfjjyltkfoiqujvelug.supabase.co';
const PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZmpqeWx0a2ZvaXF1anZlbHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NjQ2MDIsImV4cCI6MjEwMTQ0MDYwMn0.JI04LXbh5Lt4RACcFfEmB7FxsOe1Gr4xVXNBZ5f8En0';

export type MembershipGrant = { plan: 'free' | 'premium'; allowed_count: number; free_topic_used: number; free_mock_used: boolean };

export async function consumeMembershipQuota(user: LocalUser, mode: 'topic' | 'mock', count: number): Promise<MembershipGrant> {
  if (!user.accessToken) throw new Error('Üyelik oturumun bulunamadı. Lütfen tekrar giriş yap.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_membership_quota`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${user.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requested_mode: mode, requested_count: count }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { message?: string }).message ?? 'Üyelik hakkın doğrulanamadı.');
  const grant = Array.isArray(payload) ? payload[0] : payload;
  if (!grant || typeof grant.allowed_count !== 'number') throw new Error('Üyelik hakkı yanıtı alınamadı.');
  return grant as MembershipGrant;
}

import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocalUser = { name: string; email: string; role?: string; city?: string; phone?: string; id?: string; accessToken?: string };

const USER_KEY = 'terfi_current_user_v1';

export async function currentLocalUser(): Promise<LocalUser | null> {
  const stored = await AsyncStorage.getItem(USER_KEY);
  if (!stored) return null;
  try { return JSON.parse(stored) as LocalUser; } catch { return null; }
}

export async function saveLocalUser(user: LocalUser) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export async function removeLocalUser() {
  await AsyncStorage.removeItem(USER_KEY);
}

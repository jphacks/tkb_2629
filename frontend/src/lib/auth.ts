import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
export type AuthUser = { id: number; name: string; email: string };
type Tokens = { access_token: string; refresh_token: string; expires_in: number; user: AuthUser };
let session: Tokens | null = null;
let refreshPromise: Promise<void> | null = null;
let epoch = 0;
const listeners = new Set<() => void>();
export const currentUser = () => session?.user ?? null;
export function subscribeAuth(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function notify() { listeners.forEach(listener => listener()); }

export async function authPost<T = { message: string }>(path: string, body: object): Promise<T> {
  const response = await fetch(`${API_URL}/auth/${path}`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : '入力内容を確認してください');
  return data as T;
}
async function accept(tokens: Tokens, generation: number) {
  if (generation !== epoch) return;
  if (Platform.OS !== 'web') await SecureStore.setItemAsync('shiori.refresh', tokens.refresh_token);
  if (generation !== epoch) {
    if (Platform.OS !== 'web') await SecureStore.deleteItemAsync('shiori.refresh');
    return;
  }
  session = tokens;
  notify();
}
export async function login(email: string, password: string) {
  const generation = ++epoch;
  await accept(await authPost<Tokens>('login', { email: email.trim(), password }), generation);
}
export async function refreshSession() {
  if (!refreshPromise) {
    const generation = epoch;
    refreshPromise = (async () => {
      const refresh_token = Platform.OS === 'web' ? undefined
        : await SecureStore.getItemAsync('shiori.refresh');
      if (Platform.OS !== 'web' && !refresh_token) throw new Error('ログインしてください');
      await accept(await authPost<Tokens>('refresh', refresh_token ? { refresh_token } : {}), generation);
    })().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}
export async function restoreSession() {
  try { await refreshSession(); } catch { session = null; notify(); }
}
export async function clearLocalSession() {
  ++epoch;
  session = null;
  notify();
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync('shiori.refresh');
}
export async function logout() {
  // Wait for an in-flight rotation so the newest refresh token is revoked.
  if (refreshPromise) { try { await refreshPromise; } catch { /* already signed out */ } }
  const refresh_token = session?.refresh_token;
  // A server failure keeps the session visible so the user can retry revocation.
  await authPost('logout', refresh_token ? { refresh_token } : {});
  await clearLocalSession();
}
export async function authenticatedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const send = () => {
    const headers = new Headers(init.headers);
    if (session) headers.set('Authorization', `Bearer ${session.access_token}`);
    return fetch(input, { ...init, headers });
  };
  let response = await send();
  if (response.status === 401 && session) {
    try { await refreshSession(); }
    catch (error) {
      // Network errors must not destroy the persisted login credential.
      session = null; notify();
      throw error;
    }
    response = await send();
    if (response.status === 401) { session = null; notify(); }
  }
  return response;
}

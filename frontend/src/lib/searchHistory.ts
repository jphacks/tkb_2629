import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { currentUser } from './auth';

export type SearchHistoryScope = 'catalog' | 'bookshelf';
const queues = new Map<string, Promise<unknown>>();
const normalize = (query: string) => query.trim().replace(/\s+/g, ' ');
const keyFor = (userId: number, scope: SearchHistoryScope) => `shiori.history.v1.${userId}.${scope}`;

async function read(key: string): Promise<string[]> {
  const raw = Platform.OS === 'web' ? localStorage.getItem(key) : await SecureStore.getItemAsync(key);
  if (raw === null) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > 10 ||
    value.some((item) => typeof item !== 'string' || !item || item !== normalize(item)) ||
    new Set(value).size !== value.length) {
    throw new Error('検索履歴の保存データを読み取れません。履歴をすべて削除してから再試行してください。');
  }
  return value;
}

function update(key: string, change: ((items: string[]) => string[]) | null): Promise<string[]> {
  const previous = queues.get(key) ?? Promise.resolve();
  const task = previous.catch(() => undefined).then(async () => {
    // Clearing must remain possible even when stored data is unreadable.
    const items = change === null ? [] : change(await read(key));
    if (items.length === 0) {
      if (Platform.OS === 'web') localStorage.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
    } else {
      const raw = JSON.stringify(items);
      if (Platform.OS === 'web') localStorage.setItem(key, raw);
      else await SecureStore.setItemAsync(key, raw);
    }
    return items;
  });
  queues.set(key, task);
  void task.finally(() => { if (queues.get(key) === task) queues.delete(key); }).catch(() => undefined);
  return task;
}

export const searchHistory = {
  async read(userId: number, scope: SearchHistoryScope) {
    const key = keyFor(userId, scope);
    await queues.get(key);
    return read(key);
  },
  remember(userId: number, scope: SearchHistoryScope, query: string) {
    const term = normalize(query);
    if (!term) return this.read(userId, scope);
    return update(keyFor(userId, scope), (items) => [term, ...items.filter((item) => item !== term)].slice(0, 10));
  },
  remove(userId: number, scope: SearchHistoryScope, query: string) {
    return update(keyFor(userId, scope), (items) => items.filter((item) => item !== query));
  },
  clear(userId: number, scope: SearchHistoryScope) {
    return update(keyFor(userId, scope), null);
  },
};

export function useSearchHistory(scope: SearchHistoryScope) {
  const userId = currentUser()?.id;
  const [items, setItems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState<string | null>(null);
  const ownerKey = userId === undefined ? null : keyFor(userId, scope);
  const generation = useRef(0);
  useEffect(() => {
    const request = ++generation.current;
    setItems([]);
    setError(null);
    setLoading(true);
    setOwner(ownerKey);
    if (userId === undefined) { setLoading(false); return; }
    searchHistory.read(userId, scope).then((saved) => {
      if (generation.current === request) setItems(saved);
    }).catch((reason: unknown) => {
      if (generation.current === request) setError(reason instanceof Error ? reason.message : '検索履歴を読み込めませんでした。');
    }).finally(() => { if (generation.current === request) setLoading(false); });
    return () => { generation.current += 1; };
  }, [scope, userId]);

  async function mutate(operation: (id: number) => Promise<string[]>) {
    if (userId === undefined) return;
    const request = ++generation.current;
    setError(null);
    try {
      const saved = await operation(userId);
      if (generation.current === request) setItems(saved);
    } catch (reason: unknown) {
      if (generation.current === request) setError(reason instanceof Error ? reason.message : '検索履歴を保存できませんでした。');
    } finally {
      if (generation.current === request) setLoading(false);
    }
  }
  return {
    items: owner === ownerKey ? items : [],
    error: owner === ownerKey ? error : null,
    loading: owner === ownerKey ? loading : true,
    remember: (query: string) => mutate((id) => searchHistory.remember(id, scope, query)),
    remove: (query: string) => mutate((id) => searchHistory.remove(id, scope, query)),
    clear: () => mutate((id) => searchHistory.clear(id, scope)),
  };
}

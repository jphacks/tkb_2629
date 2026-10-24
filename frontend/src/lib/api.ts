import type { User } from '../types/user';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function getUsers(): Promise<User[]> {
  const response = await fetch(`${API_URL}/users`);

  if (!response.ok) {
    throw new Error(`ユーザー一覧の取得に失敗しました (${response.status})`);
  }

  return response.json() as Promise<User[]>;
}

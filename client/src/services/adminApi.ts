/**
 * طبقة الاتصال بمسارات لوحة التحكم (‎/api/admin‎).
 * توكن المشرف مُخزَّن بمفتاح مستقل عن توكن اللاعب حتى لا يختلطا.
 */
import { ApiError } from './api';

const API_BASE = import.meta.env.VITE_SERVER_URL || '';
const ADMIN_TOKEN_KEY = 'chess_admin_token';

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}
export function setAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}
export function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/admin${path}`, { ...init, headers });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* استجابة بلا JSON */
  }

  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error || 'حدث خطأ في الاتصال بالسيرفر.';
    throw new ApiError(message, res.status);
  }
  if (data === null) {
    throw new ApiError('استجابة غير متوقعة من السيرفر (تحقق من تمرير /api).', res.status);
  }
  return data as T;
}

export const adminApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
};

/* ------------------------- الأنواع ------------------------- */

export interface AdminInfo {
  id: number;
  username: string;
  role: 'super' | 'admin';
}

export interface AdminStats {
  totalPlayers: number;
  totalGames: number;
  gamesToday: number;
  newPlayersToday: number;
}

export interface AdminPlayer {
  id: number;
  username: string;
  email: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminRecentGame {
  id: number;
  whiteName: string;
  blackName: string;
  result: 'white' | 'black' | 'draw';
  endReason: string;
  moveCount: number;
  endedAt: string;
}

export interface AdminGameDetail {
  id: number;
  whiteName: string;
  blackName: string;
  result: 'white' | 'black' | 'draw';
  endReason: string;
  moveCount: number;
  movesSan: string[];
  finalFen: string;
  whiteEloBefore: number | null;
  whiteEloAfter: number | null;
  blackEloBefore: number | null;
  blackEloAfter: number | null;
  startedAt: string;
  endedAt: string;
}

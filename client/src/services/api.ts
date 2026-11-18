/**
 * طبقة الاتصال بمسارات REST في السيرفر.
 * تستخدم نفس أصل الصفحة في الإنتاج (Nginx يمرّر /api) أو VITE_SERVER_URL إن ضُبط.
 */

const API_BASE = import.meta.env.VITE_SERVER_URL || '';

const TOKEN_KEY = 'chess_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api${path}`, { ...init, headers });

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

  // استجابة ناجحة لكن بلا JSON صالح ⇒ غالبًا المسار لا يصل للسيرفر (بروكسي ناقص).
  if (data === null) {
    throw new ApiError('استجابة غير متوقعة من السيرفر (تحقق من تمرير /api).', res.status);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
};

/* ------------------------- الأنواع ------------------------- */

export interface UserProfile {
  id: number;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  createdAt: string;
}

export interface GameSummary {
  id: number;
  whiteName: string;
  blackName: string;
  result: 'white' | 'black' | 'draw';
  endReason: string;
  moveCount: number;
  endedAt: string;
  myColor: 'white' | 'black';
}

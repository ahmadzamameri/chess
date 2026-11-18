/**
 * إعداد اتصال Socket.IO المفرد + إدارة معرّف الجلسة الثابت (sessionId).
 * sessionId يُخزَّن في localStorage حتى نستطيع العودة للمباراة بعد تحديث الصفحة،
 * لأن socket.id يتغيّر عند كل إعادة اتصال ولا يُوثق به وحده.
 */
import { io, type Socket } from 'socket.io-client';

// إن ضُبط VITE_SERVER_URL نتصل به مباشرة (الإنتاج: الدومين).
// إن كان فارغًا نتصل بنفس أصل الصفحة (التطوير عبر Vite proxy) — undefined = same-origin.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || undefined;

const SESSION_KEY = 'chess_session_id';
const ACTIVE_GAME_KEY = 'chess_active_game_id';

/** جلب/إنشاء معرّف جلسة ثابت. */
export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/** حفظ/قراءة/مسح معرّف المباراة النشطة (لإعادة الاتصال بعد Refresh). */
export function setActiveGameId(gameId: string): void {
  localStorage.setItem(ACTIVE_GAME_KEY, gameId);
}
export function getActiveGameId(): string | null {
  return localStorage.getItem(ACTIVE_GAME_KEY);
}
export function clearActiveGameId(): void {
  localStorage.removeItem(ACTIVE_GAME_KEY);
}

let socketInstance: Socket | null = null;

/** التوكن الحالي (إن وُجد) — يُرسل مع الاتصال ليعرف السيرفر هوية اللاعب. */
function currentToken(): string | null {
  return localStorage.getItem('chess_token');
}

/** إنشاء (أو إعادة استخدام) اتصال Socket واحد للتطبيق. */
export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: true,
      auth: { token: currentToken() },
    });
  }
  return socketInstance;
}

/**
 * إعادة الاتصال بهوية جديدة (بعد تسجيل الدخول أو الخروج).
 * ضروري لأن السيرفر يقرأ التوكن مرة واحدة عند الاتصال.
 */
export function reconnectSocket(): Socket {
  const socket = getSocket();
  socket.auth = { token: currentToken() };
  socket.disconnect();
  socket.connect();
  return socket;
}

/**
 * تسجيل كل أحداث Socket.IO ومنطق الاتصال.
 * مبدأ أساسي: السيرفر لا يثق بأي شيء من العميل — الاسم/اللون/الدور/gameId
 * كلها تُتحقّق من مصدر السيرفر (الجلسة + حالة المباراة).
 */
import type { Server, Socket } from 'socket.io';
import { config } from './config.js';
import { gameManager } from './games/gameManager.js';
import { matchmakingQueue } from './matchmaking/queue.js';
import {
  RateLimiter,
  isValidId,
  isValidSquare,
  sanitizeName,
} from './utils.js';
import type {
  Color,
  DrawResponsePayload,
  FindMatchPayload,
  GameStatePayload,
  MakeMovePayload,
  MatchFoundPayload,
  Player,
  RejoinPayload,
  SimpleGamePayload,
} from './types.js';
import type { GameSession } from './games/gameSession.js';
import { verifyToken } from './auth/credentials.js';
import { recordFinishedGame } from './services/gameRecords.js';
import { resolveTimeControl } from './timeControls.js';
import { challengeStore } from './matchmaking/challenges.js';

/** كم نُبقي المباراة المنتهية في الذاكرة قبل حذفها. */
const FINISHED_GAME_TTL_MS = 60_000;

const rateLimiter = new RateLimiter();

/** مباريات حُفظت بالفعل — لمنع الحفظ المزدوج. */
const recordedGames = new Set<string>();

export function registerSocketHandlers(io: Server): void {
  broadcastOnlineCount(io);

  io.on('connection', (socket: Socket) => {
    // مصادقة اختيارية: توكن صالح ⇒ لاعب مسجّل، وإلا ضيف.
    // الاسم والهوية يأتيان من التوكن لا من العميل (لا نثق بالواجهة).
    const rawToken = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    const payload = typeof rawToken === 'string' ? verifyToken(rawToken) : null;
    if (payload) {
      socket.data.userId = payload.userId;
      socket.data.authUsername = payload.username;
    } else {
      socket.data.userId = null;
      socket.data.authUsername = null;
    }

    broadcastOnlineCount(io);

    /* ---------------- المطابقة ---------------- */

    socket.on('find_match', (payload: FindMatchPayload) => {
      if (!guard(socket)) return;

      if (!payload || !isValidId(payload.sessionId)) {
        return emitError(socket, 'جلسة غير صالحة.');
      }
      const sessionId = payload.sessionId;
      // اللاعب المسجّل يُستخدم اسم حسابه دائمًا (موثوق)، والضيف اسمه المؤقت بعد التنظيف.
      const authUsername = socket.data.authUsername as string | null;
      const userId = (socket.data.userId as number | null) ?? null;
      const name = authUsername ?? sanitizeName(payload.name);

      // لو للاعب مباراة نشطة أصلًا، أعِده إليها بدل وضعه في الانتظار.
      const existing = gameManager.findBySession(sessionId);
      if (existing && existing.isActive()) {
        const color = existing.colorOfSession(sessionId)!;
        reattach(io, socket, existing, color);
        return;
      }

      // منع الازدواج: إن كان بالفعل في الانتظار لا نكرّره.
      if (matchmakingQueue.has(sessionId, socket.id)) {
        socket.emit('searching');
        return;
      }

      // خزّن الجلسة على السوكت لاستخدامها عند قطع الاتصال.
      socket.data.sessionId = sessionId;
      socket.data.name = name;

      // التحكم الزمني يُتحقق منه بقائمة بيضاء (لا نثق بقيمة العميل).
      const timeControl = resolveTimeControl(payload.timeControlId);

      const pair = matchmakingQueue.enqueue({
        socketId: socket.id,
        sessionId,
        name,
        userId,
        timeControlId: timeControl.id,
      });

      if (!pair) {
        socket.emit('searching');
        return;
      }

      // وُجد منافس → أنشئ مباراة.
      const whitePlayer: Player = {
        userId: pair.white.userId,
        sessionId: pair.white.sessionId,
        socketId: pair.white.socketId,
        name: pair.white.name,
        color: 'white',
        connected: true,
      };
      const blackPlayer: Player = {
        userId: pair.black.userId,
        sessionId: pair.black.sessionId,
        socketId: pair.black.socketId,
        name: pair.black.name,
        color: 'black',
        connected: true,
      };

      // كلا اللاعبين طلب نفس التحكم الزمني (الطابور يضمن ذلك).
      const game = gameManager.create(
        whitePlayer,
        blackPlayer,
        resolveTimeControl(pair.white.timeControlId),
      );

      joinAndAnnounce(io, game);
      scheduleFlag(io, game);
    });

    socket.on('cancel_match', () => {
      if (!guard(socket)) return;
      const sessionId = socket.data.sessionId as string | undefined;
      matchmakingQueue.removeBySocket(socket.id);
      if (sessionId) matchmakingQueue.removeBySession(sessionId);
      socket.emit('search_cancelled');
    });

    /* ---------------- تحدّي صديق برابط ---------------- */

    socket.on('create_challenge', (payload: { sessionId?: unknown; name?: unknown; timeControlId?: unknown }) => {
      if (!guard(socket)) return;
      if (!payload || !isValidId(payload.sessionId)) {
        return emitError(socket, 'جلسة غير صالحة.');
      }

      const sessionId = payload.sessionId;
      const authUsername = socket.data.authUsername as string | null;
      const userId = (socket.data.userId as number | null) ?? null;
      const name = authUsername ?? sanitizeName(payload.name);
      const timeControl = resolveTimeControl(payload.timeControlId);

      socket.data.sessionId = sessionId;

      // إنشاء تحدٍّ يلغي أي بحث عشوائي قائم لنفس اللاعب.
      matchmakingQueue.removeBySession(sessionId);
      matchmakingQueue.removeBySocket(socket.id);

      const challenge = challengeStore.create({
        creatorSessionId: sessionId,
        creatorSocketId: socket.id,
        creatorName: name,
        creatorUserId: userId,
        timeControlId: timeControl.id,
      });

      socket.emit('challenge_created', {
        challengeId: challenge.id,
        timeControlId: challenge.timeControlId,
      });
    });

    socket.on('cancel_challenge', (payload: { challengeId?: unknown }) => {
      if (!guard(socket)) return;
      const challenge = challengeStore.get(payload?.challengeId);
      // لا يلغيه إلا صاحبه.
      if (challenge && challenge.creatorSessionId === socket.data.sessionId) {
        challengeStore.remove(challenge.id);
      }
      socket.emit('challenge_cancelled');
    });

    /** استعلام عن تحدٍّ لعرض معلوماته لمن فتح الرابط. */
    socket.on('get_challenge', (payload: { challengeId?: unknown }) => {
      if (!guard(socket)) return;
      const challenge = challengeStore.get(payload?.challengeId);
      if (!challenge) return socket.emit('challenge_not_found');

      socket.emit('challenge_info', {
        challengeId: challenge.id,
        creatorName: challenge.creatorName,
        timeControlId: challenge.timeControlId,
        isMine: challenge.creatorSessionId === socket.data.sessionId,
      });
    });

    socket.on('accept_challenge', (payload: { challengeId?: unknown; sessionId?: unknown; name?: unknown }) => {
      if (!guard(socket)) return;
      if (!payload || !isValidId(payload.sessionId)) {
        return emitError(socket, 'جلسة غير صالحة.');
      }

      const challenge = challengeStore.get(payload.challengeId);
      if (!challenge) return socket.emit('challenge_not_found');

      const sessionId = payload.sessionId;
      // لا يقبل أحد تحدّي نفسه.
      if (challenge.creatorSessionId === sessionId) {
        return emitError(socket, 'لا يمكنك قبول تحدّيك أنت.');
      }

      const creatorSocket = io.sockets.sockets.get(challenge.creatorSocketId);
      if (!creatorSocket) {
        challengeStore.remove(challenge.id);
        return socket.emit('challenge_not_found');
      }

      const authUsername = socket.data.authUsername as string | null;
      const userId = (socket.data.userId as number | null) ?? null;
      const name = authUsername ?? sanitizeName(payload.name);
      socket.data.sessionId = sessionId;

      // التحدي استُهلك.
      challengeStore.remove(challenge.id);
      matchmakingQueue.removeBySession(sessionId);
      matchmakingQueue.removeBySocket(socket.id);

      // اختيار اللون عشوائيًا كما في المطابقة العادية.
      const creatorIsWhite = Math.random() < 0.5;

      const creatorPlayer: Player = {
        userId: challenge.creatorUserId,
        sessionId: challenge.creatorSessionId,
        socketId: challenge.creatorSocketId,
        name: challenge.creatorName,
        color: creatorIsWhite ? 'white' : 'black',
        connected: true,
      };
      const accepterPlayer: Player = {
        userId,
        sessionId,
        socketId: socket.id,
        name,
        color: creatorIsWhite ? 'black' : 'white',
        connected: true,
      };

      const white = creatorIsWhite ? creatorPlayer : accepterPlayer;
      const black = creatorIsWhite ? accepterPlayer : creatorPlayer;

      const game = gameManager.create(white, black, resolveTimeControl(challenge.timeControlId));
      joinAndAnnounce(io, game);
      scheduleFlag(io, game);
    });

    /* ---------------- إعادة الاتصال بمباراة ---------------- */

    socket.on('rejoin', (payload: RejoinPayload) => {
      if (!guard(socket)) return;
      if (!payload || !isValidId(payload.sessionId) || !isValidId(payload.gameId)) {
        return emitError(socket, 'بيانات إعادة الاتصال غير صالحة.');
      }

      const game = gameManager.findBySession(payload.sessionId);
      // تحقق أن المباراة موجودة وتخص هذه الجلسة وأن gameId مطابق فعلًا.
      if (!game || game.gameId !== payload.gameId) {
        return socket.emit('game_not_found');
      }
      const color = game.colorOfSession(payload.sessionId);
      if (!color) {
        return socket.emit('game_not_found');
      }

      socket.data.sessionId = payload.sessionId;
      reattach(io, socket, game, color);
    });

    /* ---------------- النقلات ---------------- */

    socket.on('make_move', (payload: MakeMovePayload) => {
      if (!guard(socket)) return;

      const ctx = resolveGameContext(socket, payload?.gameId);
      if (!ctx) return emitError(socket, 'لست ضمن هذه المباراة.');
      const { game, color } = ctx;

      if (!isValidSquare(payload.from) || !isValidSquare(payload.to)) {
        return socket.emit('move_rejected', { reason: 'خانة غير صالحة.' });
      }
      const promotion =
        payload.promotion && ['q', 'r', 'b', 'n'].includes(payload.promotion)
          ? payload.promotion
          : 'q';

      const outcome = game.applyMove(color, {
        from: payload.from,
        to: payload.to,
        promotion,
      });

      if (!outcome.ok) {
        return socket.emit('move_rejected', { reason: outcome.reason });
      }

      broadcastState(io, game);
      scheduleFlag(io, game);
      maybeScheduleCleanup(game);
    });

    /* ---------------- الاستسلام / التعادل ---------------- */

    socket.on('resign', (payload: SimpleGamePayload) => {
      if (!guard(socket)) return;
      const ctx = resolveGameContext(socket, payload?.gameId);
      if (!ctx) return;
      if (ctx.game.resign(ctx.color)) {
        broadcastState(io, ctx.game);
        maybeScheduleCleanup(ctx.game);
      }
    });

    socket.on('offer_draw', (payload: SimpleGamePayload) => {
      if (!guard(socket)) return;
      const ctx = resolveGameContext(socket, payload?.gameId);
      if (!ctx) return;
      if (ctx.game.offerDraw(ctx.color)) {
        broadcastState(io, ctx.game);
      }
    });

    socket.on('respond_draw', (payload: DrawResponsePayload) => {
      if (!guard(socket)) return;
      const ctx = resolveGameContext(socket, payload?.gameId);
      if (!ctx) return;
      if (ctx.game.respondDraw(ctx.color, Boolean(payload?.accept))) {
        broadcastState(io, ctx.game);
        maybeScheduleCleanup(ctx.game);
      }
    });

    /* ---------------- قطع الاتصال ---------------- */

    socket.on('disconnect', () => {
      // أزله من الانتظار دائمًا.
      matchmakingQueue.removeBySocket(socket.id);
      const sessionId = socket.data.sessionId as string | undefined;
      if (sessionId) matchmakingQueue.removeBySession(sessionId);

      // أزل أي تحدٍّ معلّق أنشأه (لا معنى لرابط بلا صاحب).
      challengeStore.removeBySocket(socket.id);

      broadcastOnlineCount(io);

      if (!sessionId) return;
      const game = gameManager.findBySession(sessionId);
      if (!game || !game.isActive()) return;

      const color = game.colorOfSession(sessionId);
      if (!color) return;

      // تأكد أن هذا السوكت هو الحالي للاعب (تجاهل قطع سوكت قديم).
      if (game.getPlayer(color).socketId !== socket.id) return;

      game.setConnected(color, false, null);
      io.to(game.gameId).emit('opponent_disconnected', { color });
      broadcastState(io, game);

      // امنح مهلة للعودة قبل الحسم بالانقطاع.
      gameManager.startDisconnectTimer(
        game.gameId,
        color,
        config.reconnectGraceMs,
        () => {
          const current = gameManager.get(game.gameId);
          if (!current || !current.isActive()) return;
          if (current.getPlayer(color).connected) return; // عاد في الوقت المناسب
          current.finishByDisconnect(color);
          broadcastState(io, current);
          maybeScheduleCleanup(current);
        },
      );
    });
  });
}

/* ==================== دوال مساعدة ==================== */

/** حماية معدّل بسيطة لكل socket. */
function guard(socket: Socket): boolean {
  if (!rateLimiter.allow(socket.id)) {
    emitError(socket, 'عدد كبير من الطلبات. تمهّل قليلًا.');
    return false;
  }
  return true;
}

function emitError(socket: Socket, message: string): void {
  socket.emit('error_message', { message });
}

/** إيجاد مباراة اللاعب من جلسته + التحقق أن gameId المُرسَل يخصّه فعلًا. */
function resolveGameContext(
  socket: Socket,
  gameId: unknown,
): { game: GameSession; color: Color } | null {
  const sessionId = socket.data.sessionId as string | undefined;
  if (!sessionId || !isValidId(gameId)) return null;

  const game = gameManager.findBySession(sessionId);
  if (!game || game.gameId !== gameId) return null;

  const color = game.colorOfSession(sessionId);
  if (!color) return null;

  return { game, color };
}

/** ربط اللاعبين بالغرفة وإعلان بدء المباراة. */
function joinAndAnnounce(io: Server, game: GameSession): void {
  for (const color of ['white', 'black'] as Color[]) {
    const player = game.getPlayer(color);
    if (!player.socketId) continue;
    const target = io.sockets.sockets.get(player.socketId);
    if (!target) continue;

    target.data.sessionId = player.sessionId;
    target.join(game.gameId);

    const opponentName =
      color === 'white' ? game.getPlayer('black').name : game.getPlayer('white').name;

    const found: MatchFoundPayload = {
      gameId: game.gameId,
      color,
      opponentName,
    };
    target.emit('match_found', found);
  }
  broadcastState(io, game);
}

/** إعادة ربط لاعب عائد/متصل بمباراته النشطة. */
function reattach(
  io: Server,
  socket: Socket,
  game: GameSession,
  color: Color,
): void {
  socket.join(game.gameId);
  game.setConnected(color, true, socket.id);
  gameManager.clearDisconnectTimer(game.gameId);

  const opponentName =
    color === 'white' ? game.getPlayer('black').name : game.getPlayer('white').name;

  const found: MatchFoundPayload = {
    gameId: game.gameId,
    color,
    opponentName,
  };
  socket.emit('match_found', found);
  io.to(game.gameId).emit('opponent_reconnected', { color });
  broadcastState(io, game);
}

/** إرسال الحالة العامة لكل من في غرفة المباراة. */
function broadcastState(io: Server, game: GameSession): void {
  const state: GameStatePayload = game.getState();
  io.to(game.gameId).emit('game_state', state);
}

/**
 * (إعادة) جدولة مؤقّت سقوط الراية بعد كل نقلة.
 * عند نفاد وقت صاحب الدور تُحسم المباراة وتُبثّ الحالة — حتى لو لم يرسل أحد شيئًا.
 */
function scheduleFlag(io: Server, game: GameSession): void {
  if (!game.isActive()) {
    gameManager.clearFlagTimer(game.gameId);
    return;
  }
  gameManager.scheduleFlagTimer(game, () => {
    const current = gameManager.get(game.gameId);
    if (!current || !current.isActive()) return;
    if (!current.flagFall()) {
      // لم ينتهِ الوقت فعلًا (نقلة وصلت في اللحظة الأخيرة) ⇒ أعِد الجدولة.
      scheduleFlag(io, current);
      return;
    }
    broadcastState(io, current);
    maybeScheduleCleanup(current);
  });
}

/**
 * تُستدعى بعد أي حدث قد يُنهي المباراة:
 * تحفظ المباراة في قاعدة البيانات (مرة واحدة) ثم تجدول حذفها من الذاكرة.
 * الحفظ "أفضل جهد": أي فشل لا يؤثر على اللعب.
 */
function maybeScheduleCleanup(game: GameSession): void {
  if (game.isActive()) return;
  if (recordedGames.has(game.gameId)) return;
  recordedGames.add(game.gameId);

  const state = game.getState();
  if (state.result) {
    void recordFinishedGame({
      gameUid: game.gameId,
      whiteUserId: game.white.userId,
      blackUserId: game.black.userId,
      whiteName: game.white.name,
      blackName: game.black.name,
      result: state.result,
      endReason: state.endReason ?? 'resign',
      movesSan: state.moves.map((m) => m.san),
      finalFen: state.fen,
      startedAt: new Date(game.createdAt),
    }).catch((err) => console.error('[games] فشل حفظ المباراة:', err));
  }

  setTimeout(() => {
    gameManager.remove(game.gameId);
    recordedGames.delete(game.gameId);
  }, FINISHED_GAME_TTL_MS);
}

/** بث عدد اللاعبين المتصلين حاليًا. */
function broadcastOnlineCount(io: Server): void {
  const count = io.sockets.sockets.size;
  io.emit('online_count', { count });
}

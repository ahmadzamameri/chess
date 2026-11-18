/** أنواع الواجهة — مطابقة للحمولات القادمة من السيرفر. */

export type Color = 'white' | 'black';
export type GameStatus = 'active' | 'finished';
export type GameResult = 'white' | 'black' | 'draw' | null;

export type GameEndReason =
  | 'checkmate'
  | 'stalemate'
  | 'draw_agreed'
  | 'threefold_repetition'
  | 'insufficient_material'
  | 'fifty_move'
  | 'resign'
  | 'disconnect'
  | 'timeout';

export interface MoveRecord {
  san: string;
  from: string;
  to: string;
  color: Color;
}

export interface GameState {
  gameId: string;
  fen: string;
  turn: Color;
  status: GameStatus;
  moves: MoveRecord[];
  whiteName: string;
  blackName: string;
  whiteConnected: boolean;
  blackConnected: boolean;
  drawOffer: Color | null;
  result: GameResult;
  endReason: GameEndReason | null;
  inCheck: boolean;
  /** الوقت المتبقي لكل لاعب بالمللي ثانية (مرجعه السيرفر). */
  whiteMs: number;
  blackMs: number;
  timeControlId: string;
  increment: number;
}

/** أنواع التحكم بالوقت المتاحة — مطابقة لقائمة السيرفر البيضاء. */
export interface TimeControlOption {
  id: string;
  label: string;
  category: 'bullet' | 'blitz' | 'rapid';
}

export const TIME_CONTROLS: TimeControlOption[] = [
  { id: '1+0', label: '1+0', category: 'bullet' },
  { id: '3+0', label: '3+0', category: 'blitz' },
  { id: '3+2', label: '3+2', category: 'blitz' },
  { id: '5+0', label: '5+0', category: 'blitz' },
  { id: '10+0', label: '10+0', category: 'rapid' },
  { id: '15+10', label: '15+10', category: 'rapid' },
];

export const CATEGORY_AR: Record<TimeControlOption['category'], string> = {
  bullet: 'رصاصة',
  blitz: 'خاطف',
  rapid: 'سريع',
};

export interface MatchFound {
  gameId: string;
  color: Color;
  opponentName: string;
}

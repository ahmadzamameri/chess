/** بطاقة معلومات لاعب: الاسم، اللون، هل هو أنت، حالة الاتصال، ودوره الآن. */
import type { Color } from '../types';
import Clock from './Clock';

interface Props {
  name: string;
  color: Color;
  isYou: boolean;
  isActiveTurn: boolean;
  connected: boolean;
  /** الوقت المتبقي (مللي ثانية) — إن كانت المباراة موقوتة. */
  timeMs?: number;
  /** هل الساعة تعمل الآن. */
  clockRunning?: boolean;
}

export default function PlayerInfo({
  name,
  color,
  isYou,
  isActiveTurn,
  connected,
  timeMs,
  clockRunning = false,
}: Props) {
  return (
    <div className={`player-info ${isActiveTurn ? 'active' : ''}`}>
      <div className="player-left">
        <span
          className={`piece-chip ${color === 'white' ? 'piece-white' : 'piece-black'}`}
          aria-hidden
        />
        <div>
          <span className="player-name">{name}</span>{' '}
          {isYou && <span className="you-tag">(أنت)</span>}
          <div className={`conn ${connected ? '' : 'off'}`}>
            {connected ? 'متصل' : 'غير متصل'}
          </div>
        </div>
      </div>
      {typeof timeMs === 'number' ? (
        <Clock ms={timeMs} running={clockRunning} isMine={isYou} />
      ) : (
        <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
          {color === 'white' ? 'أبيض' : 'أسود'}
        </span>
      )}
    </div>
  );
}

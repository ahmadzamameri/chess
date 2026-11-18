/** حالة البحث عن منافس + زر إلغاء البحث. */

interface Props {
  onCancel: () => void;
}

export default function MatchmakingStatus({ onCancel }: Props) {
  return (
    <div className="searching">
      <div className="spinner" aria-hidden />
      <p style={{ margin: 0 }}>جارٍ البحث عن منافس…</p>
      <button className="btn-ghost" onClick={onCancel}>
        إلغاء البحث
      </button>
    </div>
  );
}

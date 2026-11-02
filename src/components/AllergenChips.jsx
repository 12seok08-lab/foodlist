// 알레르기 표시. 점선 = 라인공유
export default function AllergenChips({ list }) {
  if (!list.length) return <span className="muted">없음</span>;
  return list.map(a => (
    <span key={a.allergen} className={`chip${a.type === '라인공유' ? ' line' : ''}`} title={a.type}>
      {a.allergen}
    </span>
  ));
}

import { OPTIONS } from '../constants.js';

// 검색 · 분류 · 알레르기 필터
export default function Filters({ value, onChange, onReset }) {
  const set = key => e => onChange({ ...value, [key]: e.target.value });
  return (
    <div className="filters">
      <input type="search" className="grow" placeholder="상품명 · 코드 · 설명 검색" value={value.q} onChange={set('q')} />
      <select value={value.category} onChange={set('category')}>
        <option value="">전체 분류</option>
        {OPTIONS.category.map(c => <option key={c}>{c}</option>)}
      </select>
      <input placeholder="알레르기 (예: 견과류)" size={14} value={value.allergen} onChange={set('allergen')} />
      <select value={value.allergenMode} onChange={set('allergenMode')}>
        <option value="include">있는 상품</option>
        <option value="exclude">없는 상품</option>
      </select>
      <button onClick={onReset}>초기화</button>
    </div>
  );
}

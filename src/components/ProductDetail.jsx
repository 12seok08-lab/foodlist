import { useEffect, useState } from 'react';
import * as api from '../api.js';
import { amount, won } from '../constants.js';
import AllergenChips from './AllergenChips.jsx';

function Section({ title, items, render }) {
  return (
    <>
      <h3>{title}</h3>
      {items.length ? <ul>{items.map(render)}</ul> : <div className="muted">정보 없음</div>}
    </>
  );
}

// 선택한 상품의 상세 정보와 삭제 버튼
export default function ProductDetail({ id, reloadKey, onDelete }) {
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) { setProduct(null); return; }
    let cancelled = false;
    api.getProduct(id)
      .then(p => { if (!cancelled) { setProduct(p); setError(''); } })
      .catch(e => { if (!cancelled) { setProduct(null); setError(e.message); } });
    return () => { cancelled = true; };
  }, [id, reloadKey]);

  let content;
  if (!id) content = <div className="empty">목록에서 상품을 선택하세요</div>;
  else if (error) content = <div className="empty">불러오지 못했습니다: {error}</div>;
  else if (!product || product.product_id !== id) content = <div className="empty">불러오는 중…</div>;
  else {
    const p = product;
    content = (
      <>
        <div className="muted">{p.product_id} · {p.category}</div>
        <h2>{p.name}</h2>
        <div>{amount(p)} · {won(p.price)}</div>
        {p.description && <p>{p.description}</p>}
        <Section title="원재료 · 원산지" items={p.ingredients}
          render={(i, k) => <li key={k}>{i.ingredient}{i.origin && ` — ${i.origin}`}</li>} />
        <Section title="보관" items={p.storage}
          render={(s, k) => <li key={k}>{s.condition} · {s.method} {s.period_value}{s.period_unit}</li>} />
        <h3>알레르기</h3>
        <div>
          <AllergenChips list={p.allergens} />
          {p.allergens.length > 0 && <span className="muted"> (점선: 라인공유)</span>}
        </div>
        <Section title="안내 문구" items={p.notices}
          render={(n, k) => (
            <li key={k}><span className={`chip${n.important ? ' important' : ''}`}>{n.type}</span> {n.content}</li>
          )} />
        <div className="actions">
          <button className="danger" onClick={() => onDelete(p)}>상품 삭제</button>
        </div>
      </>
    );
  }

  return <aside className="panel detail">{content}</aside>;
}

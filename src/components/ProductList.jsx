import { amount, won } from '../constants.js';
import AllergenChips from './AllergenChips.jsx';

// 상품 목록 표
export default function ProductList({ products, error, selectedId, onSelect }) {
  let body;
  if (error) body = <tr><td colSpan={6} className="empty">불러오지 못했습니다: {error}</td></tr>;
  else if (!products.length) body = <tr><td colSpan={6} className="empty">조건에 맞는 상품이 없습니다</td></tr>;
  else body = products.map(p => (
    <tr key={p.product_id} className={p.product_id === selectedId ? 'selected' : ''} onClick={() => onSelect(p.product_id)}>
      <td>{p.product_id}</td>
      <td>{p.name}</td>
      <td>{p.category}</td>
      <td>{amount(p)}</td>
      <td className="num">{won(p.price)}</td>
      <td><AllergenChips list={p.allergens} /></td>
    </tr>
  ));

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>코드</th><th>상품명</th><th>분류</th><th>용량</th><th className="num">가격</th><th>알레르기</th></tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </div>
      <div className="count">{error ? '' : `${products.length}개 상품`}</div>
    </>
  );
}

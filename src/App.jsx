import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from './api.js';
import ProductList from './components/ProductList.jsx';
import ProductDetail from './components/ProductDetail.jsx';
import ProductForm from './components/ProductForm.jsx';
import Filters from './components/Filters.jsx';

const EMPTY_FILTERS = { q: '', category: '', allergen: '', allergenMode: 'include' };

export default function App() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [products, setProducts] = useState([]);
  const [listError, setListError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const toastTimer = useRef();

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), isError ? 5000 : 2500);
  }, []);

  // 검색어 입력은 0.25초 기다렸다가 조회
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      api.listProducts(filters)
        .then(rows => { if (!cancelled) { setProducts(rows); setListError(''); } })
        .catch(e => { if (!cancelled) { setProducts([]); setListError(e.message); } });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [filters, reloadKey]);

  const reload = () => setReloadKey(k => k + 1);

  async function handleCreate(body) {
    const p = await api.createProduct(body); // 실패하면 폼에서 오류 표시
    setFormOpen(false);
    showToast(`${p.name} 추가됨`);
    setSelectedId(p.product_id);
    reload();
  }

  async function handleDelete(p) {
    const ok = window.confirm(
      `${p.product_id} ${p.name} 을(를) 삭제할까요?\n원재료 · 보관 · 알레르기 · 안내 문구도 함께 삭제되며 되돌릴 수 없습니다.`,
    );
    if (!ok) return;
    try {
      await api.deleteProduct(p.product_id);
      showToast(`${p.name} 삭제됨`);
      setSelectedId(null);
      reload();
    } catch (e) {
      showToast(`삭제 실패: ${e.message}`, true);
    }
  }

  return (
    <>
      <header className="topbar">
        <h1>상품 관리</h1>
        <span className="tag">가상 상품 · 실습 전용 · 로컬</span>
        <span className="spacer" />
        <button className="primary" onClick={() => setFormOpen(true)}>+ 상품 추가</button>
      </header>

      <main className="layout">
        <section className="panel">
          <Filters value={filters} onChange={setFilters} onReset={() => setFilters(EMPTY_FILTERS)} />
          <ProductList products={products} error={listError} selectedId={selectedId} onSelect={setSelectedId} />
        </section>
        <ProductDetail id={selectedId} reloadKey={reloadKey} onDelete={handleDelete} />
      </main>

      {formOpen && <ProductForm onSubmit={handleCreate} onClose={() => setFormOpen(false)} />}

      <div className={`toast${toast ? ' show' : ''}${toast?.isError ? ' error' : ''}`} role="status">
        {toast?.message}
      </div>
    </>
  );
}

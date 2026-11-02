import { useEffect, useRef, useState } from 'react';
import { OPTIONS } from '../constants.js';

// 하위 정보 입력 행 정의: 필드명, 입력 종류, 선택지 키 또는 placeholder, 크기
const SECTIONS = {
  ingredients: {
    title: '원재료 · 원산지',
    required: 'ingredient',
    fields: [['ingredient', 'text', '원재료 *'], ['origin', 'text', '원산지']],
  },
  storage: {
    title: '보관',
    required: 'period_value',
    fields: [['condition', 'select', 'condition'], ['method', 'select', 'method'],
             ['period_value', 'number', '기간 *'], ['period_unit', 'select', 'period_unit']],
  },
  allergens: {
    title: '알레르기',
    required: 'allergen',
    fields: [['allergen', 'text', '알레르기 물질 *'], ['type', 'select', 'allergen_type']],
  },
  notices: {
    title: '안내 문구',
    required: 'content',
    fields: [['type', 'select', 'notice_type'], ['content', 'text', '내용 *', 'grow'], ['important', 'check', '강조', 'narrow']],
  },
};

let nextKey = 1;
function emptyRow(section) {
  const row = { _key: nextKey++ };
  for (const [name, kind, extra] of SECTIONS[section].fields) {
    row[name] = kind === 'select' ? OPTIONS[extra][0] : kind === 'check' ? false : '';
  }
  return row;
}

const EMPTY_PRODUCT = {
  product_id: '', name: '', category: OPTIONS.category[0], net_amount: '', unit: OPTIONS.unit[0],
  pack_desc: '', price: '', description: '',
};

function RowField({ field, value, onChange }) {
  const [name, kind, extra, size] = field;
  if (kind === 'select') {
    return (
      <select className={size} value={value} onChange={e => onChange(name, e.target.value)}>
        {OPTIONS[extra].map(o => <option key={o}>{o}</option>)}
      </select>
    );
  }
  if (kind === 'check') {
    return (
      <label className={`muted ${size || ''}`}>
        <input type="checkbox" checked={value} onChange={e => onChange(name, e.target.checked)} /> {extra}
      </label>
    );
  }
  return (
    <input className={size} type={kind} placeholder={extra} value={value}
      min={kind === 'number' ? 1 : undefined} step={kind === 'number' ? 1 : undefined}
      onChange={e => onChange(name, e.target.value)} />
  );
}

// 상품 추가 폼 (모달)
export default function ProductForm({ onSubmit, onClose }) {
  const dialogRef = useRef();
  const [product, setProduct] = useState(EMPTY_PRODUCT);
  const [rows, setRows] = useState(() =>
    Object.fromEntries(Object.keys(SECTIONS).map(s => [s, [emptyRow(s)]])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dlg = dialogRef.current;
    dlg.showModal();
    return () => dlg.close();
  }, []);

  const setField = key => e => setProduct(p => ({ ...p, [key]: e.target.value }));
  const addRow = s => setRows(r => ({ ...r, [s]: [...r[s], emptyRow(s)] }));
  const removeRow = (s, key) => setRows(r => ({ ...r, [s]: r[s].filter(x => x._key !== key) }));
  const updateRow = (s, key) => (name, value) =>
    setRows(r => ({ ...r, [s]: r[s].map(x => (x._key === key ? { ...x, [name]: value } : x)) }));

  // 필수 칸이 빈 행은 버리고, 숫자 칸은 숫자로 바꿔 보냄
  function collect(section) {
    const { fields, required } = SECTIONS[section];
    return rows[section]
      .filter(r => String(r[required]).trim() !== '')
      .map(r => Object.fromEntries(fields.map(([name, kind]) => {
        const v = r[name];
        if (kind === 'number') return [name, Number(v)];
        if (kind === 'text') return [name, v.trim()];
        return [name, v];
      })));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        product: {
          ...product,
          product_id: product.product_id.trim().toUpperCase(),
          name: product.name.trim(),
          net_amount: Number(product.net_amount),
          price: Number(product.price),
          pack_desc: product.pack_desc.trim(),
          description: product.description.trim(),
        },
        ingredients: collect('ingredients'),
        storage: collect('storage'),
        allergens: collect('allergens'),
        notices: collect('notices'),
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialogRef} onCancel={e => { e.preventDefault(); onClose(); }}>
      <form onSubmit={handleSubmit}>
        <h2>상품 추가</h2>
        <fieldset>
          <legend>기본 정보</legend>
          <div className="grid">
            <label>상품 코드 *<input required pattern="[Pp]-[0-9]{4}" placeholder="P-0500" value={product.product_id} onChange={setField('product_id')} /></label>
            <label className="wide">상품명 *<input required value={product.name} onChange={setField('name')} /></label>
            <label>분류 *
              <select value={product.category} onChange={setField('category')}>
                {OPTIONS.category.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>용량 *<input required type="number" step="0.01" min="0.01" value={product.net_amount} onChange={setField('net_amount')} /></label>
            <label>단위 *
              <select value={product.unit} onChange={setField('unit')}>
                {OPTIONS.unit.map(u => <option key={u}>{u}</option>)}
              </select>
            </label>
            <label>구성<input placeholder="예: 7~9개" value={product.pack_desc} onChange={setField('pack_desc')} /></label>
            <label>가격(원) *<input required type="number" min="0" step="1" value={product.price} onChange={setField('price')} /></label>
            <label className="full">설명<textarea rows={2} value={product.description} onChange={setField('description')} /></label>
          </div>
        </fieldset>

        {Object.entries(SECTIONS).map(([section, { title, fields }]) => (
          <fieldset key={section}>
            <legend>{title}</legend>
            <div className="rows">
              {rows[section].map(r => (
                <div className="row" key={r._key}>
                  {fields.map(f => <RowField key={f[0]} field={f} value={r[f[0]]} onChange={updateRow(section, r._key)} />)}
                  <button type="button" className="link narrow" title="행 삭제" onClick={() => removeRow(section, r._key)}>✕</button>
                </div>
              ))}
            </div>
            <button type="button" className="link" onClick={() => addRow(section)}>+ 행 추가</button>
          </fieldset>
        ))}

        {error && <div className="form-error">저장 실패: {error}</div>}
        <div className="form-actions">
          <button type="button" onClick={onClose}>취소</button>
          <button type="submit" className="primary" disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      </form>
    </dialog>
  );
}

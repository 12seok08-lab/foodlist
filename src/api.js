// 로컬 서버(/api) 호출. Supabase 키는 서버에만 있다

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `오류 (${res.status})`);
  return data;
}

export function listProducts(filters) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  if (filters.allergen) {
    params.set('allergen', filters.allergen);
    params.set('allergen_mode', filters.allergenMode);
  }
  return request('GET', `/api/products?${params}`);
}

export const getProduct = id => request('GET', `/api/products/${id}`);
export const createProduct = body => request('POST', '/api/products', body);
export const deleteProduct = id => request('DELETE', `/api/products/${id}`);

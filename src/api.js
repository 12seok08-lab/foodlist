// 서버(/api) 호출. Supabase 키는 서버에만 있다
// 서버에 ADMIN_PASSWORD 가 설정되어 있으면 추가 · 삭제 때 비밀번호를 묻고, 이 탭에서만 기억한다

const PW_KEY = 'admin-password';

function savedPassword() {
  try { return sessionStorage.getItem(PW_KEY) || ''; } catch { return ''; }
}
function savePassword(pw) {
  try { pw ? sessionStorage.setItem(PW_KEY, pw) : sessionStorage.removeItem(PW_KEY); } catch { /* 저장 못 해도 동작 */ }
}

async function request(method, url, body, retried = false) {
  const headers = body ? { 'Content-Type': 'application/json' } : {};
  if (method !== 'GET' && savedPassword()) headers['X-Admin-Password'] = savedPassword();
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  // 비밀번호가 없거나 틀리면 한 번 물어보고 다시 시도
  if (res.status === 401 && !retried) {
    const pw = window.prompt(data.message === '비밀번호가 맞지 않습니다' && savedPassword()
      ? '비밀번호가 맞지 않습니다. 다시 입력하세요'
      : '추가 · 삭제 비밀번호를 입력하세요');
    if (pw) {
      savePassword(pw);
      return request(method, url, body, true);
    }
  }
  if (res.status === 401) savePassword('');
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

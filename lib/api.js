// /api/* 공용 처리: 로컬 서버(server.js)와 Vercel 함수(api/)가 함께 쓴다
// Supabase 키는 서버 쪽 환경 변수에만 두고, 브라우저에는 보내지 않는다
import crypto from 'node:crypto';

// 환경 변수는 요청마다 읽는다 (server.js 가 .env.local 을 읽은 뒤에도 반영되도록)
function config() {
  const c = {
    url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    adminPassword: process.env.ADMIN_PASSWORD || '',
  };
  const missing = [['SUPABASE_URL', c.url], ['SUPABASE_ANON_KEY', c.anonKey], ['SUPABASE_SERVICE_ROLE_KEY', c.serviceKey]]
    .filter(([, v]) => !v).map(([k]) => k);
  return { ...c, missing };
}

// 시작할 때 빠진 설정 확인용 (server.js)
export const missingEnv = () => config().missing;

// ── Supabase REST(PostgREST) 호출 ─────────────────────
// 조회는 anon 키(RLS 읽기 정책 적용), 추가 · 삭제는 service_role 키
async function rest(method, pathAndQuery, body) {
  const c = config();
  const key = method === 'GET' ? c.anonKey : c.serviceKey;
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  // 예전 키(JWT, eyJ…)는 Authorization 헤더도 필요. 새 sb_publishable_ · sb_secret_ 키는 apikey 만 사용
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  if (method === 'POST') headers.Prefer = 'return=representation';
  const res = await fetch(`${c.url}/rest/v1/${pathAndQuery}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!res.ok) throw httpError(res.status >= 500 ? 502 : 400, friendlyMessage(data, res.status), data);
  return data;
}

// 자주 나는 Postgres 오류를 한국어로
const PG_ERRORS = {
  23505: '이미 있는 값입니다 (상품 코드 또는 같은 상품 안의 원재료 · 알레르기 · 보관 조건 중복)',
  23514: '허용되지 않은 값입니다',
  23503: '없는 상품 코드입니다',
  23502: '필수 값이 비어 있습니다',
  '22P02': '숫자 칸에 숫자가 아닌 값이 있습니다',
};
function friendlyMessage(data, status) {
  const ko = PG_ERRORS[data?.code];
  if (ko) return `${ko} — ${data.message}`;
  return data?.message || `Supabase 오류 (${status})`;
}

function httpError(status, message, detail) {
  return Object.assign(new Error(message), { status, detail });
}

const ID_RE = /^P-[0-9]{4}$/;

// PostgREST 필터 안에서 문제 되는 문자 제거
function cleanSearch(s) {
  return String(s || '').replace(/[,()*\\"]/g, ' ').trim().slice(0, 50);
}

// ── API ───────────────────────────────────────────────
// 목록 · 검색: 상품명 · 코드 · 설명에서 검색, 분류와 알레르기로 거르기
async function listProducts(params) {
  const q = new URLSearchParams({ select: '*', order: 'product_id' });
  const text = cleanSearch(params.get('q'));
  if (text) q.set('or', `(name.ilike.*${text}*,product_id.ilike.*${text}*,description.ilike.*${text}*)`);
  const category = params.get('category');
  if (category) q.set('category', `eq.${category}`);
  const allergen = cleanSearch(params.get('allergen'));
  if (allergen) {
    const cond = `cs.${JSON.stringify([{ allergen }])}`;
    q.set('allergens', params.get('allergen_mode') === 'exclude' ? `not.${cond}` : cond);
  }
  return rest('GET', `product_details?${q}`);
}

async function getProduct(id) {
  const rows = await rest('GET', `product_details?select=*&product_id=eq.${id}`);
  if (!rows.length) throw httpError(404, '상품을 찾을 수 없습니다');
  return rows[0];
}

// 추가: 상품을 먼저 넣고 하위 정보를 넣는다. 하위 정보에서 실패하면 상품을 지워 되돌린다
async function createProduct(body) {
  const p = body.product || {};
  if (!ID_RE.test(p.product_id || '')) throw httpError(400, '상품 코드는 P-0000 형식이어야 합니다');
  const product = {
    product_id: p.product_id,
    name: p.name,
    category: p.category,
    net_amount: p.net_amount,
    unit: p.unit,
    pack_desc: p.pack_desc || null,
    price: p.price,
    description: p.description || null,
  };
  await rest('POST', 'products', product);

  const id = product.product_id;
  const pick = (rows, keys) => (Array.isArray(rows) ? rows : [])
    .map(r => Object.fromEntries([['product_id', id], ...keys.map(k => [k, r[k] === '' ? null : r[k]])]));
  const children = [
    ['ingredients', pick(body.ingredients, ['ingredient', 'origin'])],
    ['storage', pick(body.storage, ['condition', 'method', 'period_value', 'period_unit'])],
    ['allergens', pick(body.allergens, ['allergen', 'type'])],
    ['notices', pick(body.notices, ['type', 'content', 'important'])],
  ];
  try {
    for (const [table, rows] of children) {
      if (rows.length) await rest('POST', table, rows);
    }
  } catch (e) {
    await rest('DELETE', `products?product_id=eq.${id}`).catch(() => {});
    throw e;
  }
  return getProduct(id);
}

// 삭제: 하위 정보는 외래 키 on delete cascade 로 함께 삭제
async function deleteProduct(id) {
  await rest('DELETE', `products?product_id=eq.${id}`);
  return { deleted: id };
}

// 추가 · 삭제 비밀번호 확인. ADMIN_PASSWORD 가 비어 있으면 확인하지 않는다
function checkWrite(req) {
  const expected = config().adminPassword;
  if (!expected) return;
  const given = String(req.headers['x-admin-password'] || '');
  const hash = s => crypto.createHash('sha256').update(s).digest();
  if (!crypto.timingSafeEqual(hash(given), hash(expected))) throw httpError(401, '비밀번호가 맞지 않습니다');
}

// ── HTTP ──────────────────────────────────────────────
function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function readJson(req) {
  // Vercel 은 JSON 본문을 미리 읽어 req.body 에 넣어 준다
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1e6) reject(httpError(413, '요청이 너무 큽니다'));
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(httpError(400, 'JSON 형식이 잘못되었습니다')); }
    });
  });
}

// /api/* 처리. 처리했으면 true
export async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return false;
  try {
    const { missing } = config();
    if (missing.length) throw httpError(500, `서버 환경 변수가 비어 있습니다: ${missing.join(', ')}`);
    if (url.pathname === '/api/products') {
      if (req.method === 'GET') return send(res, 200, await listProducts(url.searchParams)), true;
      if (req.method === 'POST') {
        checkWrite(req);
        return send(res, 201, await createProduct(await readJson(req))), true;
      }
    }
    const m = url.pathname.match(/^\/api\/products\/(P-[0-9]{4})$/);
    if (m) {
      if (req.method === 'GET') return send(res, 200, await getProduct(m[1])), true;
      if (req.method === 'DELETE') {
        checkWrite(req);
        return send(res, 200, await deleteProduct(m[1])), true;
      }
    }
    send(res, 404, { message: '없는 주소입니다' });
  } catch (e) {
    send(res, e.status || 500, { message: e.message, detail: e.detail });
  }
  return true;
}

// 가상 상품 관리용 로컬 서버 (실습 전용, 이 PC 에서만 접속 가능)
// Supabase 키는 이 서버에만 두고(.env.local), 브라우저에는 보내지 않는다
// npm run dev  → Vite 개발 모드(수정하면 바로 반영)
// npm start    → 빌드된 dist/ 를 제공
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV = process.argv.includes('--dev');

// ── 설정 읽기 (외부 패키지 없이) ──────────────────────
// .env.local 을 먼저 읽고, 없는 값만 .env 에서 채운다 (이미 있는 환경 변수가 우선)
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && m[2] !== '' && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv(path.join(__dirname, '.env.local'));
loadEnv(path.join(__dirname, '.env'));

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);

const missing = [['SUPABASE_URL', SUPABASE_URL], ['SUPABASE_ANON_KEY', ANON_KEY], ['SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY]]
  .filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`.env.local 에 값을 넣어 주세요: ${missing.join(', ')}`);
  process.exit(1);
}

// ── Supabase REST(PostgREST) 호출 ─────────────────────
// 조회는 anon 키(RLS 읽기 정책 적용), 추가 · 삭제는 service_role 키
async function rest(method, pathAndQuery, body) {
  const key = method === 'GET' ? ANON_KEY : SERVICE_KEY;
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  // 예전 키(JWT, eyJ…)는 Authorization 헤더도 필요. 새 sb_publishable_ · sb_secret_ 키는 apikey 만 사용
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  if (method === 'POST') headers.Prefer = 'return=representation';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
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

// ── HTTP ──────────────────────────────────────────────
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readJson(req) {
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
async function handleApi(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (!url.pathname.startsWith('/api/')) return false;
  try {
    if (url.pathname === '/api/products') {
      if (req.method === 'GET') return send(res, 200, await listProducts(url.searchParams)), true;
      if (req.method === 'POST') return send(res, 201, await createProduct(await readJson(req))), true;
    }
    const m = url.pathname.match(/^\/api\/products\/(P-[0-9]{4})$/);
    if (m) {
      if (req.method === 'GET') return send(res, 200, await getProduct(m[1])), true;
      if (req.method === 'DELETE') return send(res, 200, await deleteProduct(m[1])), true;
    }
    send(res, 404, { message: '없는 주소입니다' });
  } catch (e) {
    send(res, e.status || 500, { message: e.message, detail: e.detail });
  }
  return true;
}

// 빌드된 정적 파일 제공 (npm start)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
function serveDist(req, res) {
  const dist = path.join(__dirname, 'dist');
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(dist, urlPath);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('dist/ 가 없습니다. npm start 로 빌드 후 실행하세요');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

let vite = null;
if (DEV) {
  const { createServer } = await import('vite');
  vite = await createServer({ root: __dirname, server: { middlewareMode: true }, appType: 'spa' });
}

const server = http.createServer(async (req, res) => {
  if (await handleApi(req, res)) return;
  if (vite) vite.middlewares(req, res);
  else serveDist(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`상품 관리 페이지: http://${HOST}:${PORT}${DEV ? ' (개발 모드)' : ''}`);
});

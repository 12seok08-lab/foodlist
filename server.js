// 가상 상품 관리용 로컬 서버 (실습 전용, 이 PC 에서만 접속 가능)
// Supabase 키는 이 서버에만 두고(.env.local), 브라우저에는 보내지 않는다
// npm run dev  → Vite 개발 모드(수정하면 바로 반영)
// npm start    → 빌드된 dist/ 를 제공
// Vercel 배포에서는 이 파일 대신 api/ 의 함수가 같은 lib/api.js 를 사용한다
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi, missingEnv } from './lib/api.js';

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

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);

const missing = missingEnv();
if (missing.length) {
  console.error(`.env.local 에 값을 넣어 주세요: ${missing.join(', ')}`);
  process.exit(1);
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

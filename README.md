# 상품 관리 페이지 (실습 전용 · 로컬)

`docs/dummy/supabase/` 의 가상 상품 DB 를 조회 · 검색 · 추가 · 삭제하는 React 페이지.
이 PC(`127.0.0.1`)에서만 열리며, Supabase 키는 로컬 서버(`server.js`)에만 있다.

## 준비

1. Supabase SQL Editor 에서 `../supabase/schema.sql` → `../supabase/seed.sql` 실행
2. 이 폴더의 `.env.local` 에 세 값 입력 (Supabase 대시보드 → Project Settings → API Keys / Data API)

   | 변수 | 값 | 쓰임 |
   |---|---|---|
   | `SUPABASE_URL` | 프로젝트 URL | 연결 주소 |
   | `SUPABASE_ANON_KEY` | anon 키 (또는 `sb_publishable_…`) | 조회 · 검색 (RLS 읽기 정책 적용) |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 (또는 `sb_secret_…`) | 추가 · 삭제 |

   `VITE_` 로 시작하지 않는 이름이라 브라우저 코드에는 들어가지 않는다
3. 이 폴더에서 패키지 설치

```bash
npm install
```

## 실행

```bash
npm run dev
```

브라우저에서 http://127.0.0.1:3000 을 연다. 코드를 고치면 바로 반영된다.
(`npm start` 는 빌드한 뒤 같은 주소로 실행)

## 기능

| 기능 | 위치 |
|---|---|
| 목록 · 검색 (상품명 · 코드 · 설명) | 왼쪽 위 검색창 |
| 분류 · 알레르기 있는/없는 상품 거르기 | 검색창 옆 |
| 상세 보기 (원재료 · 보관 · 알레르기 · 안내 문구) | 목록에서 행 클릭 → 오른쪽 |
| 추가 | 오른쪽 위 `+ 상품 추가` |
| 삭제 (하위 정보 함께 삭제) | 상세 패널 아래 `상품 삭제` |

## 구조

```
server.js            로컬 서버: /api/* 를 Supabase REST 로 전달 + 페이지 제공
src/App.jsx          화면 전체 상태
src/components/      Filters · ProductList · ProductDetail · ProductForm · AllergenChips
src/constants.js     선택지 (schema.sql 의 check 제약과 같게 유지)
src/api.js           /api 호출
```
# foodlist

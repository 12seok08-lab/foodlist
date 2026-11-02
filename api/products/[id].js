// Vercel 함수: GET · DELETE /api/products/:id (처리는 lib/api.js)
import { handleApi } from '../../lib/api.js';

export default function handler(req, res) {
  return handleApi(req, res);
}

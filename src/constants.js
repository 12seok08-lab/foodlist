// schema.sql 의 check 제약과 같은 선택지
export const OPTIONS = {
  category: ['가공식품', '과일', '채소', '음료/청', '건강식품', '냉동식품'],
  unit: ['g', 'kg', 'ml'],
  condition: ['개봉 전', '개봉 후', '수령 후'],
  method: ['상온', '냉장', '냉동'],
  period_unit: ['일', '주', '개월'],
  allergen_type: ['함유', '라인공유'],
  notice_type: ['보관 금지', '조리·사용 금지', '보관 안내', '섭취·사용 안내', '섭취 주의', '판매 안내', '정보'],
};

export const won = n => `${Number(n).toLocaleString('ko-KR')}원`;
export const amount = p => `${Number(p.net_amount)}${p.unit}${p.pack_desc ? ` (${p.pack_desc})` : ''}`;

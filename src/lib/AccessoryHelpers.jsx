export const statusColors = {
  'สำรอง': { bg: '#3B82F6', color: '#FFFFFF' },
  'หมด': { bg: '#EF4444', color: '#FFFFFF' },
};

// คำนวณสถานะอัตโนมัติจากจำนวนคงเหลือ — 0 = หมด, มากกว่า 0 = สำรอง (สถานะมีแค่ 2 ค่านี้เท่านั้น)
export const computeStatus = (qty) => (Number(qty) > 0 ? 'สำรอง' : 'หมด');

// จัดรูปแบบราคาต่อหน่วยเป็นสกุลเงินบาท
export const formatPrice = (price) => {
  if (price === null || price === undefined || price === '') {
    return <span className="text-muted-foreground/40 font-mono text-xs">—</span>;
  }
  return <span>฿{Number(price).toLocaleString('th-TH')}</span>;
};

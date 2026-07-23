import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { ChevronDown } from 'lucide-react';

/**
 * ดรอปดาวน์ค้นหาแผนก — พอร์ตมาจาก SearchableDropdown ใน DeviceFormDialog.jsx แบบเดียวกันเป๊ะๆ
 * (พิมพ์เพื่อกรอง, คลิกนอกกล่องเพื่อปิดเองด้วย ref, ไอคอน ChevronDown, ไฮไลต์ตัวที่เลือกอยู่,
 * ข้อความ "ไม่พบ..." เมื่อไม่มีตัวเลือกตรงกับคำค้นหา)
 * พฤติกรรมเหมือนต้นฉบับ: การพิมพ์เป็นแค่ตัวกรอง ค่าจริงของฟิลด์จะถูกตั้งก็ต่อเมื่อ "คลิกเลือก" จากลิสต์เท่านั้น
 * (พิมพ์ค้างไว้เฉยๆ โดยไม่คลิกเลือก ค่าจริงจะว่าง — เลือกได้เฉพาะแผนกที่มีอยู่แล้วในลิสต์ เหมือนหน้า Devices)
 */
// เผื่อพื้นที่ขอบบน/ล่างของกล่อง dialog ที่เลื่อนได้ ไม่ให้ลิสต์ไปชนขอบพอดีเป๊ะ
const EDGE_MARGIN = 12;
// ความสูงสูงสุดที่อยากได้ตามปกติเมื่อมีพื้นที่พอ
const PREFERRED_MAX_HEIGHT = 192;
// ถ้าที่ว่างต่ำกว่านี้ ให้เปิดขึ้นด้านบนแทนด้านล่าง
const MIN_SPACE_TO_OPEN_DOWN = 120;

export default function DepartmentDropdown({ value, onChange, options, error, onClearError }) {
  const [search, setSearch] = useState(value || '');
  const [open, setOpen] = useState(false);
  // ทิศทางที่ลิสต์จะกาง + ความสูงสูงสุดที่คำนวณจากพื้นที่ว่างจริง (ในกรอบ dialog ที่เลื่อนได้)
  const [dropUp, setDropUp] = useState(false);
  const [maxHeight, setMaxHeight] = useState(PREFERRED_MAX_HEIGHT);
  const ref = useRef(null);
  const inputWrapRef = useRef(null);

  useEffect(() => setSearch(value || ''), [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // หา ancestor ที่เลื่อนได้ (ตัว dialog เอง) เพื่อใช้ขอบเขตจริงแทน viewport ทั้งหน้า
  // กันลิสต์ยื่นเลย dialog ลงไปด้านล่างแม้ตัว dialog จะไม่ได้ชิดขอบจอ
  const getScrollParent = (el) => {
    let node = el?.parentElement;
    while (node) {
      const style = window.getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY)) return node;
      node = node.parentElement;
    }
    return null;
  };

  // คำนวณทิศทาง (ขึ้น/ลง) และความสูงสูงสุดจากพื้นที่ว่างจริง ก่อนเปิดลิสต์ทุกครั้ง
  const calculatePosition = () => {
    const inputEl = inputWrapRef.current;
    if (!inputEl) return;

    const inputRect = inputEl.getBoundingClientRect();
    const scrollParent = getScrollParent(inputEl);
    const boundaryBottom = scrollParent
      ? scrollParent.getBoundingClientRect().bottom
      : window.innerHeight;
    const boundaryTop = scrollParent
      ? scrollParent.getBoundingClientRect().top
      : 0;

    const spaceBelow = boundaryBottom - inputRect.bottom - EDGE_MARGIN;
    const spaceAbove = inputRect.top - boundaryTop - EDGE_MARGIN;

    if (spaceBelow < MIN_SPACE_TO_OPEN_DOWN && spaceAbove > spaceBelow) {
      setDropUp(true);
      setMaxHeight(Math.max(80, Math.min(PREFERRED_MAX_HEIGHT, spaceAbove)));
    } else {
      setDropUp(false);
      setMaxHeight(Math.max(80, Math.min(PREFERRED_MAX_HEIGHT, spaceBelow)));
    }
  };

  const openDropdown = () => {
    calculatePosition();
    setOpen(true);
  };

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase().trim()));

  const handleSelect = (dept) => {
    onChange(dept);
    setSearch(dept);
    onClearError?.();
    setOpen(false);
  };

  return (
    <div className="space-y-1 relative" ref={ref}>
      <label className={`text-sm font-medium ${error ? 'text-red-500' : ''}`}>แผนก *</label>
      <div className="relative" ref={inputWrapRef}>
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            openDropdown();
            if (value) onChange(''); // เหมือนต้นฉบับ: พิมพ์แล้วเคลียร์ค่าจริงจนกว่าจะคลิกเลือกจากลิสต์
          }}
          onClick={openDropdown}
          placeholder={error ? error : 'ค้นหาแผนก'}
          className={`pr-7 ${error ? 'border-red-500 bg-red-50/20 text-red-500 placeholder:text-red-400 focus-visible:ring-red-500' : ''}`}
        />
        <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      </div>

      {open && (
        <div
          className={`absolute z-20 w-full bg-white border rounded-md shadow-lg overflow-y-auto ${
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
          style={{ maxHeight }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground text-center">ไม่พบแผนกที่ตรงกับคำค้นหา</div>
          ) : (
            filtered.map((d) => (
              <div
                key={d}
                onClick={() => handleSelect(d)}
                className={`px-3 py-2 text-xs cursor-pointer hover:bg-muted/60 transition-colors ${
                  value === d ? 'bg-primary/10 font-semibold' : ''
                }`}
              >
                {d}
              </div>
            ))
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}
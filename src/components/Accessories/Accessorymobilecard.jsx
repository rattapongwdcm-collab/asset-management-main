import { Button } from '@/components/ui/button';
import { PackagePlus, PackageMinus } from 'lucide-react';
import { statusColors, formatPrice } from '../Accessories/Accessoryhelpers';
/**
 * การ์ดแถวเดียวสำหรับ mobile view (< md)
 * ดีไซน์: ชื่อ + badge สถานะด้านบน, รายละเอียดยี่ห้อ/แผนกเป็น 2 คอลัมน์,
 * แถบเตือนสีเหลืองถ้ามีคำขอลบค้างอยู่ และไอคอนจัดการ (เพิ่ม/ตัดสต็อค) แถวล่างขวา
 * — guest ไม่เห็นปุ่มเพิ่มสต็อค (PackagePlus) เห็นแค่ปุ่มตัดสต๊อค
 */
export default function AccessoryMobileCard({ item, isLocked, isGuest, onView, onStockIn, onStockOut }) {
  return (
    <div
      className="bg-card border border-border rounded-xl p-4 space-y-3 cursor-pointer"
      onClick={() => onView(item)}
    >
      {/* แถวบน: ชื่ออุปกรณ์ + badge สถานะ */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm text-foreground truncate">{item.name}</p>
        <span
          className="px-2 py-1 rounded-full text-xs font-medium shrink-0"
          style={{
            background: statusColors[item.status]?.bg || '#F1F5F9',
            color: statusColors[item.status]?.color || '#000',
          }}
        >
          {item.status}
        </span>
      </div>

      {/* รายละเอียด 2 คอลัมน์: ยี่ห้อ / แผนก และ ราคา / จำนวน+หน่วย */}
      <div className="grid grid-cols-2 gap-y-1.5 text-xs">
        <div>
          <span className="text-muted-foreground">ยี่ห้อ: </span>
          <span className="text-foreground">{item.brand || '-'}</span>
        </div>
        <div>
          <span className="text-muted-foreground">แผนก: </span>
          <span className="text-foreground">{item.department || '-'}</span>
        </div>
        <div>
          <span className="text-muted-foreground">ราคา: </span>
          <span className="text-foreground">{formatPrice(item.price)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">จำนวน: </span>
          <span className="text-foreground">{item.quantity} {item.unit || ''}</span>
        </div>
      </div>

      {/* แถวล่าง: แถบเตือนคำขอลบค้าง (ถ้ามี) + ไอคอนจัดการ */}
      <div className="flex items-center justify-between pt-1">
        {isLocked ? (
          <span className="text-[11px] font-medium px-2 py-1 rounded-md bg-amber-50 text-amber-600">
            ⚠ รออนุมัติลบ
          </span>
        ) : <span />}

        <div className="flex gap-1">
          <Button
            variant="ghost" size="icon"
            disabled={isLocked || isGuest}
            className={`h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 ${(isLocked || isGuest) ? 'opacity-30 pointer-events-none' : ''}`}
            title={isGuest ? 'บัญชี guest เพิ่มสต็อคไม่ได้' : (isLocked ? 'ล็อกไว้ระหว่างรออนุมัติลบ' : 'เพิ่มสต็อค')}
            onClick={(e) => { e.stopPropagation(); onStockIn(item); }}
          >
            <PackagePlus size={16} />
          </Button>
          <Button
            variant="ghost" size="icon"
            disabled={isLocked}
            className={`h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 ${isLocked ? 'opacity-30 pointer-events-none' : ''}`}
            title={isLocked ? 'ล็อกไว้ระหว่างรออนุมัติลบ' : 'ตัดสต๊อค'}
            onClick={(e) => { e.stopPropagation(); onStockOut(item); }}
          >
            <PackageMinus size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
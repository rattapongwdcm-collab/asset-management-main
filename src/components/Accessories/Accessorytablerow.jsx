import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { PackagePlus, PackageMinus } from 'lucide-react';
import { statusColors, formatPrice } from '@/components/Accessories/accessoryHelpers';

/**
 * แถวตารางเดียวสำหรับ desktop/tablet view (md ขึ้นไป)
 * — guest ไม่เห็นปุ่มเพิ่มสต็อค (PackagePlus) เห็นแค่ปุ่มตัดสต๊อค
 */
export default function AccessoryTableRow({ item, isLocked, isGuest, onView, onStockIn, onStockOut }) {
  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => onView(item)}
      title={isLocked ? 'รายการนี้มีคำขอลบค้างอยู่ รอการอนุมัติ' : 'คลิกเพื่อดูรายละเอียด'}
    >
      <TableCell className="font-medium">
        {item.name}
        {isLocked && (
          <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 align-middle">
            รออนุมัติลบ
          </span>
        )}
      </TableCell>
      <TableCell>{item.brand || '-'}</TableCell>
      <TableCell>{item.department || '-'}</TableCell>
      <TableCell>
        <span
          className="px-2 py-1 rounded-md text-xs font-medium"
          style={{
            background: statusColors[item.status]?.bg || '#F1F5F9',
            color: statusColors[item.status]?.color || '#000',
          }}
        >
          {item.status}
        </span>
      </TableCell>
      <TableCell>{formatPrice(item.price)}</TableCell>
      <TableCell className="text-center">{item.quantity}</TableCell>
      <TableCell className="text-center">{item.unit || '-'}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
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
      </TableCell>
    </TableRow>
  );
}
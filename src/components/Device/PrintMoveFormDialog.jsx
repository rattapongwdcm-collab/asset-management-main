import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';

/**
 * Dialog แสดง preview ฟอร์มขอย้ายอุปกรณ์ และสั่งพิมพ์อัตโนมัติเมื่อเปิด
 *
 * props:
 * - open: boolean เปิด/ปิด dialog
 * - onClose: () => void เรียกตอนปิด
 * - data: {
 *     requestNo, requestDate, requestedBy,
 *     deviceName, assetTag, category,
 *     fromDepartment, toDepartment,
 *     installationLocation, assignedTo,
 *   }
 */
export default function PrintMoveFormDialog({ open, onClose, data }) {
  const hasPrintedRef = useRef(false);

  // เปิด print dialog ของ browser อัตโนมัติทุกครั้งที่ dialog นี้เปิดพร้อมข้อมูลใหม่
  useEffect(() => {
    if (open && data && !hasPrintedRef.current) {
      hasPrintedRef.current = true;
      const timer = setTimeout(() => {
        window.print();
      }, 350); // หน่วงให้ DOM render ฟอร์มเสร็จก่อนค่อยเรียกพิมพ์
      return () => clearTimeout(timer);
    }
    if (!open) {
      hasPrintedRef.current = false;
    }
  }, [open, data]);

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto print:max-w-none print:w-full print:max-h-none print:overflow-visible print:shadow-none print:border-none"
        style={{ backgroundColor: '#ffffff' }}
      >
        {/* แถบหัว — ซ่อนตอนพิมพ์ */}
        <div className="flex items-center justify-between border-b pb-3 mb-2 print:hidden">
          <h2 className="text-base font-bold text-foreground">ตัวอย่างฟอร์มขอย้ายอุปกรณ์</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => window.print()} className="gap-1.5">
              <Printer size={14} /> พิมพ์
            </Button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── เนื้อหาฟอร์มที่จะถูกพิมพ์จริง ── */}
        <div id="print-move-form" className="text-black px-2 py-1 print:px-0">
          <div className="text-center mb-6">
            <h1 className="text-lg font-bold">ใบขอย้ายอุปกรณ์ (Asset Transfer Request Form)</h1>
            <p className="text-xs text-gray-500 mt-1">เลขที่คำขอ: {data.requestNo || '-'}</p>
          </div>

          <table className="w-full text-sm border-collapse">
            <tbody>
              <Row label="วันที่ยื่นคำขอ" value={data.requestDate} />
              <Row label="ผู้ยื่นคำขอ" value={data.requestedBy} />
              <Row label="ชื่ออุปกรณ์" value={data.deviceName} />
              <Row label="รหัสอุปกรณ์ (Asset Tag)" value={data.assetTag} />
              <Row label="ประเภท" value={data.category} />
              <Row label="แผนกต้นทาง" value={data.fromDepartment || '-'} />
              <Row label="แผนกปลายทาง" value={data.toDepartment} highlight />
              <Row label="สถานที่ติดตั้งใหม่" value={data.installationLocation || '-'} />
              <Row label="ผู้รับมอบหมายใหม่" value={data.assignedTo} highlight />
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-8 mt-16 text-sm">
            <div className="text-center">
              <div className="border-b border-black w-full mb-2 h-10" />
              <p>ลงชื่อผู้ขอย้าย</p>
              <p className="text-xs text-gray-500 mt-1">วันที่ ____ / ____ / ____</p>
            </div>
            <div className="text-center">
              <div className="border-b border-black w-full mb-2 h-10" />
              <p>ลงชื่อผู้อนุมัติ</p>
              <p className="text-xs text-gray-500 mt-1">วันที่ ____ / ____ / ____</p>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* กฎการพิมพ์: ซ่อนทุกอย่างในหน้าเว็บ เหลือแค่ฟอร์มนี้ */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-move-form, #print-move-form * { visibility: visible; }
          #print-move-form {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
        }
      `}</style>
    </Dialog>
  );
}

function Row({ label, value, highlight }) {
  return (
    <tr className="border-b border-gray-200">
      <td className="py-2 pr-4 font-semibold text-gray-600 w-1/3 align-top">{label}</td>
      <td className={`py-2 ${highlight ? 'font-bold' : ''}`}>{value || '-'}</td>
    </tr>
  );
}
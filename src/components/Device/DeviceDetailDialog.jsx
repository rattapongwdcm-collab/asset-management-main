import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog'; // ⚠️ ตัด DialogHeader/DialogTitle ออก เพราะไม่ได้ใช้งานจริงในไฟล์นี้
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Monitor, User, Calendar, ShieldCheck, Tag, Info, Building2, Wallet, MapPin } from 'lucide-react';
import GodexPrintButton from '@/components/Device/GodexPrintButton';

// ── Helper: แปลงราคาให้มีคอมม่าคั่นหลักพัน ──────────────────────────────
function formatPrice(price) {
  if (price === null || price === undefined || price === '') return '—';
  const num = Number(price);
  return isNaN(num) ? '—' : `${num.toLocaleString('th-TH')} บาท`;
}

// ── Helper Components ───────────────────────────────────────────────────

/**
 * กล่องแสดงข้อมูล 1 รายการ (label + value) ใช้ซ้ำได้ทุกฟิลด์ในไดอะล็อกนี้
 * - icon: ไอคอนนำหน้าค่า (ถ้ามี)
 * - divider: ใส่เส้นคั่นด้านบน (ใช้กับฟิลด์ที่เพิ่มเข้ามาทีหลังในแต่ละ section)
 * - spanFull: ให้กว้างเต็ม 2 คอลัมน์บนจอ sm ขึ้นไป
 */
function InfoField({ label, value, icon: Icon, divider = false, spanFull = false }) {
  return (
    <div className={`w-full ${divider ? 'border-t border-dashed pt-3 mt-1' : ''} ${spanFull ? 'sm:col-span-2' : ''}`}>
      <Label className="text-muted-foreground text-xs font-medium">{label}</Label>
      <p className="mt-1 font-semibold text-sm bg-muted/40 px-3 py-2 rounded-lg border text-foreground/90 flex items-center gap-1.5 truncate">
        {Icon && <Icon size={14} className="opacity-60 text-primary shrink-0" />}
        {value || '—'}
      </p>
    </div>
  );
}

/** กรอบ section พร้อมหัวข้อ + ไอคอน ครอบกลุ่มฟิลด์ที่เกี่ยวข้องกัน */
function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-background rounded-xl border p-4 shadow-sm space-y-4 w-full">
      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
        <Icon size={14} className="text-primary" />
        {title}
      </h4>
      <div className="grid sm:grid-cols-2 gap-4 w-full">
        {children}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────
export default function DeviceDetailDialog({ isOpen, setIsOpen, detailItem, onPrintBarcode }) {
  const handleClose = () => setIsOpen(false);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      {/* ขนาด dialog: กว้างพอดีบนจอมือถือ (w-[92vw]) และขยายขึ้นตามจอที่ใหญ่ขึ้น (sm/lg) */}
      {/* h-[90vh] + flex-col ทำให้ dialog ไม่ล้นจอทั้งบนโน้ตบุ๊ก, จอ 24"/27" และมือถือ */}
      <DialogContent className="w-[92vw] max-w-2xl lg:max-w-3xl h-[90vh] flex flex-col sm:rounded-2xl p-0 overflow-hidden">
        {detailItem && (
          <>
            {/* ส่วนเนื้อหา: เลื่อน (scroll) ได้เฉพาะส่วนนี้ ปุ่มด้านล่างจะไม่เลื่อนตาม */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 w-full">
              <div className="space-y-6 w-full">

                {/* ส่วนหัว: รูปภาพ + รหัส/ชื่อ/สถานะ */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 bg-muted/20 p-4 rounded-2xl border w-full">
                  <div className="w-[130px] sm:w-[20%] shrink-0 aspect-square">
                    {detailItem.image_url ? (
                      <img
                        src={detailItem.image_url}
                        alt={detailItem.name}
                        className="w-full h-full object-cover rounded-xl border bg-background shadow-md"
                      />
                    ) : (
                      <div className="w-full h-full bg-background rounded-xl flex flex-col items-center justify-center text-xs text-muted-foreground border border-dashed text-center p-3">
                        <Monitor size={28} className="mb-1 opacity-40 text-muted-foreground" />
                        <span>ไม่มีรูปภาพ</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-center sm:text-left w-full sm:w-[80%]">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                      <Tag size={12} />
                      {detailItem.asset_tag || 'ไม่ระบุรหัส'}
                    </div>
                    <h3 className="text-xl font-bold text-foreground leading-tight break-words">{detailItem.name || '-'}</h3>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      <span className="text-xs px-2.5 py-1 bg-background border rounded-lg font-medium shadow-sm text-muted-foreground flex items-center gap-1">
                        <Info size={12} /> {detailItem.category || '-'}
                      </span>
                      <span className="text-xs px-2.5 py-1 bg-background border rounded-lg font-semibold shadow-sm text-primary flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                        {detailItem.status || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ข้อมูลผู้ถือครองและการจัดสรร */}
                <Section title="ข้อมูลผู้ถือครองและการจัดสรร" icon={User}>
                  <InfoField label="ผู้ได้รับมอบหมาย" value={detailItem.assigned_to} />
                  <InfoField label="ฝ่าย / แผนก" value={detailItem.department} />
                  <InfoField
                    label="สถานที่ติดตั้ง"
                    value={detailItem.installation_location}
                    icon={MapPin}
                    divider
                    spanFull
                  />
                </Section>

                {/* ข้อมูลวันที่ ราคา และการรับประกัน */}
                <Section title="ข้อมูลวันที่ ราคา และการรับประกัน" icon={ShieldCheck}>
                  <InfoField label="วันที่ซื้ออุปกรณ์" value={detailItem.purchase_date} icon={Calendar} />
                  <InfoField label="วันหมดอายุการรับประกัน" value={detailItem.warranty_expire} icon={Calendar} />
                  <InfoField label="ราคาที่ซื้อ" value={formatPrice(detailItem.purchase_price)} icon={Wallet} divider />
                  <InfoField label="บริษัท" value={detailItem.company} icon={Building2} divider />
                  <InfoField label="เบอร์ผู้ติดต่อบริษัท" value={detailItem.company_contact} divider />
                </Section>
              </div>
            </div>

            {/* แถบปุ่มด้านล่าง: ค้างอยู่กับที่เสมอ ไม่เลื่อนตามเนื้อหา, ปุ่มเรียงเต็มความกว้างบนมือถือ */}
            <div className="flex flex-col-reverse sm:flex-row justify-end items-stretch sm:items-center gap-2.5 border-t px-4 sm:px-6 py-3 shrink-0 bg-white">
              <Button className="hover:bg-[#111827] hover:text-white" variant="outline" onClick={handleClose}>
                ปิดหน้าต่าง
              </Button>
              <GodexPrintButton form={detailItem} onPrintBarcode={onPrintBarcode} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
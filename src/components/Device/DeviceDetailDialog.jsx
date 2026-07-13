import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Monitor, User, Calendar, ShieldCheck, Tag, Info, Building2, Wallet, MapPin } from 'lucide-react'; // ➕ เพิ่ม Wallet, MapPin สำหรับไอคอนราคา/สถานที่
import GodexPrintButton from '@/components/Device/GodexPrintButton';

export default function DeviceDetailDialog({ isOpen, setIsOpen, detailItem, onPrintBarcode }) {

  const handleClose = () => {
    setIsOpen(false);
  };

  // ✅ ฟังก์ชันจัดรูปแบบราคาให้มีคอมม่าคั่นหลักพัน
  const formatPrice = (price) => {
    if (price === null || price === undefined || price === "") return "—";
    const num = Number(price);
    if (isNaN(num)) return "—";
    return num.toLocaleString('th-TH') + " บาท";
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      {/* ✅ ปรับขนาดให้เท่ากับหน้าเพิ่มอุปกรณ์: max-w-2xl h-[90vh] flex flex-col p-0 overflow-hidden */}
      <DialogContent className="max-w-2xl h-[90vh] flex flex-col sm:rounded-2xl p-0 overflow-hidden">

        {detailItem && (
          <>
            {/* ✅ ส่วนเนื้อหา เลื่อนได้เฉพาะตรงนี้ */}
            <div className="flex-1 overflow-y-auto px-6 py-4 w-full">
              <div className="space-y-6 w-full">
                {/* ส่วนหัวภาพและการ์ดข้อมูลเบื้องต้น */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 bg-muted/20 p-4 rounded-2xl border w-full">
                  <div className="w-[130px] sm:w-[20%] shrink-0 aspect-square">
                    {detailItem?.image_url ? (
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
                      {detailItem.asset_tag || "ไม่ระบุรหัส"}
                    </div>
                    <h3 className="text-xl font-bold text-foreground leading-tight break-words">{detailItem.name || "-"}</h3>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      <span className="text-xs px-2.5 py-1 bg-background border rounded-lg font-medium shadow-sm text-muted-foreground flex items-center gap-1">
                        <Info size={12} /> {detailItem.category || "-"}
                      </span>
                      <span className="text-xs px-2.5 py-1 bg-background border rounded-lg font-semibold shadow-sm text-primary flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                        {detailItem.status || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ข้อมูลการจัดสรร */}
                <div className="bg-background rounded-xl border p-4 shadow-sm space-y-4 w-full">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                    <User size={14} className="text-primary" />
                    ข้อมูลผู้ถือครองและการจัดสรร
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-4 w-full">
                    <div className="w-full">
                      <Label className="text-muted-foreground text-xs font-medium">ผู้ได้รับมอบหมาย</Label>
                      <p className="mt-1 font-semibold text-sm bg-muted/40 px-3 py-2 rounded-lg border text-foreground/90 truncate">{detailItem.assigned_to || "—"}</p>
                    </div>
                    <div className="w-full">
                      <Label className="text-muted-foreground text-xs font-medium">ฝ่าย / แผนก</Label>
                      <p className="mt-1 font-semibold text-sm bg-muted/40 px-3 py-2 rounded-lg border text-foreground/90 truncate">{detailItem.department || "—"}</p>
                    </div>
                    {/* ✅ เพิ่ม: สถานที่ติดตั้ง */}
                    <div className="w-full border-t border-dashed pt-3 mt-1 sm:col-span-2">
                      <Label className="text-muted-foreground text-xs font-medium">สถานที่ติดตั้ง</Label>
                      <p className="mt-1 font-semibold text-sm bg-muted/40 px-3 py-2 rounded-lg border text-foreground/90 flex items-center gap-1.5 truncate">
                        <MapPin size={14} className="opacity-60 text-primary shrink-0" />
                        {detailItem.installation_location || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ข้อมูลการรับประกันและบริษัท */}
                <div className="bg-background rounded-xl border p-4 shadow-sm space-y-4 w-full">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                    <ShieldCheck size={14} className="text-primary" />
                    ข้อมูลวันที่ ราคา และการรับประกัน
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-4 w-full">
                    <div className="w-full">
                      <Label className="text-muted-foreground text-xs font-medium">วันที่ซื้ออุปกรณ์</Label>
                      <p className="mt-1 font-semibold text-sm bg-muted/40 px-3 py-2 rounded-lg border text-foreground/90 flex items-center gap-1.5">
                        <Calendar size={14} className="opacity-60" />
                        {detailItem.purchase_date || "—"}
                      </p>
                    </div>
                    <div className="w-full">
                      <Label className="text-muted-foreground text-xs font-medium">วันหมดอายุการรับประกัน</Label>
                      <p className="mt-1 font-semibold text-sm bg-muted/40 px-3 py-2 rounded-lg border text-foreground/90 flex items-center gap-1.5">
                        <Calendar size={14} className="opacity-60 text-primary" />
                        {detailItem.warranty_expire || "—"}
                      </p>
                    </div>

                    {/* ✅ เพิ่ม: ราคาที่ซื้อ */}
                    <div className="w-full border-t border-dashed pt-3 mt-1">
                      <Label className="text-muted-foreground text-xs font-medium">ราคาที่ซื้อ</Label>
                      <p className="mt-1 font-semibold text-sm bg-muted/40 px-3 py-2 rounded-lg border text-foreground/90 flex items-center gap-1.5">
                        <Wallet size={14} className="opacity-60 text-primary shrink-0" />
                        {formatPrice(detailItem.purchase_price)}
                      </p>
                    </div>

                    {/* บริษัท */}
                    <div className="w-full border-t border-dashed pt-3 mt-1">
                      <Label className="text-muted-foreground text-xs font-medium">บริษัท</Label>
                      <p className="mt-1 font-semibold text-sm bg-muted/40 px-3 py-2 rounded-lg border text-foreground/90 flex items-center gap-1.5 w-full truncate">
                        <Building2 size={14} className="opacity-60 text-primary shrink-0" />
                        {detailItem.company || "—"}
                      </p>
                    </div>

                    <div className="w-full border-t border-dashed pt-3 mt-1">
                      <Label className="text-muted-foreground text-xs font-medium">เบอร์ผู้ติดต่อบริษัท</Label>
                      <p className="mt-1 font-semibold text-sm bg-muted/40 px-3 py-2 rounded-lg border text-foreground/90 flex items-center gap-1.5 w-full truncate">
                        {detailItem.company_contact || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ ปุ่มด้านล่าง ค้างอยู่กับที่เสมอ ไม่เลื่อนตามเนื้อหา */}
            <div className="flex justify-end items-center gap-2.5 border-t px-6 py-3 shrink-0 bg-white">
              <Button
                className="hover:bg-[#111827] hover:text-white"
                variant="outline"
                onClick={handleClose}
              >
                ปิดหน้าต่าง
              </Button>

              {/* 🖨️ ปุ่มปริ้นบาร์โค้ด */}
              <GodexPrintButton form={detailItem} onPrintBarcode={onPrintBarcode} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
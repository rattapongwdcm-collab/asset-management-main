import React from 'react';
import { QRCodeSVG } from 'qrcode.react'; // หรือไลบรารี QR Code ที่คุณใช้
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GodexPrintButton({ form }) {

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* ใส่ Style เพื่อควบคุมสิทธิ์หน้าพิมพ์ไม่ให้ข้อความหลุดซ้อน */}
      <style>{`
  /* หน้าจอปกติจะไม่เห็นกล่องสติกเกอร์นี้ */
  @media screen {
    #print-area { display: none; } 
  }
  
  @media print {
    /* 1. ซ่อนองค์ประกอบอื่นๆ ทั้งหมดบนหน้าเว็บ */
    body * { visibility: hidden; }
    
    /* 2. แสดงเฉพาะพื้นที่สติกเกอร์ */
    #print-area, #print-area * { visibility: visible; }
    
    /* 3. ล็อกตำแหน่งสติกเกอร์ไว้มุมซ้ายบนสุด */
    #print-area {
      position: absolute;
      left: 0;
      top: 0;
      width: 100mm;
      height: 75mm%;
      box-sizing: border-box;
      padding: 10px; /* เว้นระยะขอบสติกเกอร์เล็กน้อย */
      background: white;
    }

    /* 4. 🎯 ตั้งค่าขนาดหน้ากระดาษสำหรับพิมพ์สติกเกอร์ (Sticker Size) */
    @page {
      size: auto;       /* ปล่อยให้ขนาดเป็นไปตามขนาดกระดาษที่ตั้งใน Driver เครื่องพิมพ์ */
      margin: 0mm;      /* ลบขอบขาวส่วนเกินของเบราว์เซอร์ (หัวกระดาษ/ท้ายกระดาษ) */
    }
  }
`}</style>

      {/* ปุ่มกดสั่งพิมพ์หน้าระบบ */}
      <Button onClick={handlePrint} className="flex items-center gap-1.5">
        <Printer size={16} />
        <span>พิมพ์บาร์โค้ด</span>
      </Button>

      {/* 🖨️ กล่องสำหรับส่งพิมพ์คอมพิวเตอร์ (พิมพ์ออกมาหน้าตาตามรูปสีขาวของคุณ) */}
      <div id="print-area" className="flex flex-row items-center justify-between text-black" style={{ fontFamily: 'sans-serif', fontSize: '12px' }}>

        {/* ฝั่งซ้าย: ข้อมูลรายละเอียดอุปกรณ์ (ลดขนาดตัวหนังสือลงเพื่อให้พอดีสติกเกอร์) */}
        <div className="space-y-1 font-bold leading-tight flex-1 pr-2">
          <div className="border-b border-black pb-1 mb-1 text-[11px] tracking-wide">
            🏢 IT ASSET MANAGEMENT
          </div>
          <p>รหัส: <span className="font-normal">{form.asset_tag || "-"}</span></p>
          <p>ชื่อ: <span className="font-normal">{form.name || "-"}</span></p>
          <p>แผนก: <span className="font-normal">{form.department || "-"}</span></p>
          <p>ประเภท: <span className="font-normal">{form.category || "-"}</span></p>
        </div>

        {/* ฝั่งขวา: QR Code สแกนดึงผู้ถือครอง */}
        <div className="shrink-0 flex items-center justify-center pl-1">
          <QRCodeSVG
            value={`ผู้ถือครอง: ${form.assigned_to || 'ไม่ระบุ'} (${form.department || '-'})`}
            size={85} /* ปรับขนาด QR Code ให้เหมาะกับสติกเกอร์ทั่วไป (ประมาณ 80-90px จะกำลังพอดี) */
          />
        </div>

      </div>
    </>
  );
}
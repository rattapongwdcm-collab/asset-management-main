import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GodexPrintButton({ form }) {

  const handlePrint = () => {
    window.print();
  };

  // ✅ สร้างลิงก์ไปหน้า detail ของอุปกรณ์ตัวนี้ (สแกน QR แล้วเปิดหน้านี้ได้เลย)
  // ปรับ path ให้ตรงกับ route จริงของระบบ ถ้าหน้า detail อยู่คนละ path ให้แก้ตรงนี้จุดเดียว
  const deviceDetailUrl = form?.id
    ? `${window.location.origin}/device/detail/${form.id}`
    : `${window.location.origin}/device`;

  return (
    <>
      <style>{`
  @media screen {
    #print-area { display: none; } 
  }
  
  @media print {
    body * { visibility: hidden; }
    
    #print-area, #print-area * { visibility: visible; }
    
    #print-area {
      position: absolute;
      left: 0;
      top: 0;
      width: 100mm;
      height: 75mm%;
      box-sizing: border-box;
      padding: 10px;
      background: white;
    }

    @page {
      size: auto;
      margin: 0mm;
    }
  }
`}</style>

      <Button onClick={handlePrint} className="flex items-center gap-1.5">
        <Printer size={16} />
        <span>พิมพ์บาร์โค้ด</span>
      </Button>

      <div id="print-area" className="flex flex-col text-black" style={{ fontFamily: 'sans-serif', fontSize: '12px' }}>

        {/* แถวบน: ข้อมูลอุปกรณ์ + QR Code */}
        <div className="flex flex-row items-center justify-between">
          <div className="space-y-1 font-bold leading-tight flex-1 pr-2">
            <div className="border-b border-black pb-1 mb-1 text-[11px] tracking-wide">
              🏢 IT ASSET MANAGEMENT
            </div>
            <p>รหัส: <span className="text-[9px] font-semibold mt-1 truncate">{form.asset_tag || "-"}</span></p>
            <p>ชื่อ: <span className="text-[9px] font-semibold mt-1 truncate">{form.name || "-"}</span></p>
            <p>แผนก: <span className="text-[9px] font-semibold mt-1 truncate">{form.department || "-"}</span></p>
            <p>ประเภท: <span className="text-[9px] font-semibold mt-1 truncate">{form.category || "-"}</span></p>
          </div>

          <div className="shrink-0 flex items-center justify-center pl-1">
            {/* ✅ QR Code ตอนนี้เก็บ URL ไปหน้า detail ของอุปกรณ์ — สแกนแล้วเปิดเว็บหน้ารายละเอียดได้เลย
                (ชื่อผู้รับผิดชอบจะไปแสดงในหน้า detail ที่ลิงก์นี้พาไปถึง ไม่ใช่ในตัว QR โดยตรง
                เพราะ QR ที่เก็บ URL จะเปิดเว็บทันทีตอนสแกน ไม่ใช่โชว์ข้อความดิบๆ) */}
            <QRCodeSVG
              value={deviceDetailUrl}
              size={85}
            />
          </div>
        </div>

        {/* ✅ เพิ่ม: แสดงชื่อผู้รับผิดชอบ (ผู้ถือครอง) ไว้ใต้ QR แบบข้อความเล็กๆ บนสติกเกอร์เลย
            เผื่อบางกรณีไม่สะดวกสแกน จะได้เห็นชื่อได้ทันทีจากสติกเกอร์ */}
        <p className="text-[9px] font-semibold mt-1 truncate">
          ผู้รับผิดชอบ: {form.assigned_to || "ไม่ระบุ"}
        </p>

        {/* ✅ เพิ่ม: ข้อความเตือนเล็กๆ ด้านล่างสุด แจ้งเรื่องชำรุด + เบอร์ติดต่อ */}
        <p className="text-[8px] text-gray-600 mt-1 border-t border-dashed border-gray-400 pt-1 leading-tight">
          ⚠️ หากบาร์โค้ดชำรุดหรือสูญหาย กรุณาติดต่อ 096-285-5419
        </p>
      </div>
    </>
  );
}
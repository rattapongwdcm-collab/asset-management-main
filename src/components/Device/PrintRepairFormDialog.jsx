import React, { useEffect, useRef } from 'react';
import html2canvas from 'html2canvas-pro'; // npm install html2canvas-pro jspdf
import jsPDF from 'jspdf';                 // ⚠️ ใช้ html2canvas-pro แทน html2canvas ปกติ เพราะรองรับสี oklch/lab/lch
                                            // ที่ Tailwind v4 ใช้เป็นค่าเริ่มต้น (html2canvas ตัวเดิม parse ไม่ได้ ทำให้ error)

// ── ใบแจ้งซ่อมเครื่องคอมพิวเตอร์ / อุปกรณ์ต่อพ่วง (พิมพ์ได้) ──────────────────
// อิงโครงจากฟอร์ม FM-DC-08 (ใบแจ้งซ่อมเครื่องคอมพิวเตอร์ / อุปกรณ์ต่อพ่วง)
// ฟิลด์ที่ระบบมีข้อมูลจริง (เลขที่เอกสาร/วันที่-เวลา/อุปกรณ์/ผู้แจ้ง/อาการเสีย) จะถูกเติมให้อัตโนมัติ
// ส่วนโทรศัพท์, ฝ่าย/แผนก, ชั้น, วันที่ขอให้ดำเนินการ และช่องของเจ้าหน้าที่ IT เว้นว่างไว้ให้กรอกด้วยมือหลังปริ้น
//
// พฤติกรรม: เปิด component นี้ปุ๊บ จะสร้างไฟล์ PDF จากเนื้อหาฟอร์ม แล้วเปิดแสดงในแท็บ/หน้าต่างใหม่ทันที
// ไม่มี UI ของ component นี้โผล่บนหน้าจอเดิมเลย (เนื้อหาอยู่นอกจอ ใช้แค่เป็นต้นแบบ render เป็น PDF เท่านั้น)
// เหมือนกับ PrintMoveFormDialog ทุกประการ — ไม่ใช้ window.print() อีกต่อไป
//
// props:
//   open      - boolean เปิด/ปิด dialog นี้
//   onClose   - callback หลังสร้าง/เปิด PDF เสร็จ (หรือถ้าเกิด error)
//   data      - object จาก Repair.jsx: { requestNo, requestDate, requestTime,
//               deviceName, assetTag, reportedBy, issueDescription }
export default function PrintRepairFormDialog({ open, onClose, data }) {
  const contentRef = useRef(null);      // ref ของเนื้อหาฟอร์ม ใช้เป็นต้นแบบสร้าง PDF
  const hasGenerated = useRef(false);   // กันสร้าง PDF ซ้ำถ้า component re-render ระหว่างเปิดอยู่

  // เปิดปุ๊บ สร้าง PDF จากเนื้อหาฟอร์ม แล้วเปิดแสดงในแท็บ/หน้าต่างใหม่ทันที
  useEffect(() => {
    if (open && !hasGenerated.current) {
      hasGenerated.current = true;
      const timer = setTimeout(() => {
        generateAndOpenPdf();
      }, 350); // หน่วงเล็กน้อยให้ browser render เนื้อหาก่อนแคปเจอร์
      return () => clearTimeout(timer);
    }
    if (!open) {
      hasGenerated.current = false; // reset ไว้ใช้รอบถัดไปตอนเปิดใหม่
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const generateAndOpenPdf = async () => {
    if (!contentRef.current) return;

    try {
      // scale: 2 เพิ่มความคมชัดของภาพที่แคปเจอร์ (คล้ายจอ retina) / backgroundColor กันพื้นหลังโปร่งใสกลายเป็นดำ
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

      // เว้น margin รอบขอบกระดาษ 10mm กันเนื้อหาชิดขอบเกินไป
      const margin = 10;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = Math.min((canvas.height * imgWidth) / canvas.width, pageHeight - margin * 2);

      pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);

      // blob URL เปิดแสดง PDF ในแท็บ/หน้าต่างใหม่ได้ทันที ไม่ต้องดาวน์โหลดก่อน
      const blobUrl = pdf.output('bloburl');
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error('สร้าง PDF ไม่สำเร็จ:', err);
      alert('สร้างไฟล์ PDF ไม่สำเร็จ: ' + err.message);
    } finally {
      onClose?.(); // ปิด state ของ dialog นี้ไม่ว่าผลลัพธ์จะสำเร็จหรือไม่
    }
  };

  if (!open || !data) return null;

  const equipmentLabel = data.assetTag ? `[${data.assetTag}] ${data.deviceName || ''}` : (data.deviceName || '');

  // ชิ้นส่วนกล่องที่ใช้ซ้ำหลายครั้งในฟอร์ม (หัวกล่องพื้นเทา + เส้นขอบ)
  const boxHeaderStyle = {
    border: '1px solid #000',
    borderBottom: 'none',
    background: '#e5e5e5',
    fontWeight: 600,
    padding: '4px 8px',
    fontSize: '11px',
  };
  const boxBodyStyle = {
    border: '1px solid #000',
    padding: '8px 10px',
  };
  const checkboxCell = (checked) => (
    <span
      style={{
        display: 'inline-flex',
        width: '11px',
        height: '11px',
        border: '1px solid #000',
        marginRight: '6px',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '9px',
        fontWeight: 700,
        verticalAlign: 'middle',
      }}
    >
      {checked ? '✓' : ''}
    </span>
  );
  const dottedLine = (text, minWidth = '120px') => (
    <span
      style={{
        display: 'inline-block',
        borderBottom: '1px dotted #000',
        padding: '0 4px',
        minWidth,
      }}
    >
      {text || ''}
    </span>
  );

  return (
    // จัดวางไว้นอกขอบจอ (ไม่ใช้ display:none) เพราะ html2canvas ต้องการให้ element มี layout จริงถึงจะแคปเจอร์ภาพได้ถูกต้อง
    // -left-[9999px] ทำให้มองไม่เห็นบนจอ แต่ browser ยัง render เนื้อหาไว้ให้ html2canvas ใช้งานได้
    <div className="fixed top-0 -left-[9999px]" aria-hidden="true">
      <div
        ref={contentRef}
        className="bg-white text-black"
        style={{ width: '794px', padding: '24px 28px', fontFamily: 'sans-serif', fontSize: '12px' }}
      >
        {/* หัวฟอร์ม */}
        <div className="text-center mb-1">
          <h1 className="text-base font-bold leading-snug">
            ใบแจ้งซ่อมเครื่องคอมพิวเตอร์ / อุปกรณ์ต่อพ่วง
          </h1>
        </div>
        <p style={{ textAlign: 'right', fontSize: '11px', margin: '2px 0 8px' }}>
          เลขที่ {dottedLine(data.requestNo, '80px')}
        </p>

        {/* สำหรับผู้ยื่นใบแจ้ง */}
        <div style={boxHeaderStyle}>สำหรับผู้ยื่นใบแจ้ง</div>
        <div style={{ ...boxBodyStyle, marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <div>ชื่อ {dottedLine(data.reportedBy, '150px')}</div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <div>ฝ่าย / แผนก {dottedLine('', '220px')}</div>
            <div>ชั้น {dottedLine('', '80px')}</div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <div>วันที่ยื่นใบแจ้งฯ {dottedLine(data.requestDate, '160px')}</div>
            <div>เวลา {dottedLine(data.requestTime, '80px')}</div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div>วันที่ขอให้ดำเนินการ {dottedLine('', '160px')}</div>
            <div>เวลา {dottedLine('', '80px')}</div>
          </div>
        </div>

        {/* รายการเครื่อง / อุปกรณ์ที่ขอรับบริการ */}
        <div style={boxHeaderStyle}>รายการเครื่องคอมพิวเตอร์ / อุปกรณ์ต่อพ่วง ที่ขอรับบริการ</div>
        <div style={{ ...boxBodyStyle, marginBottom: '10px' }}>
          <div style={{ marginBottom: '6px' }}>
            {checkboxCell(true)}เครื่องคอมพิวเตอร์ (โปรดระบุ PC Name) {dottedLine(equipmentLabel, '320px')}
          </div>
          <div>
            {checkboxCell(false)}อุปกรณ์ต่อพ่วง (โปรดระบุ) {dottedLine('', '320px')}
          </div>
        </div>

        {/* ขอรับบริการในเรื่อง */}
        <div style={boxHeaderStyle}>ขอรับบริการในเรื่อง</div>
        <div style={{ ...boxBodyStyle, marginBottom: '10px' }}>
          <div style={{ marginBottom: '5px' }}>{checkboxCell(false)}ตรวจสอบความผิดปกติของอุปกรณ์คอมพิวเตอร์</div>
          <div style={{ marginBottom: '5px' }}>{checkboxCell(true)}ขอให้ซ่อมแซมอุปกรณ์คอมพิวเตอร์ที่ใช้งานไม่ได้หรือเกิดชำรุดเสียสภาพ</div>
          <div style={{ marginBottom: '5px' }}>{checkboxCell(false)}ขอติดตั้งอุปกรณ์คอมพิวเตอร์เพิ่มเติม</div>
          <div style={{ marginBottom: '5px' }}>{checkboxCell(false)}ขอติดตั้งโปรแกรมคอมพิวเตอร์หรือปรับค่าต่างๆ ของโปรแกรมที่ใช้งานอยู่</div>
          <div>{checkboxCell(false)}ตรวจสอบความผิดปกติของโปรแกรมคอมพิวเตอร์</div>
        </div>

        {/* รายละเอียด */}
        <div style={boxHeaderStyle}>รายละเอียด</div>
        <div style={{ ...boxBodyStyle, marginBottom: '10px' }}>
          <div style={{ borderBottom: '1px dotted #000', minHeight: '20px', padding: '2px 4px', marginBottom: '4px' }}>
            {data.issueDescription || ''}
          </div>
          <div style={{ borderBottom: '1px dotted #000', minHeight: '20px', marginBottom: '4px' }}>&nbsp;</div>
          <div style={{ borderBottom: '1px dotted #000', minHeight: '20px', marginBottom: '10px' }}>&nbsp;</div>
          <p style={{ textAlign: 'right', fontSize: '11px' }}>ผู้ยื่นใบแจ้ง .......................................</p>
        </div>

        {/* สำหรับเจ้าหน้าที่ควบคุมระบบสารสนเทศ */}
        <div style={boxHeaderStyle}>สำหรับเจ้าหน้าที่ควบคุมระบบสารสนเทศ</div>
        <div style={boxBodyStyle}>
          <div style={{ marginBottom: '6px' }}>
            {checkboxCell(false)}รับทราบวันที่ {dottedLine('', '150px')} เวลา {dottedLine('', '100px')}
          </div>
          <div style={{ marginBottom: '6px' }}>
            {checkboxCell(false)}สามารถดำเนินการให้ตามที่ระบุ ภายในวันที่ {dottedLine('', '150px')}
            <br />
            <span style={{ marginLeft: '17px' }}>รายละเอียดการดำเนินงานดังนี้ {dottedLine('', '300px')}</span>
          </div>
          <div style={{ marginBottom: '10px' }}>
            {checkboxCell(false)}ไม่สามารถดำเนินการให้ได้ เนื่องจาก {dottedLine('', '300px')}
          </div>
          <p style={{ textAlign: 'right', fontSize: '11px' }}>เจ้าหน้าที่ควบคุมระบบสารสนเทศ .......................................</p>
        </div>

        {/* เลขฟอร์มท้ายกระดาษ ตามต้นฉบับ */}
        <p className="text-[9px] text-gray-400 text-right mt-3">
          FM-DC-08 Rev.00(20/02/2558)
        </p>
      </div>
    </div>
  );
}
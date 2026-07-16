import React, { useEffect, useRef } from 'react';
import html2canvas from 'html2canvas-pro'; // npm install html2canvas-pro jspdf
import jsPDF from 'jspdf';                 // ⚠️ ใช้ html2canvas-pro แทน html2canvas ปกติ เพราะรองรับสี oklch/lab/lch
                                            // ที่ Tailwind v4 ใช้เป็นค่าเริ่มต้น (html2canvas ตัวเดิม parse ไม่ได้ ทำให้ error)

// ── แบบฟอร์มขออนุมัติเคลื่อนย้ายอุปกรณ์ IT (พิมพ์ได้) ──────────────────────
// อิงโครงจากไฟล์ template "Form_IT_Movement_A5.xlsx" (Sheet 2 - แบบเต็ม)
// ฟิลด์ที่ระบบมีข้อมูลจริง (เลขที่เอกสาร/วันที่/อุปกรณ์/ต้นทาง-ปลายทาง) จะถูกเติมให้อัตโนมัติ
// ส่วนชื่อผู้ขอ, รหัสพนักงาน, แผนกผู้ขอ, เหตุผล และลายเซ็นทุกช่อง เว้นว่างไว้ให้กรอก/เซ็นด้วยมือหลังปริ้น
//
// พฤติกรรม: เปิด component นี้ปุ๊บ จะสร้างไฟล์ PDF จากเนื้อหาฟอร์ม แล้วเปิดแสดงในแท็บ/หน้าต่างใหม่ทันที
// ไม่มี UI ของ component นี้โผล่บนหน้าจอเดิมเลย (เนื้อหาอยู่นอกจอ ใช้แค่เป็นต้นแบบ render เป็น PDF เท่านั้น)
//
// props:
//   open      - boolean เปิด/ปิด dialog นี้
//   onClose   - callback หลังสร้าง/เปิด PDF เสร็จ (หรือถ้าเกิด error)
//   data      - object จาก DeviceEditFormDialog: { requestNo, requestDate, requestedBy,
//               deviceName, assetTag, category, fromDepartment, toDepartment,
//               installationLocation, assignedTo }
export default function PrintMoveFormDialog({ open, onClose, data }) {
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
      const pdf = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });

      // เว้น margin รอบขอบกระดาษ 8mm กันเนื้อหาชิดขอบเกินไป
      const margin = 8;
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

  // แถวเดียวเสมอ เพราะฟอร์มนี้ขอย้ายทีละ 1 เครื่อง
  const equipmentRow = {
    no: 1,
    type: data.category || '-',
    model: data.deviceName || '-',
    assetTag: data.assetTag || '-',
    qty: 1,
  };

  const newLocationText = [data.toDepartment, data.installationLocation]
    .filter(Boolean)
    .join(' — ') || '-';

  const today = new Date();
  const footerDate = today.toLocaleDateString('en-GB').split('/').join('/'); // dd/mm/yyyy สำหรับเลขฟอร์มท้ายกระดาษ

  return (
    // จัดวางไว้นอกขอบจอ (ไม่ใช้ display:none) เพราะ html2canvas ต้องการให้ element มี layout จริงถึงจะแคปเจอร์ภาพได้ถูกต้อง
    // -left-[9999px] ทำให้มองไม่เห็นบนจอ แต่ browser ยัง render เนื้อหาไว้ให้ html2canvas ใช้งานได้
    <div className="fixed top-0 -left-[9999px]" aria-hidden="true">
      <div
        ref={contentRef}
        className="bg-white text-black"
        style={{ width: '794px', padding: '24px 28px', fontFamily: 'sans-serif' }}
      >
        {/* หัวฟอร์ม */}
        <div className="text-center mb-1">
          <h1 className="text-base font-bold leading-snug">
            แบบฟอร์มขออนุมัติเคลื่อนย้ายอุปกรณ์เทคโนโลยีสารสนเทศ
          </h1>
          <p className="text-xs text-gray-700">(IT Equipment Relocation Approval Form)</p>
        </div>

        {/* ตารางเดียวทั้งฟอร์ม เส้นขอบทุกช่อง (border-collapse) ให้หน้าตาเหมือน grid ของสเปรดชีตต้นแบบ */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed' }}>
          <tbody>
            {/* เลขที่เอกสาร — ชิดขวาบน: 3 ช่องซ้ายว่าง + label + value */}
            <tr>
              <td colSpan={3} style={{ border: 'none' }}>&nbsp;</td>
              <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 600 }}>เลขที่เอกสาร</td>
              <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{data.requestNo || ''}</td>
            </tr>
            {/* วันที่ — แถวถัดมาตำแหน่งเดียวกัน */}
            <tr>
              <td colSpan={3} style={{ border: 'none' }}>&nbsp;</td>
              <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 600 }}>วันที่</td>
              <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{data.requestDate || ''}</td>
            </tr>

            {/* แถวเว้นช่องว่างเล็กน้อยก่อนเข้าส่วนข้อมูลผู้ขอ */}
            <tr><td colSpan={5} style={{ border: 'none', height: '10px' }} /></tr>

            {/* ข้อมูลผู้ขอ: ชื่อ-นามสกุล / รหัสพนักงาน / แผนก — เว้นว่างให้กรอกด้วยมือทั้งหมด */}
            <tr>
              <td colSpan={2} style={{ border: '1px solid #000', padding: '6px 8px', verticalAlign: 'top' }}>
                <span>ชื่อ-นามสกุล :</span>
                <div style={{ fontSize: '9px', color: '#666', marginTop: '10px' }}>(Name)</div>
              </td>
              <td style={{ border: '1px solid #000', padding: '6px 8px', verticalAlign: 'top' }}>
                <span>รหัสพนักงาน :</span>
                <div style={{ fontSize: '9px', color: '#666', marginTop: '10px' }}>(Emp ID)</div>
              </td>
              <td colSpan={2} style={{ border: '1px solid #000', padding: '6px 8px', verticalAlign: 'top' }}>
                <span>แผนก :</span>
                <div style={{ fontSize: '9px', color: '#666', marginTop: '10px' }}>(Dept.)</div>
              </td>
            </tr>

            {/* หัวตารางอุปกรณ์ — พื้นเทาเข้มกว่าตามต้นแบบ */}
            <tr style={{ background: '#d9d9d9', fontWeight: 600, textAlign: 'center' }}>
              <td style={{ border: '1px solid #000', padding: '4px', width: '9%' }}>ลำดับ</td>
              <td style={{ border: '1px solid #000', padding: '4px', width: '28%' }}>ประเภทอุปกรณ์</td>
              <td style={{ border: '1px solid #000', padding: '4px', width: '25%' }}>ยี่ห้อ/รุ่น</td>
              <td style={{ border: '1px solid #000', padding: '4px', width: '25%' }}>รหัสทรัพย์สิน</td>
              <td style={{ border: '1px solid #000', padding: '4px', width: '13%' }}>จำนวน</td>
            </tr>

            {/* แถวอุปกรณ์แถวแรก — เติมข้อมูลจริงจากระบบ (ย้ายทีละ 1 เครื่อง) */}
            <tr style={{ textAlign: 'center' }}>
              <td style={{ border: '1px solid #000', padding: '5px' }}>{equipmentRow.no}</td>
              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'left' }}>{equipmentRow.type}</td>
              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'left' }}>{equipmentRow.model}</td>
              <td style={{ border: '1px solid #000', padding: '5px', fontFamily: 'monospace' }}>{equipmentRow.assetTag}</td>
              <td style={{ border: '1px solid #000', padding: '5px' }}>{equipmentRow.qty}</td>
            </tr>

            {/* แถวว่างเพิ่มอีก 4 แถว (รวมแถวแรกเป็น 5 แถว) ให้ตรงตามจำนวนแถวในต้นแบบ */}
            {[2, 3, 4, 5].map((rowNo) => (
              <tr key={rowNo} style={{ textAlign: 'center', height: '22px' }}>
                <td style={{ border: '1px solid #000' }}>&nbsp;</td>
                <td style={{ border: '1px solid #000' }}>&nbsp;</td>
                <td style={{ border: '1px solid #000' }}>&nbsp;</td>
                <td style={{ border: '1px solid #000' }}>&nbsp;</td>
                <td style={{ border: '1px solid #000' }}>&nbsp;</td>
              </tr>
            ))}

            {/* แถวเว้นช่องว่างก่อนส่วนสถานที่ตั้ง ตามระยะห่างในต้นแบบ */}
            <tr><td colSpan={5} style={{ border: 'none', height: '14px' }} /></tr>

            {/* สถานที่ตั้งเดิม/ใหม่/เหตุผล — แต่ละอันเป็นแถวเต็มความกว้าง มีกรอบ */}
            <tr>
              <td colSpan={5} style={{ border: '1px solid #000', padding: '5px 8px' }}>
                สถานที่ตั้งเดิม : {data.fromDepartment || ''}
              </td>
            </tr>
            <tr>
              <td colSpan={5} style={{ border: '1px solid #000', padding: '5px 8px' }}>
                {/* รวมข้อมูลผู้รับมอบหมายใหม่ไว้ในบรรทัดเดียวกัน เพราะต้นแบบไม่มีช่องแยกสำหรับข้อมูลนี้ */}
                สถานที่ตั้งใหม่ : {newLocationText}
                {data.assignedTo && `  (ผู้รับมอบหมายใหม่: ${data.assignedTo})`}
              </td>
            </tr>
            <tr>
              <td colSpan={5} style={{ border: '1px solid #000', padding: '5px 8px', height: '32px', verticalAlign: 'top' }}>
                เหตุผลในการเคลื่อนย้าย :
              </td>
            </tr>

            {/* แถวเว้นช่องว่างก่อนส่วนลายเซ็น */}
            <tr><td colSpan={5} style={{ border: 'none', height: '14px' }} /></tr>

            {/* หัวช่องลายเซ็น 5 ช่อง — พื้นเทาตามต้นแบบ */}
            <tr style={{ background: '#d9d9d9', fontWeight: 600, textAlign: 'center' }}>
              <td style={{ border: '1px solid #000', padding: '6px 2px' }}>
                ผู้ขออนุมัติ<div style={{ fontWeight: 400, fontSize: '9px' }}>(Requester)</div>
              </td>
              <td style={{ border: '1px solid #000', padding: '6px 2px' }}>
                เจ้าหน้าที่ IT<div style={{ fontWeight: 400, fontSize: '9px' }}>(IT Staff)</div>
              </td>
              <td style={{ border: '1px solid #000', padding: '6px 2px' }}>
                หัวหน้าแผนก IT<div style={{ fontWeight: 400, fontSize: '9px' }}>(IT Manager)</div>
              </td>
              <td style={{ border: '1px solid #000', padding: '6px 2px' }}>
                บัญชี/สต็อก<div style={{ fontWeight: 400, fontSize: '9px' }}>(AC/Asset)</div>
              </td>
              <td style={{ border: '1px solid #000', padding: '6px 2px' }}>CEO</td>
            </tr>

            {/* แถวว่างสำหรับเซ็นจริงด้วยมือ + วันที่ + checkbox อนุมัติใต้ช่อง CEO */}
            <tr style={{ textAlign: 'center', fontSize: '9px', color: '#555' }}>
              <td style={{ border: '1px solid #000', padding: '10px 4px', height: '60px', verticalAlign: 'bottom' }}>
                วันที่ ....../....../......
              </td>
              <td style={{ border: '1px solid #000', padding: '10px 4px', verticalAlign: 'bottom' }}>
                วันที่ ....../....../......
              </td>
              <td style={{ border: '1px solid #000', padding: '10px 4px', verticalAlign: 'bottom' }}>
                วันที่ ....../....../......
              </td>
              <td style={{ border: '1px solid #000', padding: '10px 4px', verticalAlign: 'bottom' }}>
                วันที่ ....../....../......
              </td>
              <td style={{ border: '1px solid #000', padding: '6px 4px', verticalAlign: 'top', textAlign: 'left' }}>
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ display: 'inline-block', width: '9px', height: '9px', border: '1px solid #000', marginRight: '4px' }} />
                  อนุมัติ
                </div>
                <div>
                  <span style={{ display: 'inline-block', width: '9px', height: '9px', border: '1px solid #000', marginRight: '4px' }} />
                  ไม่อนุมัติ
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* เลขฟอร์มท้ายกระดาษ ตาม template เดิม */}
        <p className="text-[9px] text-gray-400 text-right mt-3">
          FM-IT-XX Rev.00 ({footerDate})
        </p>
      </div>
    </div>
  );
}
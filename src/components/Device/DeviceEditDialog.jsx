import React, { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { ArrowRightLeft, AlertCircle } from 'lucide-react';
import { logDeviceHistory } from '@/lib/deviceHistory';
import  PrintMoveFormDialog from  './PrintMoveFormDialog'

// ── Helper Components ───────────────────────────────────────────────────

/** ข้อความ error ใต้ช่องกรอกข้อมูล ใช้ซ้ำได้ทุกฟิลด์ */
function FieldError({ message }) {
  return (
    <div className="mt-0.5 min-h-[16px] flex items-center gap-1 text-red-500">
      {message && (
        <>
          <AlertCircle size={10} className="shrink-0" />
          <p className="text-[10px] font-semibold leading-none">{message}</p>
        </>
      )}
    </div>
  );
}

/**
 * สร้างเลขที่เอกสารเป็นเลขรันนิ่งล้วน (5 หลัก) เช่น "00001", "00002"
 * sequence มาจากการนับจำนวนคำขอเคลื่อนย้าย (request_type='move') ทั้งหมดที่เคยเกิดขึ้น (รวมคำขอปัจจุบันด้วย)
 */
function generateRequestNo(sequence) {
  return String(sequence).padStart(5, '0');
}

// ── Main Component ───────────────────────────────────────────────────────
export default function DeviceEditFormDialog({
  isOpen,
  setIsOpen,
  deviceData,
  form,
  setForm,
  errors,
  setErrors,
  saving,
  setSaving,
  setCloseConfirmOpen,
  departments,
  fetchDevices,
}) {
  // state สำหรับ dropdown ค้นหา "แผนกปลายทาง"
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [departmentDropdownOpen, setDepartmentDropdownOpen] = useState(false);
  const departmentRef = useRef(null);

  // state สำหรับ dialog ฟอร์มปริ้นขอย้ายอุปกรณ์ (แสดงหลังส่งคำขอสำเร็จ)
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printData, setPrintData] = useState(null);

  // เติมข้อมูลฟอร์มใหม่ทุกครั้งที่เปิด dialog พร้อมอุปกรณ์ที่เลือก
  useEffect(() => {
    if (isOpen && deviceData) {
      setForm({
        device_id: deviceData.id,
        asset_tag: deviceData.asset_tag || '',
        name: deviceData.name || '',
        assigned_to: deviceData.assigned_to || '',
        department: deviceData.department || '',
        installation_location: deviceData.installation_location || '', // ⬅️ ช่องข้อความธรรมดา ให้ตรงกับฟอร์มเพิ่ม/แก้ไขอุปกรณ์
        category: deviceData.category || '',
        status: deviceData.status || '',
        purchase_date: deviceData.purchase_date || '',
        warranty_expire: deviceData.warranty_expire || '',
        company: deviceData.company || '',
        company_contact: deviceData.company_contact || '',
        image_url: deviceData.image_url || null,
      });
      setDepartmentSearch(deviceData.department || ''); // sync ข้อความค้นหาให้ตรงกับข้อมูลเดิม
      setDepartmentDropdownOpen(false);
    } else {
      setDepartmentDropdownOpen(false);
    }
  }, [isOpen, deviceData, setForm]);

  // ปิด dropdown แผนกเมื่อคลิกนอกกล่อง
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (departmentRef.current && !departmentRef.current.contains(e.target)) {
        setDepartmentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredDepartments = departments.filter((dep) =>
    dep.toLowerCase().includes(departmentSearch.toLowerCase().trim())
  );

  const handleSelectDepartment = (dep) => {
    setForm((f) => ({ ...f, department: dep }));
    setErrors((prev) => ({ ...prev, department: '' }));
    setDepartmentSearch(dep);
    setDepartmentDropdownOpen(false);
  };

  // ── ส่งคำขอเคลื่อนย้ายอุปกรณ์ ────────────────────────────────────────
  const handleRequestMove = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('กรุณาเข้าสู่ระบบก่อนทำรายการ');
        setSaving(false);
        return;
      }

      // กันไว้ตั้งแต่ต้น: เช็คว่า device_id มีค่าจริงก่อน insert
      // (ป้องกัน error "invalid input syntax for type uuid")
      if (!form.device_id) {
        throw new Error('ไม่พบรหัสอุปกรณ์ที่ต้องการเคลื่อนย้าย กรุณาปิดหน้าต่างนี้แล้วเปิดใหม่อีกครั้ง');
      }

      const locationTrimmed = (form.installation_location || '').trim();

      // ใช้ .select() เพื่อดึงข้อมูลคำขอที่เพิ่ง insert กลับมา (รวม created_at) ใช้สร้าง "เลขที่คำขอ" บนฟอร์มปริ้น
      const { data: approvalData, error: approvalError } = await supabase
        .from('approvals')
        .insert([{
          device_id: form.device_id,
          device_name: deviceData?.name || null, // ✅ เพิ่มไว้ตรงนี้ — Approve.jsx ใช้ค่านี้ fallback ตอน join กับ devices ไม่ได้ (RLS/ถูกลบ/ฯลฯ)
          request_type: 'move',
          status: 'Pending',
          user_id: user.id,
          description: `ขอเคลื่อนย้ายอุปกรณ์ ${deviceData?.asset_tag || ''} ไปแผนก ${form.department}${locationTrimmed ? ` (สถานที่ติดตั้ง: ${locationTrimmed})` : ''
            }`,
          changed_fields: {
            department: form.department.trim(),
            assigned_to: form.assigned_to.trim(),
            installation_location: locationTrimmed, // ⬅️ ให้ตรงกับชื่อคอลัมน์/field ในฟอร์มเพิ่ม-แก้ไขอุปกรณ์
          },
        }])
        .select()
        .single();
      if (approvalError) throw approvalError;

      const { data: updateData, error: statusError } = await supabase
        .from('devices')
        .update({ status: 'รออนุมัติเคลื่อนย้าย' })
        .eq('id', form.device_id)
        .select();
      if (statusError) throw statusError;

      if (!updateData || updateData.length === 0) {
        throw new Error('ไม่พบอุปกรณ์ที่ต้องการอัปเดต (device_id ไม่ถูกต้อง)');
      }

      await logDeviceHistory({
        deviceId: form.device_id,
        assetTag: deviceData?.asset_tag,
        deviceName: deviceData?.name,
        action: 'move_request',
        description: `ขอย้ายไปแผนก ${form.department}${locationTrimmed ? `, สถานที่ติดตั้ง: ${locationTrimmed}` : ''
          }, ผู้รับมอบหมายใหม่: ${form.assigned_to}`,
        performedBy: user.email,
      });

      // นับจำนวนคำขอเคลื่อนย้ายทั้งหมดที่เคยเกิดขึ้น (รวมคำขอนี้ที่เพิ่ง insert ไปด้วย) ใช้เป็นเลขที่เอกสารแบบรันนิ่ง
      const { count: totalCount, error: countError } = await supabase
        .from('approvals')
        .select('id', { count: 'exact', head: true })
        .eq('request_type', 'move');
      if (countError) throw countError;

      const sequence = totalCount || 1; // นับรวมคำขอปัจจุบันแล้ว (insert ไปก่อนหน้านี้)

      // เตรียมข้อมูลสำหรับฟอร์มปริ้น แล้วปิด dialog แก้ไข เปิด dialog ปริ้นแทน
      setPrintData({
        // เลขที่เอกสารเป็นเลขรันนิ่งล้วน เช่น 00001
        requestNo: generateRequestNo(sequence),
        requestDate: new Date().toLocaleDateString('th-TH', {
          day: '2-digit', month: 'long', year: 'numeric',
        }),
        requestedBy: user.email,
        deviceName: deviceData?.name,
        assetTag: deviceData?.asset_tag,
        category: deviceData?.category,
        fromDepartment: deviceData?.department,
        toDepartment: form.department,
        installationLocation: locationTrimmed,
        assignedTo: form.assigned_to,
      });

      setIsOpen(false);
      setShowPrintPreview(true);
      if (fetchDevices) fetchDevices();
    } catch (err) {
      alert('ส่งคำขอไม่สำเร็จ: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── ตรวจสอบข้อมูลก่อนส่งคำขอ ───────────────────────────────────────
  const validateAndSave = () => {
    const localErrors = {};
    const departmentTrimmed = (form.department || '').trim();
    const assignedToTrimmed = (form.assigned_to || '').trim();
    const locationTrimmed = (form.installation_location || '').trim();

    if (!departmentTrimmed) {
      localErrors.department = 'กรุณาเลือกแผนกปลายทาง';
    }
    if (!assignedToTrimmed) {
      localErrors.assigned_to = 'กรุณากรอกผู้รับมอบหมายใหม่';
    } else if (assignedToTrimmed.length < 2) {
      localErrors.assigned_to = 'ชื่อผู้รับมอบหมายสั้นเกินไป';
    }

    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    const sameDepartment = departmentTrimmed === (deviceData?.department || '').trim();
    const sameAssignedTo = assignedToTrimmed === (deviceData?.assigned_to || '').trim();
    const sameLocation = locationTrimmed === (deviceData?.installation_location || '').trim();

    if (sameDepartment && sameAssignedTo && sameLocation) {
      setErrors({ department: 'ไม่มีข้อมูลเปลี่ยนแปลง กรุณาเลือกแผนก, สถานที่ติดตั้ง หรือผู้รับมอบหมายใหม่' });
      return;
    }

    setForm((f) => ({
      ...f,
      department: departmentTrimmed,
      assigned_to: assignedToTrimmed,
      installation_location: locationTrimmed,
    }));
    handleRequestMove();
  };

  const handleCancel = () => {
    setErrors({});

    if (!deviceData) {
      setIsOpen(false);
      return;
    }

    const isChanged =
      (form.department || '').trim() !== (deviceData.department || '').trim() ||
      (form.assigned_to || '').trim() !== (deviceData.assigned_to || '').trim() ||
      (form.installation_location || '').trim() !== (deviceData.installation_location || '').trim();

    if (isChanged) {
      setCloseConfirmOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setErrors({});
            setCloseConfirmOpen(true);
          }
        }}
      >
        {/* w-[92vw] กันล้นขอบจอมือถือ, max-w-md พอดีบนแท็บเล็ต/จอใหญ่ (24"/27" ก็ไม่ยืดเกินความจำเป็นเพราะ dialog นี้เนื้อหาไม่เยอะ) */}
        {/* max-h-[90vh] + overflow-y-auto กันเนื้อหาล้นจอ ในกรณีจอมือถือแนวนอนหรือคีย์บอร์ดดันพื้นที่ */}
        <DialogContent
          className="w-[92vw] max-w-md max-h-[90vh] overflow-y-auto sm:rounded-2xl"
          style={{
            backgroundColor: '#ffffff',
            opacity: 1,
            backdropFilter: 'none',
            boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
          }}
        >
          <DialogHeader className="border-b pb-3 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
              <div className="p-1 bg-primary/10 rounded-lg text-primary border shadow-sm">
                <ArrowRightLeft size={15} />
              </div>
              <span>เคลื่อนย้ายอุปกรณ์</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 my-3 space-y-4 w-full">
            <div className="bg-background rounded-xl border p-4 shadow-sm w-full space-y-3">

              {/* ข้อมูลอุปกรณ์ที่กำลังจะย้าย */}
              <div className="bg-muted/30 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{deviceData?.name}</span>
                {deviceData?.asset_tag && <span className="ml-1 font-mono">({deviceData.asset_tag})</span>}
              </div>

              {/* แผนกปลายทาง — dropdown ธรรมดา */}
              <div className="w-full">
                <Label className={`text-[11px] font-bold ${errors.department ? 'text-red-500' : 'text-foreground/80'}`}>
                  แผนกปลายทาง
                </Label>
                <select
                  value={form.department || ''}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, department: e.target.value }));
                    setErrors((prev) => ({ ...prev, department: '' }));
                  }}
                  disabled={saving}
                  className={`mt-1 h-9 w-full text-xs leading-none appearance-none font-normal rounded-md border px-2 bg-white text-foreground transition-colors focus:outline-none focus:ring-1 ${errors.department
                    ? 'border-red-500 bg-red-50/20 text-red-500 focus:ring-red-500'
                    : 'border-input focus:ring-primary'
                    }`}
                >
                  <option value="" disabled>
                    {errors.department ? errors.department : 'เลือกแผนกปลายทาง'}
                  </option>
                  {departments.map((dep) => (
                    <option key={dep} value={dep}>
                      {dep}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.department} />
              </div>

              {/* สถานที่ติดตั้ง — ช่องข้อความธรรมดา ให้เหมือนกับฟอร์มเพิ่ม/แก้ไขอุปกรณ์ */}
              <div className="w-full">
                <Label className="text-[11px] font-bold text-foreground/80">
                  สถานที่ติดตั้ง
                </Label>
                <Input
                  value={form.installation_location || ''}
                  placeholder="เช่น ชั้น 3 ห้อง IT"
                  className="mt-1 h-9 w-full text-xs leading-none appearance-none font-normal rounded-md border px-2 bg-white text-foreground transition-colors focus:outline-none focus:ring-1 border-input focus:ring-primary"
                  onChange={(e) => setForm((f) => ({ ...f, installation_location: e.target.value }))}
                  disabled={saving}
                />
              </div>

              {/* ผู้รับมอบหมายใหม่ */}
              <div className="w-full">
                <Label className={`text-[11px] font-bold ${errors.assigned_to ? 'text-red-500' : 'text-foreground/80'}`}>
                  ผู้รับมอบหมายใหม่
                </Label>
                <Input
                  value={form.assigned_to || ''}
                  placeholder="เช่น น.ส. ปัญญา ใจดี"
                  className={`mt-1 h-9 w-full text-xs bg-white text-foreground transition-colors focus:outline-none focus:ring-1 ${errors.assigned_to
                    ? 'border-red-500 bg-red-50/20 placeholder:text-red-400 focus:ring-red-500'
                    : 'border-input focus:ring-primary'
                    }`}
                  onFocus={() => setErrors((prev) => ({ ...prev, assigned_to: '' }))}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                  disabled={saving}
                />
                <FieldError message={errors.assigned_to} />
              </div>

            </div>
          </div>

          {/* ปุ่มด้านล่าง: เต็มความกว้างเรียงแนวตั้งบนมือถือ ชิดขวาแนวนอนบนจอกว้างขึ้น */}
          <div className="flex flex-col-reverse sm:flex-row justify-end items-stretch sm:items-center gap-2 border-t pt-3 shrink-0">
            <Button
              className="hover:bg-[#111827] hover:text-white"
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
            >
              ยกเลิก
            </Button>

            <Button
              className="hover:bg-[#111827] hover:text-white"
              variant="outline"
              onClick={validateAndSave}
              disabled={saving}
            >
              {saving ? (
                <div className="flex items-center justify-center gap-1.5">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                  <span>กำลังส่งคำขอ...</span>
                </div>
              ) : (
                'ส่งขออนุมัติเคลื่อนย้าย'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog ฟอร์มปริ้นขอย้ายอุปกรณ์ — เปิดขึ้นหลังส่งคำขอสำเร็จ พร้อม auto print */}
      <PrintMoveFormDialog
        open={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        data={printData}
      />
    </>
  );
}
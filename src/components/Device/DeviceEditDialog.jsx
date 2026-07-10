import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { ArrowRightLeft, AlertCircle } from 'lucide-react';

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
  fetchDevices
}) {
  useEffect(() => {
    if (isOpen && deviceData) {
      setForm({
        device_id: deviceData.id,   // ✅ แก้จาก deviceData.device_id เป็น deviceData.id
        asset_tag: deviceData.asset_tag || "",
        name: deviceData.name || "",
        assigned_to: deviceData.assigned_to || "",
        department: deviceData.department || "",
        category: deviceData.category || "",
        status: deviceData.status || "",
        purchase_date: deviceData.purchase_date || "",
        warranty_expire: deviceData.warranty_expire || "",
        company: deviceData.company || "",
        company_contact: deviceData.company_contact || "",
        image_url: deviceData.image_url || null
      });
    }
  }, [isOpen, deviceData, setForm]);

  const handleRequestMove = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("กรุณาเข้าสู่ระบบก่อนทำรายการ");
        setSaving(false);
        return;
      }

      // 1. บันทึกข้อมูลคำขอไปยังตาราง approvals
      const { error: approvalError } = await supabase.from('approvals').insert([{
        device_id: form.device_id,
        request_type: 'move',
        status: 'Pending',
        user_id: user.id,
        description: `ขอเคลื่อนย้ายอุปกรณ์ ${deviceData?.asset_tag || ''} ไปแผนก ${form.department}`,
        changed_fields: {
          department: form.department.trim(),
          assigned_to: form.assigned_to.trim()
        }
      }]);
      if (approvalError) throw approvalError;

      // 2. อัปเดตสถานะของอุปกรณ์ในตาราง devices เป็น 'รออนุมัติเคลื่อนย้าย'
      const { data: updateData, error: statusError } = await supabase
        .from('devices')
        .update({ status: 'รออนุมัติเคลื่อนย้าย' })
        .eq('id', form.device_id) // 💡 แก้ไขตรงนี้จาก form.status เป็น form.device_id
        .select();

      if (statusError) throw statusError;

      // ตรวจสอบว่ามีข้อมูลถูกอัปเดตจริงไหม
      if (!updateData || updateData.length === 0) {
        throw new Error('ไม่พบอุปกรณ์ที่ต้องการอัปเดต (device_id ไม่ถูกต้อง)');
      }

      alert("ส่งคำขอเคลื่อนย้ายสำเร็จ รอ Admin อนุมัติครับ");
      setIsOpen(false);
      if (fetchDevices) fetchDevices();
    } catch (err) {
      alert("ส่งคำขอไม่สำเร็จ: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // 🛠️ ตรวจสอบข้อมูลก่อนส่งขออนุมัติ
  const validateAndSave = () => {
    const localErrors = {};
    const departmentTrimmed = (form.department || "").trim();
    const assignedToTrimmed = (form.assigned_to || "").trim();

    // 1. เช็คค่าว่าง / ช่องว่างล้วน
    if (!departmentTrimmed) {
      localErrors.department = "กรุณาเลือกแผนกปลายทาง";
    }
    if (!assignedToTrimmed) {
      localErrors.assigned_to = "กรุณากรอกผู้รับมอบหมายใหม่";
    } else if (assignedToTrimmed.length < 2) {
      localErrors.assigned_to = "ชื่อผู้รับมอบหมายสั้นเกินไป";
    }

    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    // 2. เช็คข้อมูลซ้ำกับของเดิม (ไม่มีอะไรเปลี่ยนแปลง)
    const sameDepartment = departmentTrimmed === (deviceData?.department || "").trim();
    const sameAssignedTo = assignedToTrimmed === (deviceData?.assigned_to || "").trim();

    if (sameDepartment && sameAssignedTo) {
      setErrors({ department: "ไม่มีข้อมูลเปลี่ยนแปลง กรุณาเลือกแผนกหรือผู้รับมอบหมายใหม่" });
      return;
    }

    // เขียนค่าที่ trim แล้วกลับเข้า form ก่อนส่ง (กันช่องว่างหน้า-หลังหลุดเข้า DB)
    setForm(f => ({ ...f, department: departmentTrimmed, assigned_to: assignedToTrimmed }));
    handleRequestMove();
  };

  // ✅ กันการอ่านค่าจาก deviceData ตอนเป็น undefined
  const handleCancel = () => {
    setErrors({});

    if (!deviceData) {
      setIsOpen(false);
      return;
    }

    const isChanged =
      (form.department || "").trim() !== (deviceData.department || "").trim() ||
      (form.assigned_to || "").trim() !== (deviceData.assigned_to || "").trim();

    if (isChanged) {
      setCloseConfirmOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setErrors({});
          setCloseConfirmOpen(true);
        }
      }}
    >
      <DialogContent className="max-w-md sm:rounded-2xl"
        style={{
          backgroundColor: '#ffffff',
          opacity: 1,
          backdropFilter: 'none',
          boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)'
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

            <div className="bg-muted/30 rounded-lg px-3 py-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{deviceData?.name}</span>
              {deviceData?.asset_tag && <span className="ml-1 font-mono">({deviceData.asset_tag})</span>}
            </div>

            <div className="w-full">
              <Label className={`text-[11px] font-bold ${errors.department ? "text-red-500" : "text-foreground/80"}`}>
                แผนกปลายทาง
              </Label>
              <div className="mt-1">
                <Select
                  disabled={saving}
                  value={form.department || ""}
                  onValueChange={(v) => { setForm(f => ({ ...f, department: v })); setErrors(prev => ({ ...prev, department: "" })); }}
                >
                  <SelectTrigger className={`h-9 text-xs rounded-md transition-colors ${errors.department ? "border-red-500 bg-red-50/20 text-red-500 focus:ring-red-500" : ""}`}>
                    <SelectValue placeholder={errors.department ? errors.department : "เลือกแผนกที่จะย้ายไป"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {departments.map(dep => <SelectItem key={dep} value={dep} className="text-xs">{dep}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-0.5 min-h-[16px] flex items-center gap-1 text-red-500">
                {errors.department && (
                  <>
                    <AlertCircle size={10} className="shrink-0" />
                    <p className="text-[10px] font-semibold leading-none">{errors.department}</p>
                  </>
                )}
              </div>
            </div>

            <div className="w-full">
              <Label className={`text-[11px] font-bold ${errors.assigned_to ? "text-red-500" : "text-foreground/80"}`}>
                ผู้รับมอบหมายใหม่
              </Label>
              <input
                value={form.assigned_to || ""}
                placeholder="เช่น น.ส. ปัญญา ใจดี"
                className={`mt-1 h-9 w-full rounded-md border px-3 text-xs transition-colors focus:outline-none focus:ring-1 ${errors.assigned_to ? "border-red-500 bg-red-50/20 placeholder:text-red-400 focus:ring-red-500" : "border-input focus:ring-primary"}`}
                onFocus={() => setErrors(prev => ({ ...prev, assigned_to: "" }))}
                onChange={(e) => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                disabled={saving}
              />
              <div className="mt-0.5 min-h-[16px] flex items-center gap-1 text-red-500">
                {errors.assigned_to && (
                  <>
                    <AlertCircle size={10} className="shrink-0" />
                    <p className="text-[10px] font-semibold leading-none">{errors.assigned_to}</p>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>

        <div className="flex justify-end items-center gap-2 border-t pt-3 shrink-0">
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
              <div className="flex items-center gap-1.5">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                <span>กำลังส่งคำขอ...</span>
              </div>
            ) : (
              "ส่งขออนุมัติเคลื่อนย้าย"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
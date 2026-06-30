import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import ImageCropDialog from './ImageCropDialog';
import ImageUploader from './ImageUploader';
import { Laptop, AlertCircle } from 'lucide-react';

export default function DeviceEditFormDialog({
  isOpen,
  setIsOpen,
  deviceData,          // 📦 รับข้อมูลอุปกรณ์ตัวที่เลือกมาจากหน้า List
  form,
  setForm,
  errors,
  setErrors,
  focusField,
  setFocusField,
  saving,
  handleUpdate,        // 💾 ฟังก์ชันสำหรับ Admin (อัปเดตลงตาราง devices ทันที)
  handleRequestEdit,   // ➕ ฟังก์ชันสำหรับ User (ส่งขออนุมัติแก้ไขเข้าตาราง approvals)
  isAdmin = false,     // ➕ รับสิทธิ์การเป็น Admin (เริ่มต้นเป็น false)
  setCloseConfirmOpen,
  categories,
  statuses,
  departments
}) {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [checkingAsset, setCheckingAsset] = useState(false);

  // 🔄 ดึงข้อมูลอุปกรณ์เก่ามาใส่ในฟอร์มเมื่อมีการเลือกอุปกรณ์ หรือเปิด Dialog
  useEffect(() => {
    if (isOpen && deviceData) {
      setForm({
        device_id: deviceData.device_id,
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

  const handleImageChangeLocal = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const saveCropLocal = async () => {
    if (!croppedAreaPixels || !imageSrc) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 300;
    canvas.height = 300;
    const image = new Image();
    image.src = imageSrc;
    image.onload = async () => {
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        300,
        300
      );
      canvas.toBlob(async (blob) => {
        const fileName = `${Date.now()}.png`;
        const { error } = await supabase.storage
          .from("device-images")
          .upload(fileName, blob);

        if (error) {
          alert("อัปโหลดรูปภาพล้มเหลว: " + error.message);
          return;
        }
        const { data: { publicUrl } } = supabase.storage
          .from("device-images")
          .getPublicUrl(fileName);
        setForm(f => ({ ...f, image_url: publicUrl }));
        setCropDialogOpen(false);
      });
    };
  };

  // 🛠️ ส่วนเช็คความถูกต้องและแยกการทำงานตามสิทธิ์ (Admin / User)
  const validateAndSave = async () => {
    const localErrors = {};

    if (!form.asset_tag || form.asset_tag.toString().trim() === "") {
      localErrors.asset_tag = "กรุณากรอกรหัสอุปกรณ์";
    }
    if (!form.name || form.name.trim() === "") {
      localErrors.name = "กรุณากรอกชื่ออุปกรณ์";
    }
    if (!form.category || form.category.trim() === "") {
      localErrors.category = "กรุณาเลือกประเภท";
    }
    if (!form.status || form.status.trim() === "") {
      localErrors.status = "กรุณาเลือกสถานะ";
    }
    if (!form.assigned_to || form.assigned_to.trim() === "") {
      localErrors.assigned_to = "กรุณากรอกผู้รับมอบหมาย";
    }
    if (!form.department || form.department.trim() === "") {
      localErrors.department = "กรุณาเลือกแผนก";
    }
    if (!form.company || form.company.trim() === "") {
      localErrors.company = "กรุณากรอกชื่อบริษัท";
    }

    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    // 🔍 ตรวจสอบรหัสอุปกรณ์ซ้ำ (โดยละเว้น ID ของตัวมันเอง)
    try {
      setCheckingAsset(true);
      const { data: existingDevices, error: checkError } = await supabase
        .from('devices')
        .select('device_id, asset_tag')
        .eq('asset_tag', form.asset_tag.toString().trim())
        .neq('device_id', form.device_id);

      if (checkError) throw checkError;

      if (existingDevices && existingDevices.length > 0) {
        setErrors({ asset_tag: "รหัสอุปกรณ์นี้มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น" });
        setCheckingAsset(false);
        return;
      }
    } catch (err) {
      console.error("Error checking unique asset_tag:", err.message);
    } finally {
      setCheckingAsset(false);
    }

    // 🔀 ตรวจสอบสิทธิ์เพื่อเลือกฟังก์ชันปลายทาง
    if (isAdmin) {
      handleUpdate();        // Admin บันทึกเข้าตารางหลักทันที
    } else {
      if (handleRequestEdit) {
        handleRequestEdit(); // User ส่งไปที่ตารางขออนุมัติ
      } else {
        console.warn("handleRequestEdit function is missing.");
      }
    }
  };

  // เช็คว่าผู้ใช้มีการแก้ไขข้อมูลหรือไม่ก่อนที่จะกดยกเลิก
  const handleCancel = () => {
    setErrors({});

    // ตรวจสอบว่ามีการแก้ไขข้อมูลจากตัวเดิม (deviceData) หรือไม่
    const isChanged = Object.keys(form).some(key => form[key] !== deviceData[key]);

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:rounded-2xl"
        style={{
          backgroundColor: '#ffffff',
          opacity: 1,
          backdropFilter: 'none',
          boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)'
        }}
      >
        {/* ส่วนหัว */}
        <DialogHeader className="border-b pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
            <div className="p-1 bg-primary/10 rounded-lg text-primary border shadow-sm">
              <Laptop size={15} />
            </div>
            <span>แก้ไขข้อมูลอุปกรณ์ {!isAdmin && <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 ml-1">(โหมดส่งคำขออนุมัติ)</span>}</span>
          </DialogTitle>
        </DialogHeader>

        {/* ส่วนเนื้อหาฟอร์ม */}
        <div className="flex-1 my-3 space-y-4 overflow-hidden w-full">
          {/* ส่วนอัปโหลดรูปภาพ */}
          <div className="flex flex-col items-center justify-center bg-muted/5 py-3 px-4 rounded-xl border border-dashed w-full max-h-[130px]">
            <div className="scale-90 transform origin-center">
              <ImageUploader
                imageUrl={form.image_url}
                onImageChange={handleImageChangeLocal}
              />
            </div>
          </div>

          {/* แผงกรอกข้อมูลหลัก */}
          <div className="bg-background rounded-xl border p-4 shadow-sm w-full">
            <div className="grid grid-cols-2 gap-x-5 gap-y-1">

              {/* แถวที่ 1: รหัสอุปกรณ์ */}
              <div className="w-full">
                <Label className={`text-[11px] font-bold ${errors.asset_tag ? "text-red-500" : "text-foreground/80"}`}>
                  รหัสอุปกรณ์ {checkingAsset && <span className="text-[10px] text-primary animate-pulse ml-1">(กำลังตรวจสอบ...)</span>}
                </Label>
                <Input
                  value={form.asset_tag || ""}
                  placeholder={focusField === "asset_tag" ? "" : errors.asset_tag ? errors.asset_tag : "เช่น ASSET-001"}
                  className={`mt-1 h-8 text-xs rounded-md transition-colors ${errors.asset_tag ? "border-red-500 bg-red-50/20 placeholder:text-red-400 focus-visible:ring-red-500" : ""}`}
                  onFocus={() => { setFocusField("asset_tag"); setErrors(prev => ({ ...prev, asset_tag: "" })); }}
                  onBlur={() => setFocusField("")}
                  onChange={(e) => setForm(f => ({ ...f, asset_tag: e.target.value }))}
                  disabled={checkingAsset || saving}
                />
                <div className="mt-0.5 min-h-[16px] flex items-center gap-1 text-red-500">
                  {errors.asset_tag && (
                    <>
                      <AlertCircle size={10} className="shrink-0" />
                      <p className="text-[10px] font-semibold leading-none">{errors.asset_tag}</p>
                    </>
                  )}
                </div>
              </div>

              {/* แถวที่ 2: ชื่ออุปกรณ์ */}
              <div className="w-full">
                <Label className={`text-[11px] font-bold ${errors.name ? "text-red-500" : "text-foreground/80"}`}>ชื่ออุปกรณ์</Label>
                <Input
                  value={form.name || ""}
                  placeholder={focusField === "name" ? "" : errors.name ? errors.name : "เช่น Laptop Dell XPS 13"}
                  className={`mt-1 h-8 text-xs rounded-md transition-colors ${errors.name ? "border-red-500 bg-red-50/20 placeholder:text-red-400 focus-visible:ring-red-500" : ""}`}
                  onFocus={() => { setFocusField("name"); setErrors(prev => ({ ...prev, name: "" })); }}
                  onBlur={() => setFocusField("")}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  disabled={saving}
                />
                <div className="mt-0.5 min-h-[16px] flex items-center gap-1 text-red-500">
                  {errors.name && (
                    <>
                      <AlertCircle size={10} className="shrink-0" />
                      <p className="text-[10px] font-semibold leading-none">{errors.name}</p>
                    </>
                  )}
                </div>
              </div>

              {/* แถวที่ 3: ผู้รับมอบหมาย */}
              <div className="w-full">
                <Label className={`text-[11px] font-bold ${errors.assigned_to ? "text-red-500" : "text-foreground/80"}`}>ผู้ได้รับมอบหมาย</Label>
                <Input
                  value={form.assigned_to || ""}
                  placeholder={focusField === "assigned_to" ? "" : errors.assigned_to ? errors.assigned_to : "เช่น น.ส. ปัญญา ใจดี"}
                  className={`mt-1 h-8 text-xs rounded-md transition-colors ${errors.assigned_to ? "border-red-500 bg-red-50/20 placeholder:text-red-400 focus-visible:ring-red-500" : ""}`}
                  onFocus={() => { setFocusField("assigned_to"); setErrors(prev => ({ ...prev, assigned_to: "" })); }}
                  onBlur={() => setFocusField("")}
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

              {/* แถวที่ 4: แผนก */}
              <div className="w-full">
                <Label className={`text-[11px] font-bold ${errors.department ? "text-red-500" : "text-foreground/80"}`}>ฝ่าย / แผนก</Label>
                <div className="mt-1">
                  <Select disabled={saving} value={form.department || ""} onValueChange={(v) => { setForm(f => ({ ...f, department: v })); setErrors(prev => ({ ...prev, department: "" })); }}>
                    <SelectTrigger className={`h-8 text-xs rounded-md transition-colors ${errors.department ? "border-red-500 bg-red-50/20 text-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={errors.department ? errors.department : "เลือกแผนก"} />
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

              {/* แถวที่ 5: ประเภทอุปกรณ์ */}
              <div className="w-full">
                <Label className={`text-[11px] font-bold ${errors.category ? "text-red-500" : "text-foreground/80"}`}>ประเภทอุปกรณ์</Label>
                <div className="mt-1">
                  <Select disabled={saving} value={form.category || ""} onValueChange={(v) => { setForm(f => ({ ...f, category: v })); setErrors(prev => ({ ...prev, category: "" })); }}>
                    <SelectTrigger className={`h-8 text-xs rounded-md transition-colors ${errors.category ? "border-red-500 bg-red-50/20 text-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={errors.category ? errors.category : "เลือกประเภท"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      {categories.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-0.5 min-h-[16px] flex items-center gap-1 text-red-500">
                  {errors.category && (
                    <>
                      <AlertCircle size={10} className="shrink-0" />
                      <p className="text-[10px] font-semibold leading-none">{errors.category}</p>
                    </>
                  )}
                </div>
              </div>

              {/* แถวที่ 6: สถานะการใช้งาน */}
              <div className="w-full">
                <Label className={`text-[11px] font-bold ${errors.status ? "text-red-500" : "text-foreground/80"}`}>สถานะการใช้งาน</Label>
                <div className="mt-1">
                  <Select disabled={saving} value={form.status || ""} onValueChange={(v) => { setForm(f => ({ ...f, status: v })); setErrors(prev => ({ ...prev, status: "" })); }}>
                    <SelectTrigger className={`h-8 text-xs rounded-md transition-colors ${errors.status ? "border-red-500 bg-red-50/20 text-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={errors.status ? errors.status : "เลือกสถานะ"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      {statuses
                        .filter(s => s === 'สำรอง' || s === 'ใช้งาน')
                        .map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-0.5 min-h-[16px] flex items-center gap-1 text-red-500">
                  {errors.status && (
                    <>
                      <AlertCircle size={10} className="shrink-0" />
                      <p className="text-[10px] font-semibold leading-none">{errors.status}</p>
                    </>
                  )}
                </div>
              </div>

              {/* แถวที่ 7: วันที่ซื้ออุปกรณ์ */}
              <div className="w-full border-t border-dashed pt-2 mt-1">
                <Label className={`text-[11px] font-bold flex items-center gap-1 ${errors.purchase_date ? "text-red-500" : "text-foreground/80"}`}>วันที่ซื้ออุปกรณ์</Label>
                <Input
                  type="date"
                  disabled={saving}
                  value={form.purchase_date || ""}
                  className={`mt-1 h-8 text-xs rounded-md font-mono transition-colors ${errors.purchase_date ? "border-red-500 bg-red-50/20 text-red-500 focus-visible:ring-red-500" : "focus-visible:ring-primary"}`}
                  onChange={(e) => { setForm(f => ({ ...f, purchase_date: e.target.value })); setErrors(prev => ({ ...prev, purchase_date: "" })); }}
                />
                <div className="mt-0.5 min-h-[16px] flex items-center gap-1 text-red-500">
                  {errors.purchase_date && (
                    <>
                      <AlertCircle size={10} className="shrink-0" />
                      <p className="text-[10px] font-semibold leading-none">{errors.purchase_date}</p>
                    </>
                  )}
                </div>
              </div>

              {/* แถวที่ 8: วันหมดประกัน */}
              <div className="w-full border-t border-dashed pt-2 mt-1">
                <Label className={`text-[11px] font-bold flex items-center gap-1 ${errors.warranty_expire ? "text-red-500" : "text-foreground/80"}`}>วันหมดประกัน</Label>
                <Input
                  type="date"
                  disabled={saving}
                  value={form.warranty_expire || ""}
                  className={`mt-1 h-8 text-xs rounded-md font-mono transition-colors ${errors.warranty_expire ? "border-red-500 bg-red-50/20 text-red-500 focus-visible:ring-red-500" : "focus-visible:ring-primary"}`}
                  onChange={(e) => { setForm(f => ({ ...f, warranty_expire: e.target.value })); setErrors(prev => ({ ...prev, warranty_expire: "" })); }}
                />
                <div className="mt-0.5 min-h-[16px] flex items-center gap-1 text-red-500">
                  {errors.warranty_expire && (
                    <>
                      <AlertCircle size={10} className="shrink-0" />
                      <p className="text-[10px] font-semibold leading-none">{errors.warranty_expire}</p>
                    </>
                  )}
                </div>
              </div>

              {/* แถวล่างสุด: บริษัท */}
              <div className="w-full border-t border-dashed pt-2 mt-1">
                <Label className={`text-[11px] font-bold ${errors.company ? "text-red-500" : "text-foreground/80"}`}>บริษัท</Label>
                <Input
                  value={form.company || ""}
                  placeholder={focusField === "company" ? "" : errors.company ? errors.company : "เช่น บริษัท เอบีซี จำกัด"}
                  className={`mt-1 h-8 text-xs rounded-md transition-colors ${errors.company ? "border-red-500 bg-red-50/20 placeholder:text-red-400 focus-visible:ring-red-500" : ""}`}
                  onFocus={() => { setFocusField("company"); setErrors(prev => ({ ...prev, company: "" })); }}
                  onBlur={() => setFocusField("")}
                  onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))}
                  disabled={saving}
                />
                <div className="mt-0.5 min-h-[16px] flex items-center gap-1 text-red-500">
                  {errors.company && (
                    <>
                      <AlertCircle size={10} className="shrink-0" />
                      <p className="text-[10px] font-semibold leading-none">{errors.company}</p>
                    </>
                  )}
                </div>
              </div>

              {/* แถวล่างสุด: เบอร์ผู้ติดต่อบริษัท */}
              <div className="w-full border-t border-dashed pt-2 mt-1">
                <Label className={`text-[11px] font-bold ${errors.company_contact ? "text-red-500" : "text-foreground/80"}`}>เบอร์ผู้ติดต่อบริษัท</Label>
                <Input
                  type="number"
                  value={form.company_contact || ""}
                  placeholder={focusField === "company_contact" ? "" : errors.company_contact ? errors.company_contact : "เช่น 0812345678"}
                  className={`mt-1 h-8 text-xs rounded-md transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${errors.company_contact ? "border-red-500 bg-red-50/20 placeholder:text-red-400 focus-visible:ring-red-500" : ""}`}
                  onFocus={() => { setFocusField("company_contact"); setErrors(prev => ({ ...prev, company_contact: "" })); }}
                  onBlur={() => setFocusField("")}
                  onChange={(e) => setForm(f => ({ ...f, company_contact: e.target.value }))}
                  disabled={saving}
                />
                <div className="mt-0.5 min-h-[16px] flex items-center gap-1 text-red-500">
                  {errors.company_contact && (
                    <>
                      <AlertCircle size={10} className="shrink-0" />
                      <p className="text-[10px] font-semibold leading-none">{errors.company_contact}</p>
                    </>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ปุ่มควบคุม (Footer) */}
        <div className="flex justify-end items-center gap-2 border-t pt-3 shrink-0">
          <Button
            className="hover:bg-[#111827] hover:text-white"
            variant="outline"
            onClick={handleCancel}
            disabled={checkingAsset || saving}
          >
            ยกเลิก
          </Button>

          {/* ปุ่มส่งฟอร์ม (Submit) ปรับข้อความตามสิทธิ์และสถานะการทำงาน */}
          <Button
            className="hover:bg-[#111827] hover:text-white"
            variant="outline"
            onClick={validateAndSave}
            disabled={checkingAsset || saving}
          >
            {checkingAsset ? (
              <div className="flex items-center gap-1.5">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                <span>กำลังตรวจข้อมูล...</span>
              </div>
            ) : saving ? (
              <div className="flex items-center gap-1.5">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                <span>กำลังดำเนินการ...</span>
              </div>
            ) : isAdmin ? (
              "บันทึกข้อมูล"
            ) : (
              "ส่งขออนุมัติแก้ไข"
            )}
          </Button>
        </div>

        {/* ฟังก์ชันครอบรูป */}
        <ImageCropDialog
          isOpen={cropDialogOpen}
          setIsOpen={setCropDialogOpen}
          imageSrc={imageSrc}
          crop={crop}
          setCrop={setCrop}
          zoom={zoom}
          setZoom={setZoom}
          onCropComplete={(seededArea, pixels) => setCroppedAreaPixels(pixels)}
          onSave={saveCropLocal}
        />
      </DialogContent>
    </Dialog>
  );
}
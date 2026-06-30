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
export default function DeviceFormDialog({
  isOpen,
  setIsOpen,
  form,
  setForm,
  errors,
  setErrors,
  focusField,
  setFocusField,
  saving,
  handleSave,
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
const validateAndSave = async () => {
    const localErrors = {};

    // 1. ตรวจสอบค่าว่าง (ฟังก์ชันเดิม)
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

    // 2. ตรวจสอบรหัสอุปกรณ์ซ้ำในฐานข้อมูล (กรณีที่ผ่านเงื่อนไขค่าว่างแล้ว)
    if (!localErrors.asset_tag) {
      try {
        // ค้นหาในตาราง (สมมติว่าชื่อตารางเดี่ยวคือ "devices" เปลี่ยนชื่อตารางให้ตรงกับในฐานข้อมูลของคุณได้ครับ)
        let query = supabase
          .from("devices") 
          .select("id, asset_tag")
          .eq("asset_tag", form.asset_tag.toString().trim());

        // 💡 กรณีที่เป็นฟอร์ม "แก้ไข" (Edit Form) ต้องไม่เช็คซ้ำกับไอดีของตัวเอง
        if (form.id) {
          query = query.neq("id", form.id);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error checking duplicate asset tag:", error);
        } else if (data && data.length > 0) {
          localErrors.asset_tag = "รหัสอุปกรณ์นี้มีอยู่ในระบบแล้ว";
        }
      } catch (err) {
        console.error(err);
      }
    }

    // 3. สรุปผล Validation
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    handleSave();
  };

  const handleCancel = () => {
    setErrors({});
    const hasData = Object.values(form).some(value => value && value.toString().trim() !== "");
    if (hasData) {
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
            <span>เพิ่มอุปกรณ์ใหม่</span>
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
          {/* แถวที่ 0:แผงกรอกข้อมูลหลัก */}
          <div className="bg-background rounded-xl border p-4 shadow-sm w-full">
            <div className="grid grid-cols-2 gap-x-5 gap-y-1">
              {/* แถวที่ 1:รหัสอุปกรณ์*/}
              <div className="w-full">
                <Label className={`text-[11px] font-bold ${errors.asset_tag ? "text-red-500" : "text-foreground/80"}`}>รหัสอุปกรณ์</Label>
                <Input
                  value={form.asset_tag || ""}
                  placeholder={focusField === "asset_tag" ? "" : errors.asset_tag ? errors.asset_tag : "เช่น ASSET-001"}
                  className={`mt-1 h-8 text-xs rounded-md transition-colors ${errors.asset_tag ? "border-red-500 bg-red-50/20 placeholder:text-red-400 focus-visible:ring-red-500" : ""}`}
                  onFocus={() => { setFocusField("asset_tag"); setErrors(prev => ({ ...prev, asset_tag: "" })); }}
                  onBlur={() => setFocusField("")}
                  onChange={(e) => setForm(f => ({ ...f, asset_tag: e.target.value }))}
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
              {/*แถวที่ 2:ชื่ออุปกรณ์*/}
              <div className="w-full">
                <Label className={`text-[11px] font-bold ${errors.name ? "text-red-500" : "text-foreground/80"}`}>ชื่ออุปกรณ์</Label>
                <Input
                  value={form.name || ""}
                  placeholder={focusField === "name" ? "" : errors.name ? errors.name : "เช่น Laptop Dell XPS 13"}
                  className={`mt-1 h-8 text-xs rounded-md transition-colors ${errors.name ? "border-red-500 bg-red-50/20 placeholder:text-red-400 focus-visible:ring-red-500" : ""}`}
                  onFocus={() => { setFocusField("name"); setErrors(prev => ({ ...prev, name: "" })); }}
                  onBlur={() => setFocusField("")}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
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
              {/*แถวที่ 3:ผู้รับมอบหมาย*/}
              <div className="w-full">
                <Label className={`text-[11px] font-bold ${errors.assigned_to ? "text-red-500" : "text-foreground/80"}`}>ผู้ได้รับมอบหมาย</Label>
                <Input
                  value={form.assigned_to || ""}
                  placeholder={focusField === "assigned_to" ? "" : errors.assigned_to ? errors.assigned_to : "เช่น น.ส. ปัญญา ใจดี"}
                  className={`mt-1 h-8 text-xs rounded-md transition-colors ${errors.assigned_to ? "border-red-500 bg-red-50/20 placeholder:text-red-400 focus-visible:ring-red-500" : ""}`}
                  onFocus={() => { setFocusField("assigned_to"); setErrors(prev => ({ ...prev, assigned_to: "" })); }}
                  onBlur={() => setFocusField("")}
                  onChange={(e) => setForm(f => ({ ...f, assigned_to: e.target.value }))}
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
              {/*แถวที่ 4:แผนก */}
              <div className="w-full">
                <Label className={`text-[11px] font-bold ${errors.department ? "text-red-500" : "text-foreground/80"}`}>ฝ่าย / แผนก</Label>
                <div className="mt-1">
                  <Select value={form.department || ""} onValueChange={(v) => { setForm(f => ({ ...f, department: v })); setErrors(prev => ({ ...prev, department: "" })); }}>
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
              {/*แถวที่ 5:ประเภทการใช้งาน*/}
              <div className="w-full">
                <Label className={`text-[11px] font-bold ${errors.category ? "text-red-500" : "text-foreground/80"}`}>ประเภทอุปกรณ์</Label>
                <div className="mt-1">
                  <Select value={form.category || ""} onValueChange={(v) => { setForm(f => ({ ...f, category: v })); setErrors(prev => ({ ...prev, category: "" })); }}>
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
              {/*แถวที่ 6:สถานะการใช้งาน*/}
              <div className="w-full">
                <Label className={`text-[11px] font-bold ${errors.status ? "text-red-500" : "text-foreground/80"}`}>สถานะการใช้งาน</Label>
                <div className="mt-1">
                  <Select value={form.status || ""} onValueChange={(v) => { setForm(f => ({ ...f, status: v })); setErrors(prev => ({ ...prev, status: "" })); }}>
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
              {/*แถวที่ 7:วันที่ซื้ออุปกรณ์*/}
              <div className="w-full border-t border-dashed pt-2 mt-1">
                <Label className={`text-[11px] font-bold flex items-center gap-1 ${errors.warranty_expire ? "text-red-500" : "text-foreground/80"}`}>วันหมดประกัน</Label>
                <Input
                  type="date"
                  value={form.purchase_date || ""}
                  className={`mt-1 h-8 text-xs rounded-md font-mono transition-colors ${errors.purchase_date ? "border-red-500 bg-red-50/20 text-red-500 focus-visible:ring-red-500" : "focus-visible:ring-primary"}`}
                  onChange={(e) => { setForm(f => ({ ...f, purchase_date: e.target.value })); setErrors(prev => ({ ...prev, purchase_date: "" })); }}
                />
                <div className="min-h-[16px]" />
              </div>
              {/*แถวที่ 8:วันหมดประกัน */}
              <div className="w-full border-t border-dashed pt-2 mt-1">
                <Label className={`text-[11px] font-bold flex items-center gap-1 ${errors.warranty_expire ? "text-red-500" : "text-foreground/80"}`}>วันหมดประกัน</Label>
                <Input
                  type="date"
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
              {/* แถวล่างสุด:ผู้ติดต่อบริษัท */}
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

        {/* ยกเลิก */}
        <div className="flex justify-end items-center gap-2 border-t pt-3 shrink-0">
          <Button
            className="hover:bg-[#111827] hover:text-white"
            variant="outline"
            onClick={handleCancel}
          >
            ยกเลิก
          </Button>
          {/* บันทึก */}
          <Button
            className="hover:bg-[#111827] hover:text-white"
            variant="outline"
            onClick={validateAndSave}
            disabled={saving}
          >
            {saving ? (
              <div className="flex items-center gap-1.5">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                <span>กำลังบันทึก...</span>
              </div>
            ) : "บันทึกข้อมูล"}
          </Button>
        </div>
        {/* ฟังค์ชั่น คอบรูป */}
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
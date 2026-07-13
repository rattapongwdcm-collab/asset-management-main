import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import ImageCropDialog from './ImageCropDialog';
import ImageUploader from './ImageUploader';
import { Laptop, AlertCircle, ChevronDown } from 'lucide-react';

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

  // ✅ state สำหรับ dropdown ค้นหา "แผนก"
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [departmentDropdownOpen, setDepartmentDropdownOpen] = useState(false);
  const departmentRef = useRef(null);

  // ✅ state สำหรับ dropdown ค้นหา "ประเภทอุปกรณ์"
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryRef = useRef(null);

  // ✅ sync ข้อความค้นหาให้ตรงกับค่าที่เลือกไว้ใน form ทุกครั้งที่ modal เปิด/ค่าถูกเปลี่ยนจากภายนอก (เช่นตอนแก้ไข)
  useEffect(() => {
    if (isOpen) {
      setDepartmentSearch(form.department || '');
      setCategorySearch(form.category || '');
      setDepartmentDropdownOpen(false);
      setCategoryDropdownOpen(false);
    } else {
      setDepartmentDropdownOpen(false);
      setCategoryDropdownOpen(false);
    }
  }, [isOpen]);

  // ✅ ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (departmentRef.current && !departmentRef.current.contains(e.target)) {
        setDepartmentDropdownOpen(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(e.target)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredDepartments = departments.filter(dep =>
    dep.toLowerCase().includes(departmentSearch.toLowerCase().trim())
  );

  const filteredCategories = categories.filter(cat =>
    cat.toLowerCase().includes(categorySearch.toLowerCase().trim())
  );

  const handleSelectDepartment = (dep) => {
    setForm(f => ({ ...f, department: dep }));
    setErrors(prev => ({ ...prev, department: '' }));
    setDepartmentSearch(dep);
    setDepartmentDropdownOpen(false);
  };

  const handleSelectCategory = (cat) => {
    setForm(f => ({ ...f, category: cat }));
    setErrors(prev => ({ ...prev, category: '' }));
    setCategorySearch(cat);
    setCategoryDropdownOpen(false);
  };

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

    if (!localErrors.asset_tag) {
      try {
        let query = supabase
          .from("devices")
          .select("id, asset_tag")
          .eq("asset_tag", form.asset_tag.toString().trim());

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
        <DialogHeader className="border-b pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
            <div className="p-1 bg-primary/10 rounded-lg text-primary border shadow-sm">
              <Laptop size={15} />
            </div>
            <span>เพิ่มอุปกรณ์ใหม่</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 my-3 space-y-4 overflow-hidden w-full">
          <div className="flex flex-col items-center justify-center bg-muted/5 py-3 px-4 rounded-xl border border-dashed w-full max-h-[130px]">
            <div className="scale-90 transform origin-center">
              <ImageUploader
                imageUrl={form.image_url}
                onImageChange={handleImageChangeLocal}
              />
            </div>
          </div>

          <div className="bg-background rounded-xl border p-4 shadow-sm w-full">
            <div className="grid grid-cols-2 gap-x-5 gap-y-1">

              {/* รหัสอุปกรณ์ */}
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

              {/* ชื่ออุปกรณ์ */}
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

              {/* ผู้รับมอบหมาย */}
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

              {/* ✅ ฝ่าย / แผนก — เปลี่ยนเป็น combobox ค้นหาได้ */}
              <div className="w-full relative" ref={departmentRef}>
                <Label className={`text-[11px] font-bold ${errors.department ? "text-red-500" : "text-foreground/80"}`}>ฝ่าย / แผนก</Label>
                <div className="relative mt-1">
                  <Input
                    value={departmentSearch}
                    onChange={(e) => {
                      setDepartmentSearch(e.target.value);
                      setDepartmentDropdownOpen(true);
                      if (form.department) {
                        setForm(f => ({ ...f, department: '' }));
                      }
                    }}
                    onClick={() => setDepartmentDropdownOpen(true)}
                    placeholder={errors.department ? errors.department : "ค้นหาแผนก"}
                    className={`h-8 text-xs rounded-md pr-7 transition-colors ${errors.department ? "border-red-500 bg-red-50/20 text-red-500 placeholder:text-red-400 focus-visible:ring-red-500" : ""}`}
                  />
                  <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
                {departmentDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredDepartments.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground text-center">ไม่พบแผนกที่ตรงกับคำค้นหา</div>
                    ) : (
                      filteredDepartments.map(dep => (
                        <div
                          key={dep}
                          onClick={() => handleSelectDepartment(dep)}
                          className={`px-3 py-2 text-xs cursor-pointer hover:bg-muted/60 transition-colors ${form.department === dep ? 'bg-primary/10 font-semibold' : ''}`}
                        >
                          {dep}
                        </div>
                      ))
                    )}
                  </div>
                )}
                <div className="mt-0.5 min-h-[16px] flex items-center gap-1 text-red-500">
                  {errors.department && (
                    <>
                      <AlertCircle size={10} className="shrink-0" />
                      <p className="text-[10px] font-semibold leading-none">{errors.department}</p>
                    </>
                  )}
                </div>
              </div>

              {/* ✅ ประเภทอุปกรณ์ — เปลี่ยนเป็น combobox ค้นหาได้ */}
              <div className="w-full relative" ref={categoryRef}>
                <Label className={`text-[11px] font-bold ${errors.category ? "text-red-500" : "text-foreground/80"}`}>ประเภทอุปกรณ์</Label>
                <div className="relative mt-1">
                  <Input
                    value={categorySearch}
                    onChange={(e) => {
                      setCategorySearch(e.target.value);
                      setCategoryDropdownOpen(true);
                      if (form.category) {
                        setForm(f => ({ ...f, category: '' }));
                      }
                    }}
                    onClick={() => setCategoryDropdownOpen(true)}
                    placeholder={errors.category ? errors.category : "ค้นหาประเภท"}
                    className={`h-8 text-xs rounded-md pr-7 transition-colors ${errors.category ? "border-red-500 bg-red-50/20 text-red-500 placeholder:text-red-400 focus-visible:ring-red-500" : ""}`}
                  />
                  <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
                {categoryDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredCategories.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground text-center">ไม่พบประเภทที่ตรงกับคำค้นหา</div>
                    ) : (
                      filteredCategories.map(cat => (
                        <div
                          key={cat}
                          onClick={() => handleSelectCategory(cat)}
                          className={`px-3 py-2 text-xs cursor-pointer hover:bg-muted/60 transition-colors ${form.category === cat ? 'bg-primary/10 font-semibold' : ''}`}
                        >
                          {cat}
                        </div>
                      ))
                    )}
                  </div>
                )}
                <div className="mt-0.5 min-h-[16px] flex items-center gap-1 text-red-500">
                  {errors.category && (
                    <>
                      <AlertCircle size={10} className="shrink-0" />
                      <p className="text-[10px] font-semibold leading-none">{errors.category}</p>
                    </>
                  )}
                </div>
              </div>

              {/* สถานะการใช้งาน — ยังคงเป็น Select ปกติ (ตัวเลือกน้อย ไม่จำเป็นต้องค้นหา) */}
              <div className="w-full">
                <Label className={`text-[11px] font-bold ${errors.status ? "text-red-500" : "text-foreground/80"}`}>สถานะการใช้งาน</Label>
                <select
                  value={form.status || ""}
                  onChange={(e) => { setForm(f => ({ ...f, status: e.target.value })); setErrors(prev => ({ ...prev, status: "" })); }}
                  className={`mt-1 h-8 w-full text-xs rounded-md border px-2 transition-colors ${errors.status ? "border-red-500 bg-red-50/20 text-red-500" : "border-input"}`}
                >
                  <option value="" disabled>{errors.status ? errors.status : "เลือกสถานะ"}</option>
                  {statuses
                    .filter(s => s === 'สำรอง' || s === 'ใช้งาน')
                    .map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="mt-0.5 min-h-[16px] flex items-center gap-1 text-red-500">
                  {errors.status && (
                    <>
                      <AlertCircle size={10} className="shrink-0" />
                      <p className="text-[10px] font-semibold leading-none">{errors.status}</p>
                    </>
                  )}
                </div>
              </div>

              {/* วันที่ซื้ออุปกรณ์ */}
              <div className="w-full border-t border-dashed pt-2 mt-1">
                <Label className={`text-[11px] font-bold flex items-center gap-1 ${errors.warranty_expire ? "text-red-500" : "text-foreground/80"}`}>วันที่ซื้ออุปกรณ์</Label>
                <Input
                  type="date"
                  value={form.purchase_date || ""}
                  className={`mt-1 h-8 text-xs rounded-md font-mono transition-colors ${errors.purchase_date ? "border-red-500 bg-red-50/20 text-red-500 focus-visible:ring-red-500" : "focus-visible:ring-primary"}`}
                  onChange={(e) => { setForm(f => ({ ...f, purchase_date: e.target.value })); setErrors(prev => ({ ...prev, purchase_date: "" })); }}
                />
                <div className="min-h-[16px]" />
              </div>

              {/* วันหมดประกัน */}
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

              {/* บริษัท */}
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

              {/* ผู้ติดต่อบริษัท */}
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

        <div className="flex justify-end items-center gap-2 border-t pt-3 shrink-0">
          <Button
            className="hover:bg-[#111827] hover:text-white"
            variant="outline"
            onClick={handleCancel}
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
                <span>กำลังบันทึก...</span>
              </div>
            ) : "บันทึกข้อมูล"}
          </Button>
        </div>

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
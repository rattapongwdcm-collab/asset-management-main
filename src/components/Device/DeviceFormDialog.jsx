import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog'; // ⚠️ ตัด DialogHeader/DialogTitle ออก เพราะไม่ได้ใช้งานจริงในไฟล์นี้
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import ImageCropDialog from './ImageCropDialog';
import ImageUploader from './ImageUploader';
import { AlertCircle, ChevronDown } from 'lucide-react';
// ⚠️ ตัด import Laptop และ Textarea ออก เพราะไม่ได้ใช้งานจริงในไฟล์นี้

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
 * ช่องกรอกข้อความทั่วไป (Label + Input + error) ใช้แทนช่องกรอกข้อมูลที่ซ้ำกันเกือบทุกฟิลด์
 * - trackFocus: ถ้า true จะซ่อน placeholder ตอน focus และเคลียร์ error ตอน focus (สำหรับ input ข้อความทั่วไป)
 *   ถ้า false จะเคลียร์ error ทันทีตอนพิมพ์แทน (เหมาะกับ input วันที่ที่ไม่ต้องซ่อน placeholder)
 * - divider: เส้นคั่นบนสุด ใช้แบ่งกลุ่มฟิลด์ "ข้อมูลพื้นฐาน" กับ "วันที่ / ราคา / บริษัท"
 */
function TextField({
  label, field, type = 'text', placeholder, divider = false, trackFocus = true, extraInputClass = '',
  form, setForm, errors, setErrors, focusField, setFocusField,
}) {
  const hasError = !!errors[field];
  const shownPlaceholder = trackFocus && focusField === field ? '' : (errors[field] || placeholder);

  return (
    <div className={`w-full ${divider ? 'border-t border-dashed pt-2 mt-1' : ''}`}>
      <Label className={`text-[11px] font-bold ${hasError ? 'text-red-500' : 'text-foreground/80'}`}>{label}</Label>
      <Input
        type={type}
        value={form[field] || ''}
        placeholder={shownPlaceholder}
        className={`mt-1 h-8 text-xs rounded-md transition-colors ${
          hasError ? 'border-red-500 bg-red-50/20 placeholder:text-red-400 focus-visible:ring-red-500' : ''
        } ${extraInputClass}`}
        onFocus={trackFocus ? () => { setFocusField(field); setErrors((prev) => ({ ...prev, [field]: '' })); } : undefined}
        onBlur={trackFocus ? () => setFocusField('') : undefined}
        onChange={(e) => {
          setForm((f) => ({ ...f, [field]: e.target.value }));
          if (!trackFocus) setErrors((prev) => ({ ...prev, [field]: '' }));
        }}
      />
      <FieldError message={errors[field]} />
    </div>
  );
}

/**
 * dropdown ค้นหาได้ (combobox) ใช้แทนโค้ดที่ซ้ำกันของ "ฝ่าย/แผนก" และ "ประเภทอุปกรณ์"
 * จัดการ search text, เปิด/ปิด dropdown และคลิกนอกกล่องเพื่อปิด ภายในตัวเอง
 */
function SearchableDropdown({ label, field, options, placeholder, notFoundText, form, setForm, errors, setErrors }) {
  const [search, setSearch] = useState(form[field] || '');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => setSearch(form[field] || ''), [form[field]]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase().trim()));
  const hasError = !!errors[field];

  const handleSelect = (value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
    setSearch(value);
    setOpen(false);
  };

  return (
    <div className="w-full relative" ref={ref}>
      <Label className={`text-[11px] font-bold ${hasError ? 'text-red-500' : 'text-foreground/80'}`}>{label}</Label>
      <div className="relative mt-1">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
            if (form[field]) setForm((f) => ({ ...f, [field]: '' }));
          }}
          onClick={() => setOpen(true)}
          placeholder={hasError ? errors[field] : placeholder}
          className={`h-8 text-xs rounded-md pr-7 transition-colors ${
            hasError ? 'border-red-500 bg-red-50/20 text-red-500 placeholder:text-red-400 focus-visible:ring-red-500' : ''
          }`}
        />
        <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground text-center">{notFoundText}</div>
          ) : (
            filtered.map((o) => (
              <div
                key={o}
                onClick={() => handleSelect(o)}
                className={`px-3 py-2 text-xs cursor-pointer hover:bg-muted/60 transition-colors ${
                  form[field] === o ? 'bg-primary/10 font-semibold' : ''
                }`}
              >
                {o}
              </div>
            ))
          )}
        </div>
      )}

      <FieldError message={errors[field]} />
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────
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
  departments,
}) {
  // ครอปรูปภาพ
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);

  // ── จัดการรูปภาพ / ครอปรูป ─────────────────────────────────────────
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

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    const image = new Image();
    image.src = imageSrc;
    image.onload = async () => {
      ctx.drawImage(
        image,
        croppedAreaPixels.x, croppedAreaPixels.y,
        croppedAreaPixels.width, croppedAreaPixels.height,
        0, 0, 300, 300
      );
      canvas.toBlob(async (blob) => {
        const fileName = `${Date.now()}.png`;
        const { error } = await supabase.storage.from('device-images').upload(fileName, blob);
        if (error) {
          alert('อัปโหลดรูปภาพล้มเหลว: ' + error.message);
          return;
        }
        const { data: { publicUrl } } = supabase.storage.from('device-images').getPublicUrl(fileName);
        setForm((f) => ({ ...f, image_url: publicUrl }));
        setCropDialogOpen(false);
      });
    };
  };

  // ── ตรวจสอบข้อมูลก่อนบันทึก ────────────────────────────────────────
  const validateAndSave = async () => {
    const localErrors = {};

    if (!form.asset_tag || form.asset_tag.toString().trim() === '') localErrors.asset_tag = 'กรุณากรอกรหัสอุปกรณ์';
    if (!form.name || form.name.trim() === '') localErrors.name = 'กรุณากรอกชื่ออุปกรณ์';
    if (!form.category || form.category.trim() === '') localErrors.category = 'กรุณาเลือกประเภท';
    if (!form.status || form.status.trim() === '') localErrors.status = 'กรุณาเลือกสถานะ';
    if (!form.assigned_to || form.assigned_to.trim() === '') localErrors.assigned_to = 'กรุณากรอกผู้รับมอบหมาย';
    if (!form.department || form.department.trim() === '') localErrors.department = 'กรุณาเลือกแผนก';
    if (!form.company || form.company.trim() === '') localErrors.company = 'กรุณากรอกชื่อบริษัท';
    // เช็คแบบเดียวกับ company เลย — แค่เช็คว่าง ไม่ต้องเช็ครูปแบบตัวเลขซ้อน
    if (!form.purchase_price || form.purchase_price.toString().trim() === '') localErrors.purchase_price = 'กรุณากรอกราคาที่ซื้อ';

    // เช็ครหัสอุปกรณ์ซ้ำในระบบ (เฉพาะกรณีที่ยังไม่ error เรื่องกรอกว่าง)
    if (!localErrors.asset_tag) {
      try {
        let query = supabase.from('devices').select('id, asset_tag').eq('asset_tag', form.asset_tag.toString().trim());
        if (form.id) query = query.neq('id', form.id);

        const { data, error } = await query;
        if (error) {
          console.error('Error checking duplicate asset tag:', error);
        } else if (data && data.length > 0) {
          localErrors.asset_tag = 'รหัสอุปกรณ์นี้มีอยู่ในระบบแล้ว';
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
    const hasData = Object.values(form).some((value) => value && value.toString().trim() !== '');
    if (hasData) {
      setCloseConfirmOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // props ที่ต้องส่งซ้ำให้ TextField/SearchableDropdown ทุกตัว รวบไว้ที่เดียวกันความยาวโค้ด
  const fieldProps = { form, setForm, errors, setErrors, focusField, setFocusField };

  // ── Render ────────────────────────────────────────────────────────
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
      {/* w-[92vw] กันล้นขอบจอมือถือ, ขยายกว้างขึ้นบนจอใหญ่ (lg = โน้ตบุ๊ก/24"/27") เพื่อให้ฟอร์ม 3 คอลัมน์มีที่พอ */}
      <DialogContent
        className="w-[92vw] max-w-2xl lg:max-w-4xl h-[90vh] flex flex-col sm:rounded-2xl p-0 overflow-hidden"
        style={{
          backgroundColor: '#ffffff',
          opacity: 1,
          backdropFilter: 'none',
          boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        }}
      >
        {/* ส่วนเนื้อหา: เลื่อน (scroll) ได้เฉพาะส่วนนี้ ปุ่มด้านล่างจะไม่เลื่อนตาม */}
        <div className="flex-1 my-3 space-y-4 overflow-y-auto w-full px-4 sm:px-0">

          {/* กล่องอัปโหลดรูป */}
          <div className="flex items-center justify-center bg-muted/5 py-4 px-4 rounded-xl border border-dashed w-full">
            <div className="mx-auto">
              <ImageUploader imageUrl={form.image_url} onImageChange={handleImageChangeLocal} />
            </div>
          </div>

          {/* ฟอร์มข้อมูลอุปกรณ์ */}
          <div className="bg-background rounded-xl border p-4 shadow-sm w-full sm:w-[95%] mx-auto">
            {/* กริด: 1 คอลัมน์บนมือถือ -> 2 คอลัมน์บนแท็บเล็ต -> 3 คอลัมน์บนจอกว้าง (24"/27") ให้ใช้พื้นที่คุ้มค่า */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-1">

              <TextField label="รหัสอุปกรณ์" field="asset_tag" placeholder="เช่น ASSET-001" {...fieldProps} />
              <TextField label="ชื่ออุปกรณ์" field="name" placeholder="เช่น Laptop Dell XPS 13" {...fieldProps} />
              <TextField label="ผู้ได้รับมอบหมาย" field="assigned_to" placeholder="เช่น น.ส. ปัญญา ใจดี" {...fieldProps} />

              <SearchableDropdown
                label="ฝ่าย / แผนก"
                field="department"
                options={departments}
                placeholder="ค้นหาแผนก"
                notFoundText="ไม่พบแผนกที่ตรงกับคำค้นหา"
                form={form} setForm={setForm} errors={errors} setErrors={setErrors}
              />

              <SearchableDropdown
                label="ประเภทอุปกรณ์"
                field="category"
                options={categories}
                placeholder="ค้นหาประเภท"
                notFoundText="ไม่พบประเภทที่ตรงกับคำค้นหา"
                form={form} setForm={setForm} errors={errors} setErrors={setErrors}
              />

              {/* สถานะการใช้งาน: ใช้ select ธรรมดา เก็บเฉพาะ 2 สถานะที่เลือกได้ตอนสร้าง/แก้ไข */}
              <div className="w-full">
                <Label className={`text-[11px] font-bold ${errors.status ? 'text-red-500' : 'text-foreground/80'}`}>สถานะการใช้งาน</Label>
                <select
                  value={form.status || ''}
                  onChange={(e) => { setForm((f) => ({ ...f, status: e.target.value })); setErrors((prev) => ({ ...prev, status: '' })); }}
                  className={`mt-1 h-8 w-full text-xs rounded-md border px-2 transition-colors ${
                    errors.status ? 'border-red-500 bg-red-50/20 text-red-500' : 'border-input'
                  }`}
                >
                  <option value="" disabled>{errors.status ? errors.status : 'เลือกสถานะ'}</option>
                  {statuses.filter((s) => s === 'สำรอง' || s === 'ใช้งาน').map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <FieldError message={errors.status} />
              </div>

              <TextField label="วันที่ซื้ออุปกรณ์" field="purchase_date" type="date" divider trackFocus={false} extraInputClass="font-mono" {...fieldProps} />
              <TextField label="วันหมดประกัน" field="warranty_expire" type="date" divider trackFocus={false} extraInputClass="font-mono" {...fieldProps} />
              <TextField
                label="ราคาที่ซื้อ (บาท)"
                field="purchase_price"
                type="number"
                divider
                placeholder="เช่น 25000"
                extraInputClass="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                {...fieldProps}
              />
              <TextField label="สถานที่ติดตั้ง" field="installation_location" divider placeholder="เช่น ชั้น 3 ห้อง IT" {...fieldProps} />
              <TextField label="บริษัท" field="company" divider placeholder="เช่น บริษัท เอบีซี จำกัด" {...fieldProps} />
              <TextField
                label="เบอร์ผู้ติดต่อบริษัท"
                field="company_contact"
                type="number"
                divider
                placeholder="เช่น 0812345678"
                extraInputClass="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                {...fieldProps}
              />
            </div>
          </div>
        </div>

        {/* แถบปุ่มด้านล่าง: ค้างอยู่กับที่เสมอ ไม่เลื่อนตามเนื้อหา, เต็มความกว้างเรียงแนวตั้งบนมือถือ */}
        <div className="flex flex-col-reverse sm:flex-row justify-end items-stretch sm:items-center gap-2 border-t px-4 sm:px-6 py-3 shrink-0 bg-white">
          <Button className="hover:bg-[#111827] hover:text-white" variant="outline" onClick={handleCancel}>
            ยกเลิก
          </Button>
          <Button className="hover:bg-[#111827] hover:text-white" variant="outline" onClick={validateAndSave} disabled={saving}>
            {saving ? (
              <div className="flex items-center justify-center gap-1.5">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                <span>กำลังบันทึก...</span>
              </div>
            ) : (
              'บันทึกข้อมูล'
            )}
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
          onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
          onSave={saveCropLocal}
        />
      </DialogContent>
    </Dialog>
  );
}
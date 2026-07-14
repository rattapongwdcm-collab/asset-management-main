import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DeviceTable from '@/components/Device/DeviceTable';
import DeviceFormDialog from '@/components/Device/DeviceFormDialog';
import CloseConfirmDialog from '@/components/Device/CloseConfirmDialog';
import DeviceDetailDialog from '@/components/Device/DeviceDetailDialog';
import { Plus, Search, Filter } from "lucide-react";
import DeviceEditDialog from '@/components/Device/DeviceEditDialog';
import { logDeviceHistory } from '@/lib/deviceHistory';
import { Monitor } from 'lucide-react'
const statusColors = {
  'ใช้งาน': { bg: '#E0F2FE', color: '#000000' },
  'สำรอง': { bg: '#DCFCE7', color: '#000000' },
  'กำลังซ่อม': { bg: '#FEF3C7', color: '#000000' },
  'รออนุมัติส่งซ่อม': { bg: '#FFE4E6', color: '#9F1239' },
  'ยืม': { bg: '#F3E8FF', color: '#000000' },
  'เสีย': { bg: '#F1F5F9', color: '#000000' },
  'รออนุมัติลบ': { bg: '#FFE4E6', color: '#9F1239' },
  'รออนุมัติแก้ไข': { bg: '#FEF3C7', color: '#D97706' }
};

const categories = ['Laptop', 'Desktop', 'Monitor', 'Printer', 'Network', 'Server', 'Mobile', 'Tablet', 'Other'];
const statuses = ['สำรอง', 'ใช้งาน', 'รออนุมัติส่งซ่อม', 'กำลังซ่อม', 'ยืม', 'เสีย'];
const departments = [
  "Management", "Human Resources", "Admin", "Accounting", "Finance",
  "Information Technology", "Sales", "Modern & Online Trade",
  "International Business", "Export", "Procurement", "Purchasing",
  "Delivery", "Shipping", "Import-Export Logistics", "Warehouse ",
  "Production", "Research & Development", "Quality Control ",
  "Registration & Document Control", "Graphic Design",
];

const emptyForm = {
  asset_tag: '', name: '', category: '', brand: '', model: '',
  serial_number: '', status: '', assigned_to: '', department: '',
  purchase_date: '', purchase_price: '', warranty_expire: '', image_url: '',
};

// ✅ ฟอร์มว่างเปล่าเฉพาะฟอร์ม "เคลื่อนย้าย" แยกต่างหาก
const emptyMoveForm = { device_id: '', department: '', assigned_to: '' };

export default function Device() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [errors, setErrors] = useState({});
  const [detailItem, setDetailItem] = useState(null);
  const [focusField, setFocusField] = useState("");

  // ✅ state ชุดใหม่ แยกเฉพาะฟอร์มเคลื่อนย้าย (ไม่แชร์กับฟอร์มเพิ่ม/แก้ไขอุปกรณ์อีกต่อไป)
  const [moveForm, setMoveForm] = useState(emptyMoveForm);
  const [moveErrors, setMoveErrors] = useState({});
  const [moveSaving, setMoveSaving] = useState(false);
  const [moveCloseConfirmOpen, setMoveCloseConfirmOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('devices').select('*').order('created_at', { ascending: false });
    setDevices(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel('realtime-devices-page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices' },
        (payload) => { load(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = devices.filter((d) => {
    const keyword = search.toLowerCase();
    const matchSearch = !search ||
      d.name?.toLowerCase().includes(keyword) ||
      d.asset_tag?.toLowerCase().includes(keyword) ||
      d.brand?.toLowerCase().includes(keyword) ||
      d.department?.toLowerCase().includes(keyword) ||
      d.assigned_to?.toLowerCase().includes(keyword);

    const matchStatus = filterStatus === "all" || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const openAdd = () => {
    setEditItem(null);
    setForm(emptyForm);
    setErrors({});  // ✅ เพิ่มบรรทัดนี้
    setDialogOpen(true);
  };

  // ✅ ตอนนี้ "openEdit" คือการเปิดฟอร์มเคลื่อนย้าย — ต้องเติมค่าเข้า moveForm ไม่ใช่ form
  const openMove = (item) => {
    setEditItem(item);
    setMoveForm({
      device_id: item.id,
      department: item.department || '',
      assigned_to: item.assigned_to || '',
    });
    setMoveErrors({});
  };

  const handleSave = async () => {
    const newErrors = {};
    if (!form.asset_tag?.trim()) newErrors.asset_tag = "กรุณากรอก Asset Tag";
    if (!form.assigned_to?.trim()) newErrors.assigned_to = "กรุณากรอกมอบหมายให้";
    if (!form.name?.trim()) newErrors.name = "กรุณากรอกชื่ออุปกรณ์";
    if (!form.purchase_date?.trim()) newErrors.purchase_date = "กรุณากรอกวันที่ซื้อ";
    if (!form.warranty_expire?.trim()) newErrors.warranty_expire = "กรุณากรอกวันหมดประกัน";
    if (!form.category) newErrors.category = "กรุณาเลือกประเภท";
    if (!form.department) newErrors.department = "กรุณาเลือกแผนก";
    if (!form.status) newErrors.status = "กรุณาเลือกสถานะ";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);

    const payload = {
      asset_tag: form.asset_tag,
      name: form.name,
      category: form.category,
      department: form.department,
      assigned_to: form.assigned_to,
      status: form.status,
      company: form.company,
      company_contact: form.company_contact,
      image_url: form.image_url || null,
      purchase_date: form.purchase_date || null,
      warranty_expire: form.warranty_expire || null,
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
      installation_location: form.installation_location || null,  // ✅ เพิ่ม

    };

    let result;
    if (editItem) {
      result = await supabase.from("devices").update(payload).eq("id", editItem.id).select();
    } else {
      result = await supabase.from("devices").insert([payload]).select();
    }

    if (result.error) {
      console.error(result.error);
      alert(result.error.message);
      setSaving(false);
      return;
    }

    if (editItem) {
      await logDeviceHistory({
        deviceId: editItem.id,
        assetTag: form.asset_tag,
        deviceName: form.name,
        action: 'edit',
        description: `แก้ไขข้อมูลอุปกรณ์ ${form.asset_tag}`,
      });
    } else {
      await logDeviceHistory({
        deviceId: result.data?.[0]?.id,
        assetTag: form.asset_tag,
        deviceName: form.name,
        action: 'create',
        description: `เพิ่มอุปกรณ์ใหม่เข้าระบบ`,
      });
    }

    await load();
    setDialogOpen(false);
    setEditItem(null);
    setSaving(false);
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
            <Monitor className="text-primary" size={22} />
            รายการอุปกรณ์
          </h2>
        </div>
        <Button onClick={openAdd} className="gap-2 w-full sm:w-auto">
          <Plus size={16} /> เพิ่มอุปกรณ์
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="ค้นหาชื่อ, asset tag, ยี่ห้อ..." className="pl-9 h-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40 bg-card">
            <Filter size={14} className="mr-2 text-muted-foreground" />
            <SelectValue placeholder="สถานะ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ประเภทอุปกรณ์</SelectItem>
            {categories.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <DeviceTable
          loading={loading}
          filtered={filtered}
          statusColors={statusColors}
          setDetailItem={setDetailItem}
          setEditItem={openMove}
          setDeleteId={setDeleteId}
          deleteId={deleteId}
          fetchDevices={load}
        />
      </div>

      {/* ✅ ฟอร์มเคลื่อนย้าย — ใช้ state ชุดของตัวเองทั้งหมด ไม่แตะ form/errors/saving/closeConfirmOpen ของฟอร์มเพิ่มอุปกรณ์อีกต่อไป */}
      <DeviceEditDialog
        isOpen={editItem !== null}
        setIsOpen={(open) => !open && setEditItem(null)}
        deviceData={editItem}
        form={moveForm}
        setForm={setMoveForm}
        errors={moveErrors}
        setErrors={setMoveErrors}
        saving={moveSaving}
        setSaving={setMoveSaving}
        setCloseConfirmOpen={setMoveCloseConfirmOpen}
        departments={departments}
        fetchDevices={load}
      />

      <DeviceFormDialog
        isOpen={dialogOpen}
        setIsOpen={setDialogOpen}
        form={form}
        setForm={setForm}
        errors={errors}
        setErrors={setErrors}
        focusField={focusField}
        setFocusField={setFocusField}
        saving={saving}
        handleSave={handleSave}
        setCloseConfirmOpen={setCloseConfirmOpen}
        categories={categories}
        statuses={statuses}
        departments={departments}
        onSuccess={load}
      />

      {/* Popup ยืนยันปิด สำหรับฟอร์ม "เพิ่มอุปกรณ์" เท่านั้น */}
      <CloseConfirmDialog
        isOpen={closeConfirmOpen}
        setIsOpen={setCloseConfirmOpen}
        setDialogOpen={setDialogOpen}
        setErrors={setErrors}
        setForm={setForm}
        emptyForm={emptyForm}
      />

      {/* ✅ Popup ยืนยันปิด แยกต่างหาก สำหรับฟอร์ม "เคลื่อนย้าย" โดยเฉพาะ
          จุดสำคัญ: setDialogOpen ตรงนี้ต้องปิด editItem จริง ไม่งั้น dialog เคลื่อนย้ายจะค้างเปิดอยู่เบื้องหลัง */}
      <CloseConfirmDialog
        isOpen={moveCloseConfirmOpen}
        setIsOpen={setMoveCloseConfirmOpen}
        setDialogOpen={(open) => { if (!open) setEditItem(null); }}
        setErrors={setMoveErrors}
        setForm={setMoveForm}
        emptyForm={emptyMoveForm}
      />

      <DeviceDetailDialog
        isOpen={!!detailItem}
        setIsOpen={(open) => !open && setDetailItem(null)}
        detailItem={detailItem}
      />
    </div>
  );
}
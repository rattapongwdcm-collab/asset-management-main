import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DeviceTable from '@/components/Device/DeviceTable';
import DeviceFormDialog from '@/components/Device/DeviceFormDialog';
import CloseConfirmDialog from '@/components/Device/CloseConfirmDialog';
import DeviceDetailDialog from '@/components/Device/DeviceDetailDialog';
import { Plus, Search, Download } from "lucide-react"; // ✅ ตัด Filter icon ออก (ไม่ได้ใช้แล้ว)
import DeviceEditDialog from '@/components/Device/DeviceEditDialog';
import { logDeviceHistory } from '@/lib/deviceHistory';
import { Monitor } from 'lucide-react'
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';

const statusColors = {
  'ใช้งาน': { bg: '#22C55E', color: '#ffffff' },
  'สำรอง': { bg: '#3B82F6', color: '#ffffff' },
  'กำลังซ่อม': { bg: '#F59E0B', color: '#ffffff' },
  'รออนุมัติส่งซ่อม': { bg: '#A855F7', color: '#ffffff' },
  'เสีย': { bg: '#EF4444', color: '#ffffff' },
  'รออนุมัติลบ': { bg: '#A855F7', color: '#ffffff' },
  'รออนุมัติแก้ไข': { bg: '#A855F7', color: '#ffffff' }
};

const categories = ['Laptop', 'Desktop', 'Monitor', 'Printer', 'Network', 'Server', 'Mobile', 'Tablet', 'Other'];
const statuses = ['สำรอง', 'ใช้งาน', 'รออนุมัติส่งซ่อม', 'กำลังซ่อม', 'เสีย'];
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
  purchase_date: '', purchase_price: '', warranty_expire: '',
};

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

  const [searchParams, setSearchParams] = useSearchParams();

  const [moveForm, setMoveForm] = useState(emptyMoveForm);
  const [moveErrors, setMoveErrors] = useState({});
  const [moveSaving, setMoveSaving] = useState(false);
  const [moveCloseConfirmOpen, setMoveCloseConfirmOpen] = useState(false);

  // ✅ role ของผู้ใช้ปัจจุบัน — guest ดูได้อย่างเดียว ห้ามเพิ่มอุปกรณ์ใหม่
  const [userRole, setUserRole] = useState(null);
  const isGuest = userRole === 'guest';

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('devices').select('*').order('created_at', { ascending: false });
    setDevices(data || []);
    setLoading(false);
  };

  const loadUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    setUserRole(data?.role || 'user');
  };

  useEffect(() => {
    load();
    loadUserRole();

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

  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl && devices.length > 0) {
      const found = devices.find(d => String(d.id) === String(idFromUrl));
      if (found) {
        setDetailItem(found);
      }
    }
  }, [searchParams, devices]);

  // ✅ ตัด filterCategory ออกแล้ว — เหลือแค่ค้นหาด้วยข้อความอย่างเดียว
  const filtered = devices.filter((d) => {
    const combined = [d.name, d.asset_tag, d.brand, d.department, d.assigned_to]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .replace(/\s+/g, ' ');

    const tokens = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const matchSearch = tokens.length === 0 || tokens.every((token) => combined.includes(token));

    return matchSearch;
  });

  const openAdd = () => {
    // ✅ กันไว้อีกชั้น (defense in depth) — guest ห้ามเปิดฟอร์มเพิ่มอุปกรณ์ แม้ปุ่มจะถูก disable ไว้แล้ว
    if (isGuest) return;
    setEditItem(null);
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  };

  const openMove = (item) => {
    setEditItem(item);
    setMoveForm({
      device_id: item.id,
      department: item.department || '',
      assigned_to: item.assigned_to || '',
    });
    setMoveErrors({});
  };

  const handleExportXLSX = () => {
    // ✅ กันไว้อีกชั้น (defense in depth) — guest ห้ามดาวน์โหลดรายงาน แม้ปุ่มจะถูก disable ไว้แล้ว
    if (isGuest) return;
    if (!filtered.length) {
      alert("ไม่มีข้อมูลอุปกรณ์ให้ดาวน์โหลดตามเงื่อนไขที่เลือก");
      return;
    }

    const exportRows = filtered.map((d) => ({
      'รหัสอุปกรณ์': d.asset_tag || '',
      'ชื่ออุปกรณ์': d.name || '',
      'ประเภท': d.category || '',
      'สถานะ': d.status || '',
      'มอบหมายให้': d.assigned_to || '',
      'แผนก': d.department || '',
      'วันที่ซื้อ': d.purchase_date || '',
      'วันหมดประกัน': d.warranty_expire || '',
      'วันที่สร้างรายการ': d.created_at || '',
      'วันที่แก้ไขล่าสุด': d.updated_at || '',
      'อัปเดตล่าสุด': d.last_updated || '',
      'บริษัท': d.company || '',
      'ช่องทางติดต่อบริษัท': d.company_contact || '',
      'ราคาซื้อ': d.purchase_price ?? '',
      'สถานที่ติดตั้ง': d.installation_location || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);

    const headers = Object.keys(exportRows[0]);
    worksheet['!cols'] = headers.map((header) => {
      const maxLen = Math.max(
        header.length,
        ...exportRows.map((row) => String(row[header] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Devices");

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Device_Report_${today}.xlsx`);
  };

  const handleSave = async () => {
    // ✅ กันไว้อีกชั้น — guest ห้ามบันทึกอุปกรณ์ใหม่แม้จะเรียกฟังก์ชันนี้ตรงๆ
    if (isGuest) {
      alert('บัญชี guest ดูข้อมูลได้อย่างเดียว ไม่สามารถเพิ่มอุปกรณ์ได้');
      return;
    }

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
      purchase_date: form.purchase_date || null,
      warranty_expire: form.warranty_expire || null,
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
      installation_location: form.installation_location || null,
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
        {/* ✅ guest เห็นปุ่มเพิ่มอุปกรณ์อยู่เหมือนเดิม แต่กดไม่ได้และสีจางลง (opacity-30) */}
        <Button
          onClick={openAdd}
          disabled={isGuest}
          className={`gap-2 w-full sm:w-auto ${isGuest ? 'opacity-30 pointer-events-none' : ''}`}
          title={isGuest ? 'บัญชี guest ดูข้อมูลได้อย่างเดียว ไม่สามารถเพิ่มอุปกรณ์ได้' : undefined}
        >
          <Plus size={16} /> เพิ่มอุปกรณ์
        </Button>
      </div>

      {/* ✅ ตัด dropdown ฟิลเตอร์ประเภทออกแล้ว เหลือแค่ช่องค้นหา + ปุ่ม download */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="ค้นหาชื่อ, asset tag, ยี่ห้อ..." className="pl-9 h-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button
          variant="outline"
          onClick={handleExportXLSX}
          disabled={isGuest}
          className={`gap-2 w-full sm:w-auto shrink-0 ${isGuest ? 'opacity-30 pointer-events-none' : ''}`}
          title={isGuest ? 'บัญชี guest ดาวน์โหลดรายงานไม่ได้' : undefined}
        >
          <Download size={16} /> ดาวน์โหลดรายงาน
        </Button>
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

      <CloseConfirmDialog
        isOpen={closeConfirmOpen}
        setIsOpen={setCloseConfirmOpen}
        setDialogOpen={setDialogOpen}
        setErrors={setErrors}
        setForm={setForm}
        emptyForm={emptyForm}
      />

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
        setIsOpen={(open) => {
          if (!open) {
            setDetailItem(null);
            if (searchParams.get('id')) {
              searchParams.delete('id');
              setSearchParams(searchParams, { replace: true });
            }
          }
        }}
        detailItem={detailItem}
      />
    </div>
  );
}
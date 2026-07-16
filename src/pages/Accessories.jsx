import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Plus, Search, Download, PackageOpen, PackagePlus, PackageMinus, Loader2,
} from 'lucide-react';
// หมายเหตุ: เอา Trash2 ออก เพราะ import มาแล้วไม่ได้ใช้งานที่ไหนในไฟล์นี้
import * as XLSX from 'xlsx';

// ── ค่าคงที่ / ฟังก์ชันช่วยคำนวณ ──────────────────────────────
const statusColors = {
  'สำรอง': { bg: '#DCFCE7', color: '#166534' },
  'หมด': { bg: '#FFE4E6', color: '#9F1239' },
};

// คำนวณสถานะอัตโนมัติจากจำนวนคงเหลือ — 0 = หมด, มากกว่า 0 = สำรอง (สถานะมีแค่ 2 ค่านี้เท่านั้น)
const computeStatus = (qty) => (Number(qty) > 0 ? 'สำรอง' : 'หมด');

const FIXED_DEPARTMENT = 'สต๊อก'; // แผนกของอุปกรณ์เสริมทุกชิ้น fix ไว้เป็น "สต๊อก" เสมอ ไม่ต้องเลือก

// จัดรูปแบบราคาต่อหน่วยเป็นสกุลเงินบาท
const formatPrice = (price) => {
  if (price === null || price === undefined || price === '') {
    return <span className="text-muted-foreground/40 font-mono text-xs">—</span>;
  }
  return <span>฿{Number(price).toLocaleString('th-TH')}</span>;
};

const emptyForm = {
  name: '', brand: '', quantity: '1', unit: '', price: '',
};

export default function Accessories() {
  // ── State: รายการอุปกรณ์เสริม + ค้นหา ──
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ── State: สิทธิ์ผู้ใช้ปัจจุบัน (admin ปรับสต็อคได้ทันที / user ต้องส่งคำขออนุมัติ) ──
  const [userRole, setUserRole] = useState(null);
  const isAdmin = userRole === 'admin';

  // ── State: ฟอร์มเพิ่ม/ดูรายละเอียดอุปกรณ์เสริม ──
  // dialogMode: 'add' = ฟอร์มเพิ่มใหม่ แก้ไขได้ / 'view' = คลิกจากแถว โชว์แบบเดียวกันแต่ disable หมด
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('add');
  const [viewItemId, setViewItemId] = useState(null); // เก็บ id ของแถวที่กำลังดูอยู่ (ใช้ตอนกดลบ)
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // ── State: ยืนยันคำขอลบ ──
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // accessory_id ที่มีคำขอ "ลบ" ค้างอยู่ (status = Pending) — ล็อกทั้งปุ่มสต็อคและปุ่มลบของแถวนั้นไว้ก่อน
  // (คำขอปรับสต็อค 'edit_accessory' ไม่ต้องล็อก เพราะเก็บเป็น delta แล้ว
  //  หลายคนส่งคำขอพร้อมกันบนชิ้นเดียวกันได้อย่างปลอดภัย โดยไปคำนวณทับกันตอนอนุมัติแทน)
  const [pendingDeleteIds, setPendingDeleteIds] = useState(new Set());

  // ── State: Dialog เพิ่ม/ตัดสต๊อคแบบเร็ว (ไม่ต้องเปิดฟอร์มเต็ม) ──
  const [stockItem, setStockItem] = useState(null); // รายการที่กำลังปรับสต็อค
  const [stockMode, setStockMode] = useState('in');  // 'in' = เพิ่มสต็อค, 'out' = ตัดสต๊อค
  const [stockQty, setStockQty] = useState('');
  const [stockSaving, setStockSaving] = useState(false);
  const [stockError, setStockError] = useState('');

  // ── State: ดาวน์โหลดรายงาน ──
  const [reportLoading, setReportLoading] = useState(false);

  // ── Data loading ──────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('accessories')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    setItems(data || []);
    setLoading(false);
  };

  // โหลด role ของผู้ใช้ที่ล็อกอินอยู่ ใช้ตัดสินว่าจะปรับสต็อคทันทีหรือต้องขออนุมัติ
  const loadUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    setUserRole(data?.role || 'user');
  };

  // โหลดรายการ accessory ที่มีคำขอ "ลบ" ค้างอยู่ (status = Pending) ไว้ล็อกปุ่มของแถวนั้น
  const loadPendingDeletes = async () => {
    const { data, error } = await supabase
      .from('approvals')
      .select('accessory_id')
      .eq('request_type', 'delete_accessory')
      .eq('status', 'Pending');
    if (error) {
      console.error(error);
      return;
    }
    setPendingDeleteIds(new Set((data || []).map((r) => r.accessory_id)));
  };

  useEffect(() => {
    load();
    loadUserRole();
    loadPendingDeletes();

    const accessoriesChannel = supabase
      .channel('realtime-accessories-page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accessories' },
        () => { load(); }
      )
      .subscribe();

    // เมื่อมีคำขอลบใหม่/ถูกอนุมัติ-ปฏิเสธ ในตาราง approvals ให้รีเฟรชสถานะล็อกด้วย
    const approvalsChannel = supabase
      .channel('realtime-accessories-approvals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'approvals' },
        () => { loadPendingDeletes(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(accessoriesChannel);
      supabase.removeChannel(approvalsChannel);
    };
  }, []);

  // ── ข้อมูลที่กรองแล้วตามคำค้นหา ──
  const filtered = items.filter((d) => {
    const keyword = search.toLowerCase();
    return !search ||
      d.name?.toLowerCase().includes(keyword) ||
      d.brand?.toLowerCase().includes(keyword) ||
      d.department?.toLowerCase().includes(keyword);
  });

  // ── รายงาน ────────────────────────────────────────────────────
  // ส่งออกประวัติการปรับสต็อค (ตัด/เพิ่ม) ที่อนุมัติแล้วเป็นไฟล์ .xlsx
  // ดึงจากตาราง approvals (request_type = 'edit_accessory', status = 'Approved')
  // join กับ profiles เอาชื่อผู้ขอ และ accessories เอารายละเอียดอุปกรณ์
  // (ตอนนี้แอดมินก็ insert เข้า approvals แบบ Approved ทันทีเหมือนกัน จึงโผล่ใน report นี้ด้วย)
  // ⚠️ คอลัมน์ "จำนวน" คือคงเหลือปัจจุบัน ณ ตอนดาวน์โหลด ไม่ใช่คงเหลือ ณ เวลาที่ทำรายการนั้น
  const handleDownloadReport = async () => {
    setReportLoading(true);

    const { data, error } = await supabase
      .from('approvals')
      .select('*, profiles (email, full_name), accessories (name, brand, department, status, price, unit, quantity)')
      .eq('request_type', 'edit_accessory')
      .eq('status', 'Approved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      alert('ดึงข้อมูลรายงานไม่สำเร็จ: ' + error.message);
      setReportLoading(false);
      return;
    }

    const headers = [
      'ชื่อผู้ใช้', 'ชื่ออุปกรณ์เสริม', 'ยี่ห้อ', 'แผนก',
      'สถานะ', 'ราคา', 'จำนวน', 'หน่วย', 'ตัดสต็อก', 'เพิ่มสต็อก',
    ];

    const rows = (data || []).map((row) => {
      const accessory = row.accessories || {};
      const delta = row.changed_fields?.quantity_delta ?? 0;

      return [
        row.profiles?.full_name || row.profiles?.email || '—',
        accessory.name || row.accessory_name || '—',
        accessory.brand || '',
        accessory.department || '',
        accessory.status || '',
        accessory.price ?? '',
        accessory.quantity ?? '',
        accessory.unit || '',
        delta < 0 ? Math.abs(delta) : '',
        delta > 0 ? delta : '',
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 16 })); // ปรับความกว้างคอลัมน์ให้อ่านง่าย

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ประวัติปรับสต็อค');
    XLSX.writeFile(wb, `accessories-transactions-${new Date().toISOString().slice(0, 10)}.xlsx`);

    setReportLoading(false);
  };

  // ── ฟอร์มเพิ่ม / ดูรายละเอียด ──────────────────────────────────

  // เปิดฟอร์ม "เพิ่มอุปกรณ์เสริม" ใหม่ — แก้ไขได้ทุกช่อง (เฉพาะแอดมิน)
  const openAdd = () => {
    setDialogMode('add');
    setForm(emptyForm);
    setErrors({});
    setViewItemId(null);
    setDialogOpen(true);
  };

  // คลิกที่แถว → เปิด dialog แบบเดียวกับตอนเพิ่ม แต่ disable ทุกช่อง โชว์แค่ข้อมูล + ปุ่มลบ
  const openView = (item) => {
    setDialogMode('view');
    setForm({
      name: item.name || '',
      brand: item.brand || '',
      quantity: String(item.quantity ?? ''),
      unit: item.unit || '',
      price: item.price ?? '',
    });
    setErrors({});
    setViewItemId(item.id);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
  };

  const handleSave = async () => {
    if (!isAdmin) {
      alert('เฉพาะแอดมินเท่านั้นที่เพิ่มอุปกรณ์เสริมได้');
      return;
    }

    const newErrors = {};
    if (!form.name?.trim()) newErrors.name = 'กรุณากรอกชื่ออุปกรณ์เสริม';
    if (!form.quantity || Number(form.quantity) < 0) newErrors.quantity = 'กรุณากรอกจำนวนให้ถูกต้อง';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);

    const payload = {
      name: form.name,
      brand: form.brand || null, // แก้: เดิม key นี้ซ้ำกัน 2 บรรทัด ตัดเหลือบรรทัดเดียว
      quantity: Number(form.quantity),
      unit: form.unit || null,
      price: form.price !== '' ? Number(form.price) : null,
      status: computeStatus(form.quantity),
      department: FIXED_DEPARTMENT,
    };

    const result = await supabase.from('accessories').insert([payload]).select();

    if (result.error) {
      console.error(result.error);
      alert(result.error.message);
      setSaving(false);
      return;
    }

    await load();
    setDialogOpen(false);
    setSaving(false);
  };

  // ── ลบอุปกรณ์เสริม (ต้องผ่านอนุมัติเสมอ ไม่ว่า role ไหน) ──────────

  // กดลบจาก dialog view → ปิด dialog view แล้วเปิด dialog ยืนยันลบต่อ
  const handleRequestDeleteFromView = () => {
    if (!viewItemId) return;
    setDialogOpen(false);
    setDeleteId(viewItemId);
  };

  // ส่งคำขอลบเข้าระบบอนุมัติ (ไม่ลบทันที ไม่ว่าจะเป็น role ไหน) — ใช้ตาราง approvals เดียวกับหน้าอุปกรณ์
  // request_type: 'delete_accessory' ต้องมี branch รองรับใน Approve.jsx ด้วย
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);

    const item = items.find((i) => i.id === deleteId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('กรุณาเข้าสู่ระบบก่อนทำรายการ');
      setDeleting(false);
      return;
    }

    const { error } = await supabase.from('approvals').insert([{
      accessory_id: deleteId,
      accessory_name: item?.name,
      request_type: 'delete_accessory',
      status: 'Pending',
      user_id: user.id,
      description: `ขอลบอุปกรณ์เสริม ${item?.name || ''}`,
    }]);

    if (error) {
      console.error(error);
      alert(error.message);
      setDeleting(false);
      return;
    }
    setDeleteId(null);
    setDeleting(false);
  };

  // ── เพิ่มสต็อค / ตัดสต๊อค ──────────────────────────────────────

  const openStockDialog = (item, mode) => {
    setStockItem(item);
    setStockMode(mode);
    setStockQty('');
    setStockError('');
  };

  const closeStockDialog = () => {
    if (stockSaving) return;
    setStockItem(null);
  };

  const handleStockSubmit = async () => {
    if (!stockItem) return;
    setStockError('');

    const qty = Number(stockQty);
    if (!qty || qty <= 0) {
      setStockError('กรุณากรอกจำนวนให้ถูกต้อง');
      return;
    }

    setStockSaving(true);

    // ── แอดมิน: ปรับสต็อคได้ทันที (คำนวณจากคงเหลือปัจจุบันตรงๆ ไม่ผ่านคิว) ──
    // แต่ยัง insert เข้า approvals ด้วย (status = 'Approved' ทันที) เพื่อให้มีประวัติ
    // ไปโผล่ใน Download Report เหมือนกับคำขอของ user ทั่วไป
    if (isAdmin) {
      const newQuantity = stockMode === 'in'
        ? stockItem.quantity + qty
        : stockItem.quantity - qty;

      if (newQuantity < 0) {
        setStockError(`คลังมีไม่พอ (คงเหลือ ${stockItem.quantity})`);
        setStockSaving(false);
        return;
      }

      const { error } = await supabase
        .from('accessories')
        .update({ quantity: newQuantity, status: computeStatus(newQuantity) })
        .eq('id', stockItem.id);

      if (error) {
        console.error(error);
        setStockError(error.message);
        setStockSaving(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const delta = stockMode === 'in' ? qty : -qty;

      const { error: logError } = await supabase.from('approvals').insert([{
        accessory_id: stockItem.id,
        accessory_name: stockItem.name,
        request_type: 'edit_accessory',
        status: 'Approved',
        user_id: user?.id,
        approved_by_email: user?.email || 'แอดมิน',
        changed_fields: { quantity_delta: delta },
        description: `แอดมิน${stockMode === 'in' ? 'เพิ่ม' : 'ตัด'}สต็อค ${stockItem.name} จำนวน ${qty} หน่วย`,
      }]);

      if (logError) {
        // ไม่ throw ทับ error ของการอัปเดตสต็อค เพราะสต็อคอัปเดตสำเร็จไปแล้ว
        // แค่ log ไว้เฉยๆ ไม่ต้องกวนแอดมินด้วย error ของการบันทึกประวัติ
        console.error('บันทึกประวัติไม่สำเร็จ:', logError);
      }

      await load();
      setStockSaving(false);
      setStockItem(null);
      return;
    }

    // ── ผู้ใช้ทั่วไป: ส่งเป็นคำขอเข้า approvals รอแอดมินอนุมัติ ──
    // เก็บเป็น "ส่วนต่าง" (delta) ไม่ใช่ค่าคงเหลือที่คำนวณไว้ล่วงหน้า เพื่อให้หลายคนส่งคำขอ
    // พร้อมกันบนชิ้นเดียวกันได้ โดยตัวเลขจริงจะถูกคำนวณทับกันตอนแอดมินกดอนุมัติแต่ละคำขอ
    // (เช็คความพอเพียงแบบคร่าวๆ ตรงนี้จากคงเหลือ ณ ตอนกด เป็นแค่ sanity check เบื้องต้น
    //  ตัวเช็คจริงที่กันไม่ให้ติดลบอยู่ที่ตอนอนุมัติใน Approve.jsx)
    if (stockMode === 'out' && qty > stockItem.quantity) {
      setStockError(`คลังมีไม่พอ (คงเหลือ ${stockItem.quantity})`);
      setStockSaving(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStockError('กรุณาเข้าสู่ระบบก่อนทำรายการ');
      setStockSaving(false);
      return;
    }

    const delta = stockMode === 'in' ? qty : -qty;

    const { error } = await supabase.from('approvals').insert([{
      accessory_id: stockItem.id,
      accessory_name: stockItem.name,
      request_type: 'edit_accessory',
      status: 'Pending',
      user_id: user.id,
      changed_fields: { quantity_delta: delta },
      description: `ขอ${stockMode === 'in' ? 'เพิ่ม' : 'ตัด'}สต็อค ${stockItem.name} จำนวน ${qty} หน่วย`,
    }]);

    if (error) {
      console.error(error);
      setStockError(error.message);
      setStockSaving(false);
      return;
    }

    setStockSaving(false);
    setStockItem(null);
  };

  const isView = dialogMode === 'view';

  return (
    // max-w กันไม่ให้ตารางยืดกว้างเกินไปบนจอใหญ่ (เช่น 27 นิ้ว) แต่ยัง full-width บนจอเล็ก/มือถือ
    <div className="space-y-5 max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6">
      {/* ── หัวข้อหน้า + ปุ่มเพิ่ม (เฉพาะแอดมิน) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground font-heading flex items-center gap-2">
          <PackageOpen className="text-primary" size={22} />
          อุปกรณ์เสริม
        </h2>
        {isAdmin && (
          <Button onClick={openAdd} className="gap-2 w-full sm:w-auto">
            <Plus size={16} /> เพิ่มอุปกรณ์เสริม
          </Button>
        )}
      </div>

      {/* ── แถบค้นหา + ปุ่มดาวน์โหลดรายงาน ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ค้นหาชื่อ, ยี่ห้อ, แผนก..."
            className="pl-9 h-10 w-full"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          className="gap-2 w-full sm:w-auto"
          onClick={handleDownloadReport}
          disabled={reportLoading}
        >
          {reportLoading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          Download Report
        </Button>
      </div>

      {/* ── MOBILE VIEW (< md): การ์ดแทนตารางที่มี 8 คอลัมน์ (แน่นเกินจอมือถือ) ── */}
      {/* ดีไซน์การ์ด: ชื่อ + badge สถานะด้านบน, รายละเอียดยี่ห้อ/แผนกเป็น 2 คอลัมน์,
          แถบเตือนสีเหลืองถ้ามีคำขอลบค้างอยู่ และไอคอนจัดการ (ดู/เพิ่ม/ตัดสต็อค) แถวล่างขวา */}
      <div className="md:hidden space-y-3">
        {loading && (
          <div className="text-center py-10 text-muted-foreground bg-card border border-border rounded-xl">
            <Loader2 className="animate-spin inline-block mr-2" size={16} /> กำลังโหลด...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground bg-card border border-border rounded-xl">
            ไม่พบข้อมูลอุปกรณ์เสริม
          </div>
        )}

        {!loading && filtered.map((item) => {
          const isLocked = pendingDeleteIds.has(item.id); // มีคำขอ "ลบ" ค้างอยู่ รอแอดมินอนุมัติ

          return (
            <div
              key={item.id}
              className="bg-card border border-border rounded-xl p-4 space-y-3 cursor-pointer"
              onClick={() => openView(item)}
            >
              {/* แถวบน: ชื่ออุปกรณ์ + badge สถานะ */}
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm text-foreground truncate">{item.name}</p>
                <span
                  className="px-2 py-1 rounded-full text-xs font-medium shrink-0"
                  style={{
                    background: statusColors[item.status]?.bg || '#F1F5F9',
                    color: statusColors[item.status]?.color || '#000',
                  }}
                >
                  {item.status}
                </span>
              </div>

              {/* รายละเอียด 2 คอลัมน์: ยี่ห้อ / แผนก และ ราคา / จำนวน+หน่วย */}
              <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                <div>
                  <span className="text-muted-foreground">ยี่ห้อ: </span>
                  <span className="text-foreground">{item.brand || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">แผนก: </span>
                  <span className="text-foreground">{item.department || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">ราคา: </span>
                  <span className="text-foreground">{formatPrice(item.price)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">จำนวน: </span>
                  <span className="text-foreground">{item.quantity} {item.unit || ''}</span>
                </div>
              </div>

              {/* แถวล่าง: แถบเตือนคำขอลบค้าง (ถ้ามี) + ไอคอนจัดการ */}
              <div className="flex items-center justify-between pt-1">
                {isLocked ? (
                  <span className="text-[11px] font-medium px-2 py-1 rounded-md bg-amber-50 text-amber-600">
                    ⚠ รออนุมัติลบ
                  </span>
                ) : <span />}

                <div className="flex gap-1">
                  <Button
                    variant="ghost" size="icon"
                    disabled={isLocked}
                    className={`h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 ${isLocked ? 'opacity-30 pointer-events-none' : ''}`}
                    title={isLocked ? 'ล็อกไว้ระหว่างรออนุมัติลบ' : 'เพิ่มสต็อค'}
                    onClick={(e) => { e.stopPropagation(); openStockDialog(item, 'in'); }}
                  >
                    <PackagePlus size={16} />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    disabled={isLocked}
                    className={`h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 ${isLocked ? 'opacity-30 pointer-events-none' : ''}`}
                    title={isLocked ? 'ล็อกไว้ระหว่างรออนุมัติลบ' : 'ตัดสต๊อค'}
                    onClick={(e) => { e.stopPropagation(); openStockDialog(item, 'out'); }}
                  >
                    <PackageMinus size={16} />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── DESKTOP / TABLET VIEW (md ขึ้นไป): ตารางเดิม ── */}
      {/* overflow-x-auto: บนจอแท็บเล็ตที่แคบกว่า min-w ตารางเลื่อนซ้าย-ขวาได้แทนที่จะบีบคอลัมน์จนอ่านไม่ออก */}
      <div className="hidden md:block rounded-xl border bg-card overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>ชื่ออุปกรณ์เสริม</TableHead>
              <TableHead>ยี่ห้อ</TableHead>
              <TableHead>แผนก</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead>ราคา</TableHead>
              <TableHead className="text-center">จำนวน</TableHead>
              <TableHead className="text-center">หน่วย</TableHead>
              <TableHead className="text-right">สต็อค</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  <Loader2 className="animate-spin inline-block mr-2" size={16} /> กำลังโหลด...
                </TableCell>
              </TableRow>
            )}

            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  ไม่พบข้อมูลอุปกรณ์เสริม
                </TableCell>
              </TableRow>
            )}

            {!loading && filtered.map((item) => {
              const isLocked = pendingDeleteIds.has(item.id); // มีคำขอ "ลบ" ค้างอยู่ รอแอดมินอนุมัติ

              return (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => openView(item)}
                  title={isLocked ? 'รายการนี้มีคำขอลบค้างอยู่ รอการอนุมัติ' : 'คลิกเพื่อดูรายละเอียด'}
                >
                  <TableCell className="font-medium">
                    {item.name}
                    {isLocked && (
                      <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 align-middle">
                        รออนุมัติลบ
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{item.brand || '-'}</TableCell>
                  <TableCell>{item.department || '-'}</TableCell>
                  <TableCell>
                    <span
                      className="px-2 py-1 rounded-md text-xs font-medium"
                      style={{
                        background: statusColors[item.status]?.bg || '#F1F5F9',
                        color: statusColors[item.status]?.color || '#000',
                      }}
                    >
                      {item.status}
                    </span>
                  </TableCell>
                  <TableCell>{formatPrice(item.price)}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-center">{item.unit || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost" size="icon"
                        disabled={isLocked}
                        className={`h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 ${isLocked ? 'opacity-30 pointer-events-none' : ''}`}
                        title={isLocked ? 'ล็อกไว้ระหว่างรออนุมัติลบ' : 'เพิ่มสต็อค'}
                        onClick={(e) => { e.stopPropagation(); openStockDialog(item, 'in'); }}
                      >
                        <PackagePlus size={16} />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        disabled={isLocked}
                        className={`h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 ${isLocked ? 'opacity-30 pointer-events-none' : ''}`}
                        title={isLocked ? 'ล็อกไว้ระหว่างรออนุมัติลบ' : 'ตัดสต๊อค'}
                        onClick={(e) => { e.stopPropagation(); openStockDialog(item, 'out'); }}
                      >
                        <PackageMinus size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/*
        ── Dialog เพิ่ม/ดูรายละเอียด ──
        ฟอร์มเดียวใช้ 2 โหมด:
        - add  : เพิ่มอุปกรณ์เสริมใหม่ แก้ไขได้ทุกช่อง ปุ่ม ยกเลิก + บันทึก (เฉพาะแอดมิน)
        - view : คลิกจากแถว โชว์ค่าเดิมแบบ readonly ทุกช่อง (disabled) ปุ่ม ยกเลิก + ลบ เท่านั้น
      */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isView ? 'รายละเอียดอุปกรณ์เสริม' : 'เพิ่มอุปกรณ์เสริม'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-sm font-medium">ชื่ออุปกรณ์เสริม *</label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น เมาส์ไร้สาย Logitech"
                disabled={isView}
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">ยี่ห้อ</label>
              <Input
                value={form.brand}
                onChange={e => setForm({ ...form, brand: e.target.value })}
                disabled={isView}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">จำนวน *</label>
              <Input
                type="number"
                min="0"
                value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })}
                disabled={isView}
              />
              {errors.quantity && <p className="text-xs text-red-500">{errors.quantity}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">หน่วย</label>
              <Input
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
                placeholder="เช่น ชิ้น, กล่อง, เส้น"
                disabled={isView}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">ราคาต่อหน่วย (บาท)</label>
              <Input
                type="number"
                min="0"
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
                placeholder="เช่น 50"
                disabled={isView}
              />
            </div>

            {/* สถานะและแผนก: คำนวณ/กำหนดอัตโนมัติเสมอ ไม่ให้แก้เอง จึง disabled ทั้งสองโหมด */}
            <div className="space-y-1">
              <label className="text-sm font-medium">สถานะ</label>
              <Input value={computeStatus(form.quantity)} disabled />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">แผนก</label>
              <Input value={FIXED_DEPARTMENT} disabled />
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button className="text-xs hover:bg-[#111827] hover:text-white w-full sm:w-auto" variant="outline" onClick={closeDialog} disabled={saving}>
              ยกเลิก
            </Button>
            {isView ? (
              <Button
                variant="outline"
                onClick={handleRequestDeleteFromView}
                disabled={pendingDeleteIds.has(viewItemId)}
                className={`text-xs hover:bg-[#111827] hover:text-white w-full sm:w-auto ${pendingDeleteIds.has(viewItemId) ? 'opacity-30 pointer-events-none' : ''}`}
                title={pendingDeleteIds.has(viewItemId) ? 'มีคำขอลบค้างอยู่แล้ว รอการอนุมัติ' : 'ลบ'}
              >
                {/* แก้: เดิมข้อความ "ส่งอนุมัติขอลบ" ต่อกับ ternary ทำให้ปุ่มมี 2 ข้อความซ้อนกัน เหลือแบบเดียว */}
                {pendingDeleteIds.has(viewItemId) ? 'รออนุมัติลบ' : 'ส่งอนุมัติขอลบ'}
              </Button>
            ) : (
              <Button className="text-xs hover:bg-[#111827] hover:text-white w-full sm:w-auto" variant="outline" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="animate-spin" size={16} />}
                บันทึก
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog ยืนยันการลบ → ส่งเป็นคำขอเข้า approvals รอแอดมินอนุมัติ (ไม่ลบทันที) ── */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ต้องการส่งคำขอลบอุปกรณ์เสริมนี้ใช่หรือไม่? ต้องรอแอดมินอนุมัติก่อนจึงจะลบจริง
          </p>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button className="text-xs hover:bg-[#111827] hover:text-white w-full sm:w-auto" variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              ยกเลิก
            </Button>
            <Button className="text-xs hover:bg-[#111827] hover:text-white w-full sm:w-auto gap-2" variant="outline" onClick={handleDelete} disabled={deleting}>
              {/* แก้: เดิม {deleting} render ค่า boolean ตรงๆ ในปุ่ม (เห็นคำว่า "true/false" โผล่ตอนกำลังส่ง) เปลี่ยนเป็น spinner แบบเดียวกับปุ่มอื่น */}
              {deleting && <Loader2 className="animate-spin" size={16} />}
              ส่งคำขอลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog เพิ่มสต็อค / ตัดสต๊อค แบบเร็ว ── */}
      <Dialog open={!!stockItem} onOpenChange={(open) => !open && closeStockDialog()}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {stockMode === 'in' ? <PackagePlus size={16} className="text-emerald-600" /> : <PackageMinus size={16} className="text-amber-600" />}
              {stockMode === 'in' ? 'เพิ่มสต็อค' : 'ตัดสต๊อค'}: {stockItem?.name}
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            คงเหลือปัจจุบัน:{' '}
            <span className={`font-semibold ${stockItem?.quantity === 0 ? 'text-red-600' : 'text-foreground'}`}>
              {stockItem?.quantity} {stockItem?.unit || ''}
            </span>
            {/* แก้: ย้าย error message ออกมาเป็นบรรทัดของตัวเอง เดิมซ้อนอยู่ใน <span> เดียวกับคงเหลือ ทำให้ข้อความติดกัน */}
            {stockError && (
              <span className="block text-red-600 mt-1">{stockError}</span>
            )}
          </p>

          <div className="space-y-1">
            <label className="text-sm font-medium">จำนวนที่ต้องการ{stockMode === 'in' ? 'เพิ่ม' : 'ตัด'}</label>
            <Input
              type="number"
              min="1"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              autoFocus
            />
          </div>

          {!isAdmin && (
            <p className="text-[11px] text-muted-foreground">
              บัญชีของคุณเป็นผู้ใช้ทั่วไป การดำเนินการนี้จะถูกส่งเป็นคำขอ รอแอดมินอนุมัติก่อนจึงจะมีผลจริง
              (สามารถส่งคำขอได้พร้อมกันหลายคน ระบบจะคำนวณให้ตอนอนุมัติ)
            </p>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button className="text-xs hover:bg-[#111827] hover:text-white w-full sm:w-auto" variant="outline" onClick={closeStockDialog} disabled={stockSaving}>
              ยกเลิก
            </Button>
            <Button className="text-xs hover:bg-[#111827] hover:text-white w-full sm:w-auto gap-2" variant="outline" onClick={handleStockSubmit} disabled={stockSaving}>
              {stockSaving && <Loader2 className="animate-spin" size={16} />}
              {isAdmin ? 'บันทึก' : 'ส่งคำขอ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
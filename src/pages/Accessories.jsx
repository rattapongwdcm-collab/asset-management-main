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
import * as XLSX from 'xlsx';

import DepartmentDropdown from '@/components/Accessories/DepartmentDropdown';
import AccessoryMobileCard from '@/components/Accessories/AccessoryMobileCard';
import AccessoryTableRow from '@/components/Accessories/AccessoryTableRow';
import { computeStatus } from "@/lib/accessoryHelpers";
import { DEPARTMENTS } from '../lib/Departments';

const emptyForm = {
  name: '', brand: '', quantity: '1', unit: '', price: '', department: '',
};

export default function Accessories() {
  // ── State: รายการอุปกรณ์เสริม + ค้นหา ──
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ── State: สิทธิ์ผู้ใช้ปัจจุบัน ──
  // admin        = ปรับสต็อคได้ทันที + เพิ่ม/ลบอุปกรณ์เสริมได้
  // user (ทั่วไป) = ต้องส่งคำขออนุมัติทุกอย่าง (เพิ่ม/ตัดสต็อค, ลบ)
  // guest        = ดูได้อย่างเดียว + ตัดสต๊อคได้ (ผ่านคำขออนุมัติเหมือน user) แต่เพิ่มสต็อค/ลบทำไม่ได้เลย
  const [userRole, setUserRole] = useState(null);
  const isAdmin = userRole === 'admin';
  const isGuest = userRole === 'guest';

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
  // เดือนที่จะใช้ดึงรายงาน (รูปแบบ YYYY-MM) — ค่าเริ่มต้นเป็นเดือนปัจจุบัน
  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

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

  // โหลด role ของผู้ใช้ที่ล็อกอินอยู่ ใช้ตัดสินว่าจะปรับสต็อคทันทีหรือต้องขออนุมัติ หรือดูได้อย่างเดียว (guest)
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

  // ใช้ลิสต์แผนกคงที่ (DEPARTMENTS) เป็นตัวเลือกในดรอปดาวน์ — ตรงกับหน้า Devices
  const departmentOptions = DEPARTMENTS;

  // ── รายงาน ────────────────────────────────────────────────────
  // ส่งออกประวัติการปรับสต็อค (ตัด/เพิ่ม) ที่อนุมัติแล้วเป็นไฟล์ .xlsx
  // ดึงจากตาราง approvals (request_type = 'edit_accessory', status = 'Approved')
  // join กับ profiles เอาชื่อผู้ขอ และ accessories เอารายละเอียดอุปกรณ์
  // (ตอนนี้แอดมินก็ insert เข้า approvals แบบ Approved ทันทีเหมือนกัน จึงโผล่ใน report นี้ด้วย)
  // แต่ละธุรกรรม (ตัด/เพิ่ม 1 ครั้ง) = 1 แถว เหมือนเดิม (ไม่รวมแถว)
  // ✅ เลือกเดือนที่จะดาวน์โหลดได้ (state reportMonth) — ดึงเฉพาะรายการที่อนุมัติภายในเดือนที่เลือกเท่านั้น
  // เดือนอื่นๆ ไม่ได้หายไปไหน ยังอยู่ในฐานข้อมูลปกติ แค่เลือกดูทีละเดือนผ่านตัวเลือกเดือนด้านบน
  // ⚠️ คอลัมน์ "จำนวน" คือคงเหลือปัจจุบัน ณ ตอนดาวน์โหลด ไม่ใช่คงเหลือ ณ เวลาที่ทำรายการนั้น
  const handleDownloadReport = async () => {
    // ✅ กันไว้อีกชั้น (defense in depth) — guest ห้ามดาวน์โหลดรายงาน แม้ปุ่มจะถูก disable ไว้แล้ว
    if (isGuest) return;
    setReportLoading(true);

    // ขอบเขตของเดือนที่เลือก (reportMonth รูปแบบ "YYYY-MM"): ตั้งแต่วันที่ 1 เวลา 00:00
    // ถึงก่อนวันที่ 1 ของเดือนถัดไป
    const [reportYear, reportMonthNum] = reportMonth.split('-').map(Number);
    const startOfMonth = new Date(reportYear, reportMonthNum - 1, 1).toISOString();
    const startOfNextMonth = new Date(reportYear, reportMonthNum, 1).toISOString();

    const { data, error } = await supabase
      .from('approvals')
      .select('*, profiles (email, full_name), accessories (name, brand, department, status, price, unit, quantity)')
      .eq('request_type', 'edit_accessory')
      .eq('status', 'Approved')
      .gte('created_at', startOfMonth)
      .lt('created_at', startOfNextMonth)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      alert('ดึงข้อมูลรายงานไม่สำเร็จ: ' + error.message);
      setReportLoading(false);
      return;
    }

    const headers = [
      'วันที่/เวลา', 'ชื่อผู้ใช้', 'ชื่ออุปกรณ์เสริม', 'ยี่ห้อ', 'แผนก',
      'สถานะ', 'ราคา', 'จำนวน', 'หน่วย', 'ตัดสต็อก', 'เพิ่มสต็อก',
    ];

    const rows = (data || []).map((row) => {
      const accessory = row.accessories || {};
      const delta = row.changed_fields?.quantity_delta ?? 0;

      return [
        row.created_at ? new Date(row.created_at).toLocaleString('th-TH') : '—',
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
    XLSX.writeFile(wb, `accessories-transactions-${reportMonth}.xlsx`);

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
      department: item.department || '',
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
    if (!form.department?.trim()) newErrors.department = 'กรุณาเลือกหรือกรอกแผนก';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);

    const payload = {
      name: form.name,
      brand: form.brand || null,
      quantity: Number(form.quantity),
      unit: form.unit || null,
      price: form.price !== '' ? Number(form.price) : null,
      status: computeStatus(form.quantity),
      department: form.department.trim(),
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

  // ── ลบอุปกรณ์เสริม (ต้องผ่านอนุมัติเสมอ ไม่ว่า role ไหน — ยกเว้น guest ที่ทำไม่ได้เลย) ──

  // กดลบจาก dialog view → ปิด dialog view แล้วเปิด dialog ยืนยันลบต่อ
  const handleRequestDeleteFromView = () => {
    if (isGuest) return; // กันไว้อีกชั้น — guest ไม่มีสิทธิ์ขอลบ (ปุ่มถูกซ่อนไปแล้วในหน้า UI)
    if (!viewItemId) return;
    setDialogOpen(false);
    setDeleteId(viewItemId);
  };

  // ส่งคำขอลบเข้าระบบอนุมัติ (ไม่ลบทันที ไม่ว่าจะเป็น role ไหน) — ใช้ตาราง approvals เดียวกับหน้าอุปกรณ์
  // request_type: 'delete_accessory' ต้องมี branch รองรับใน Approve.jsx ด้วย
  const handleDelete = async () => {
    if (isGuest) {
      alert('บัญชี guest ดูข้อมูลได้อย่างเดียว ไม่สามารถขอลบอุปกรณ์เสริมได้');
      return;
    }
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

    // อัปเดต pendingDeleteIds ทันที ไม่รอ Realtime (เผื่อ Realtime ยังไม่ได้เปิด replication
    // ให้ตาราง approvals หรือมี delay) — ล็อกแถวนี้ให้เห็นผลทันทีโดยไม่ต้องรีเฟรชเอง
    setPendingDeleteIds((prev) => new Set(prev).add(deleteId));

    setDeleteId(null);
    setDeleting(false);
  };

  // ── เพิ่มสต็อค / ตัดสต๊อค ──────────────────────────────────────

  const openStockDialog = (item, mode) => {
    // ✅ guest ทำได้แค่ "ตัดสต๊อค" (out) เท่านั้น — กันไว้อีกชั้นเผื่อมีทางเรียกเข้ามาตรงๆ
    if (isGuest && mode === 'in') {
      alert('บัญชี guest ดูข้อมูลได้อย่างเดียว และตัดสต๊อคได้เท่านั้น ไม่สามารถเพิ่มสต็อคได้');
      return;
    }
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

    // ✅ กันไว้อีกชั้น — guest ห้ามเพิ่มสต็อคแม้จะเรียกฟังก์ชันนี้ตรงๆ
    if (isGuest && stockMode === 'in') {
      setStockError('บัญชี guest ไม่สามารถเพิ่มสต็อคได้');
      return;
    }

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

    // ── ผู้ใช้ทั่วไป / guest: ส่งเป็นคำขอเข้า approvals รอแอดมินอนุมัติ ──
    // (guest จะเข้าทางนี้ได้แค่ mode 'out' เท่านั้น เพราะเช็คกันไว้ตั้งแต่ต้นฟังก์ชันแล้ว)
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

      {/* ── แถบค้นหา + เลือกเดือน + ปุ่มดาวน์โหลดรายงาน ── */}
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
        {/* เลือกเดือนที่จะดาวน์โหลดรายงาน — ค่าเริ่มต้นเป็นเดือนปัจจุบัน
            onClick เรียก showPicker() เพื่อให้คลิกตรงไหนของช่องก็เปิดปฏิทินได้เลย ไม่ต้องเล็งคลิกแค่ไอคอน */}
        <Input
          type="month"
          className="h-10 w-full sm:w-40 cursor-pointer"
          value={reportMonth}
          onChange={(e) => setReportMonth(e.target.value)}
          onClick={(e) => e.target.showPicker?.()}
          disabled={isGuest}
        />
        <Button
          variant="outline"
          className={`gap-2 w-full sm:w-auto ${isGuest ? 'opacity-30 pointer-events-none' : ''}`}
          onClick={handleDownloadReport}
          disabled={reportLoading || isGuest}
          title={isGuest ? 'บัญชี guest ดาวน์โหลดรายงานไม่ได้' : undefined}
        >
          {reportLoading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          ดาวน์โหลดรายงาน
        </Button>
      </div>


      {/* ── MOBILE VIEW (< md): การ์ดแทนตารางที่มี 8 คอลัมน์ (แน่นเกินจอมือถือ) ── */}
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

        {!loading && filtered.map((item) => (
          <AccessoryMobileCard
            key={item.id}
            item={item}
            isLocked={pendingDeleteIds.has(item.id)}
            isGuest={isGuest}
            onView={openView}
            onStockIn={(i) => openStockDialog(i, 'in')}
            onStockOut={(i) => openStockDialog(i, 'out')}
          />
        ))}
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

            {!loading && filtered.map((item) => (
              <AccessoryTableRow
                key={item.id}
                item={item}
                isLocked={pendingDeleteIds.has(item.id)}
                isGuest={isGuest}
                onView={openView}
                onStockIn={(i) => openStockDialog(i, 'in')}
                onStockOut={(i) => openStockDialog(i, 'out')}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/*
        ── Dialog เพิ่ม/ดูรายละเอียด ──
        ฟอร์มเดียวใช้ 2 โหมด:
        - add  : เพิ่มอุปกรณ์เสริมใหม่ แก้ไขได้ทุกช่อง ปุ่ม ยกเลิก + บันทึก (เฉพาะแอดมิน)
        - view : คลิกจากแถว โชว์ค่าเดิมแบบ readonly ทุกช่อง (disabled) ปุ่ม ยกเลิก + ลบ (ยกเว้น guest ไม่เห็นปุ่มลบ)
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

            {/* แผนก: โหมด add = ดรอปดาวน์ค้นหา (เหมือน SearchableDropdown ใน DeviceFormDialog.jsx)
                โหมด view = แสดงค่าเดิมแบบ disabled เหมือนช่องอื่นๆ ไม่ต้องมีดรอปดาวน์ */}
            {isView ? (
              <div className="space-y-1">
                <label className="text-sm font-medium">แผนก</label>
                <Input value={form.department} disabled />
              </div>
            ) : (
              <DepartmentDropdown
                value={form.department}
                onChange={(val) => setForm((f) => ({ ...f, department: val }))}
                options={departmentOptions}
                error={errors.department}
                onClearError={() => setErrors((prev) => ({ ...prev, department: '' }))}
              />
            )}

            {/* สถานะ: คำนวณอัตโนมัติเสมอ ไม่ให้แก้เอง */}
            <div className="space-y-1">
              <label className="text-sm font-medium">สถานะ</label>
              <Input value={computeStatus(form.quantity)} disabled />
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
                disabled={pendingDeleteIds.has(viewItemId) || isGuest}
                className={`text-xs hover:bg-[#111827] hover:text-white w-full sm:w-auto ${(pendingDeleteIds.has(viewItemId) || isGuest) ? 'opacity-30 pointer-events-none' : ''}`}
                title={isGuest ? 'บัญชี guest ขอลบไม่ได้' : (pendingDeleteIds.has(viewItemId) ? 'มีคำขอลบค้างอยู่แล้ว รอการอนุมัติ' : 'ลบ')}
              >
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
              {isGuest
                ? 'บัญชีของคุณเป็น guest การตัดสต๊อคนี้จะถูกส่งเป็นคำขอ รอแอดมินอนุมัติก่อนจึงจะมีผลจริง'
                : 'บัญชีของคุณเป็นผู้ใช้ทั่วไป การดำเนินการนี้จะถูกส่งเป็นคำขอ รอแอดมินอนุมัติก่อนจึงจะมีผลจริง (สามารถส่งคำขอได้พร้อมกันหลายคน ระบบจะคำนวณให้ตอนอนุมัติ)'}
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
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Plus, Search, Filter, PackageOpen, PackagePlus, PackageMinus, Trash2, Loader2,
} from 'lucide-react';

const statusColors = {
  'สำรอง': { bg: '#DCFCE7', color: '#166534' },
  'หมด': { bg: '#FFE4E6', color: '#9F1239' },
};

// คำนวณสถานะอัตโนมัติจากจำนวนคงเหลือ — 0 = หมด, มากกว่า 0 = สำรอง (สถานะมีแค่ 2 ค่านี้เท่านั้น)
const computeStatus = (qty) => (Number(qty) > 0 ? 'สำรอง' : 'หมด');

const categories = ['เมาส์', 'คีย์บอร์ด', 'สายเคเบิล', 'อะแดปเตอร์', 'หูฟัง', 'เว็บแคม', 'อื่นๆ'];
const FIXED_DEPARTMENT = 'สต๊อก'; // แผนกของอุปกรณ์เสริมทุกชิ้น fix ไว้เป็น "สต๊อก" เสมอ ไม่ต้องเลือก

// จัดรูปแบบราคาต่อหน่วยเป็นสกุลเงินบาท
const formatPrice = (price) => {
  if (price === null || price === undefined || price === '') {
    return <span className="text-muted-foreground/40 font-mono text-xs">—</span>;
  }
  return <span>฿{Number(price).toLocaleString('th-TH')}</span>;
};

const emptyForm = {
  name: '', category: '', brand: '', quantity: '1', price: '',
};

export default function Accessories() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // dialogMode: 'add' = ฟอร์มเพิ่มใหม่ แก้ไขได้ / 'view' = คลิกจากแถว โชว์แบบเดียวกันแต่ disable หมด
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('add');
  const [viewItemId, setViewItemId] = useState(null); // เก็บ id ของแถวที่กำลังดูอยู่ (ใช้ตอนกดลบ)
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // accessory_id ที่มีคำขอลบค้างอยู่ (รอแอดมินอนุมัติ) — ใช้ล็อกปุ่มสต็อคของแถวนั้นไว้ก่อน กันแก้จำนวนซ้อนกับคำขอลบ
  const [pendingDeleteIds, setPendingDeleteIds] = useState(new Set());

  // ── Dialog เพิ่ม/ตัดสต๊อคแบบเร็ว (ไม่ต้องเปิดฟอร์มเต็ม) ──
  const [stockItem, setStockItem] = useState(null); // รายการที่กำลังปรับสต็อค
  const [stockMode, setStockMode] = useState('in');  // 'in' = เพิ่มสต็อค, 'out' = ตัดสต๊อค
  const [stockQty, setStockQty] = useState('');
  const [stockSaving, setStockSaving] = useState(false);
  const [stockError, setStockError] = useState('');

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

  // โหลดรายการ accessory ที่มีคำขอลบค้างอยู่ (status = Pending) ไว้ล็อกปุ่มสต็อคของแถวนั้น
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
    loadPendingDeletes();

    const accessoriesChannel = supabase
      .channel('realtime-accessories-page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accessories' },
        () => { load(); }
      )
      .subscribe();

    // เมื่อมีคำขอลบใหม่/ถูกอนุมัติ-ปฏิเสธ ในตาราง approvals ให้รีเฟรชสถานะล็อกปุ่มสต็อคด้วย
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

  const filtered = items.filter((d) => {
    const keyword = search.toLowerCase();
    const matchSearch = !search ||
      d.name?.toLowerCase().includes(keyword) ||
      d.brand?.toLowerCase().includes(keyword) ||
      d.department?.toLowerCase().includes(keyword);

    const matchCategory = filterCategory === 'all' || d.category === filterCategory;
    return matchSearch && matchCategory;
  });

  // เปิดฟอร์ม "เพิ่มอุปกรณ์เสริม" ใหม่ — แก้ไขได้ทุกช่อง
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
      category: item.category || '',
      brand: item.brand || '',
      quantity: String(item.quantity ?? ''),
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
    const newErrors = {};
    if (!form.name?.trim()) newErrors.name = 'กรุณากรอกชื่ออุปกรณ์เสริม';
    if (!form.category) newErrors.category = 'กรุณาเลือกประเภท';
    if (!form.quantity || Number(form.quantity) < 0) newErrors.quantity = 'กรุณากรอกจำนวนให้ถูกต้อง';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);

    const payload = {
      name: form.name,
      category: form.category,
      brand: form.brand || null,
      quantity: Number(form.quantity),
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

  // กดลบจาก dialog view → ปิด dialog view แล้วเปิด dialog ยืนยันลบต่อ
  const handleRequestDeleteFromView = () => {
    if (!viewItemId) return;
    setDialogOpen(false);
    setDeleteId(viewItemId);
  };

  // ส่งคำขอลบเข้าระบบอนุมัติ (ไม่ลบทันที) — ใช้ตาราง approvals เดียวกับหน้าอุปกรณ์
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

    alert('ส่งคำขอลบแล้ว รอการอนุมัติจากแอดมิน');
    setDeleteId(null);
    setDeleting(false);
  };

  // ── เพิ่มสต็อค / ตัดสต๊อค ──
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

    const newQuantity = stockMode === 'in'
      ? stockItem.quantity + qty
      : stockItem.quantity - qty;

    if (newQuantity < 0) {
      setStockError(`คลังมีไม่พอ (คงเหลือ ${stockItem.quantity})`);
      return;
    }

    setStockSaving(true);
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

    await load();
    setStockSaving(false);
    setStockItem(null);
  };

  const isView = dialogMode === 'view';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
            <PackageOpen className="text-primary" size={22} />
            อุปกรณ์เสริม
          </h2>
        </div>
        <Button onClick={openAdd} className="gap-2 w-full sm:w-auto">
          <Plus size={16} /> เพิ่มอุปกรณ์เสริม
        </Button>
      </div>

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
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-40 bg-card">
            <Filter size={14} className="mr-2 text-muted-foreground" />
            <SelectValue placeholder="ประเภทอุปกรณ์" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกประเภท</SelectItem>
            {categories.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่ออุปกรณ์เสริม</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead>ยี่ห้อ</TableHead>
              <TableHead>แผนก</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead>ราคา</TableHead>
              <TableHead className="text-center">จำนวน</TableHead>
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
              const isLocked = pendingDeleteIds.has(item.id); // มีคำขอลบค้างอยู่ รอแอดมินอนุมัติ

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
                  <TableCell>{item.category}</TableCell>
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
        ฟอร์มเดียวใช้ 2 โหมด:
        - add  : เพิ่มอุปกรณ์เสริมใหม่ แก้ไขได้ทุกช่อง ปุ่ม ยกเลิก + บันทึก
        - view : คลิกจากแถว โชว์ค่าเดิมแบบ readonly ทุกช่อง (disabled) ปุ่ม ยกเลิก + ลบ เท่านั้น
      */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
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
              <label className="text-sm font-medium">ประเภท *</label>
              <Select
                value={form.category}
                onValueChange={v => setForm({ ...form, category: v })}
                disabled={isView}
              >
                <SelectTrigger><SelectValue placeholder="เลือกประเภท" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-red-500">{errors.category}</p>}
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

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              ยกเลิก
            </Button>
            {isView ? (
              <Button
                variant="destructive"
                onClick={handleRequestDeleteFromView}
                disabled={pendingDeleteIds.has(viewItemId)}
                className={`gap-2 ${pendingDeleteIds.has(viewItemId) ? 'opacity-30 pointer-events-none' : ''}`}
                title={pendingDeleteIds.has(viewItemId) ? 'มีคำขอลบค้างอยู่แล้ว รอการอนุมัติ' : 'ลบ'}
              >
                <Trash2 size={16} />
                {pendingDeleteIds.has(viewItemId) ? 'รออนุมัติลบ' : 'ลบ'}
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving && <Loader2 className="animate-spin" size={16} />}
                บันทึก
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ยืนยันการลบ → ส่งเป็นคำขอเข้า approvals รอแอดมินอนุมัติ (ไม่ลบทันที) */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ต้องการส่งคำขอลบอุปกรณ์เสริมนี้ใช่หรือไม่? ต้องรอแอดมินอนุมัติก่อนจึงจะลบจริง
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
              {deleting && <Loader2 className="animate-spin" size={16} />}
              ส่งคำขอลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* เพิ่มสต็อค / ตัดสต๊อค แบบเร็ว */}
      <Dialog open={!!stockItem} onOpenChange={(open) => !open && closeStockDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {stockMode === 'in' ? <PackagePlus size={16} className="text-emerald-600" /> : <PackageMinus size={16} className="text-amber-600" />}
              {stockMode === 'in' ? 'เพิ่มสต็อค' : 'ตัดสต๊อค'}: {stockItem?.name}
            </DialogTitle>
          </DialogHeader>

          {stockError && (
            <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">{stockError}</div>
          )}

          <p className="text-xs text-muted-foreground">
            คงเหลือปัจจุบัน: <span className="font-semibold text-foreground">{stockItem?.quantity}</span>
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

          <DialogFooter>
            <Button variant="outline" onClick={closeStockDialog} disabled={stockSaving}>
              ยกเลิก
            </Button>
            <Button onClick={handleStockSubmit} disabled={stockSaving} className="gap-2">
              {stockSaving && <Loader2 className="animate-spin" size={16} />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Pencil, Trash2, PackageOpen, Filter, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const statusColors = {
  Active: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  Returned: { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' },
  Overdue: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  Lost: { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
};

const statuses = ['Active', 'Returned', 'Overdue', 'Lost'];

const emptyForm = {
  rental_no: '', device_id: '', device_name: '', borrower_name: '', borrower_department: '',
  purpose: '', status: 'Active', borrow_date: '', due_date: '', return_date: '', notes: '',
};

export default function Rent() {
  const [rents, setRents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const load = async () => {
    const { data } = await supabase.from('rents').select('*').order('created_at', { ascending: false });
    setRents(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = rents.filter(r => {
    const matchSearch = !search || r.device_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.borrower_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.rental_no?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const openAdd = () => { setEditItem(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item) => { setEditItem(item); setForm({ ...emptyForm, ...item }); setDialogOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form };
    if (!payload.borrow_date) payload.borrow_date = null;
    if (!payload.due_date) payload.due_date = null;
    if (!payload.return_date) payload.return_date = null;
    if (editItem) {
      await supabase.from('rents').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('rents').insert(payload);
    }
    await load();
    setDialogOpen(false);
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await supabase.from('rents').delete().eq('id', id);
    setDeleteId(null);
    await load();
  };

  const isOverdue = (item) => {
    if (item.status !== 'Active' || !item.due_date) return false;
    return new Date(item.due_date) < new Date();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-heading">Rent</h2>
          <p className="text-muted-foreground text-sm mt-0.5">จัดการการยืมอุปกรณ์ ({rents.length} รายการ)</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus size={16} /> เพิ่มรายการยืม
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="ค้นหาชื่ออุปกรณ์, ผู้ยืม, เลขที่..." className="pl-9 bg-card" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-card">
            <Filter size={14} className="mr-2 text-muted-foreground" />
            <SelectValue placeholder="สถานะ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <PackageOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p>ไม่พบข้อมูลการยืม</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">เลขที่</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">อุปกรณ์</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">ผู้ยืม</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">แผนก</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">กำหนดคืน</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">สถานะ</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(r => {
                  const sc = statusColors[r.status] || statusColors.Returned;
                  const overdue = isOverdue(r);
                  return (
                    <tr key={r.id} className={`hover:bg-muted/30 transition-colors ${overdue ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.rental_no || '—'}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{r.device_name}</td>
                      <td className="px-4 py-3 text-foreground">{r.borrower_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.borrower_department || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {overdue && <AlertTriangle size={13} className="text-red-500 shrink-0" />}
                          <span className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                            {r.due_date || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: sc.bg, color: sc.color }}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? 'แก้ไขรายการยืม' : 'เพิ่มรายการยืมใหม่'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            {[
              { key: 'rental_no', label: 'เลขที่ใบยืม' },
              { key: 'device_name', label: 'ชื่ออุปกรณ์ *' },
              { key: 'borrower_name', label: 'ชื่อผู้ยืม *' },
              { key: 'borrower_department', label: 'แผนก' },
              { key: 'purpose', label: 'วัตถุประสงค์' },
              { key: 'borrow_date', label: 'วันที่ยืม *', type: 'date' },
              { key: 'due_date', label: 'กำหนดคืน *', type: 'date' },
              { key: 'return_date', label: 'วันที่คืน', type: 'date' },
            ].map(({ key, label, type = 'text' }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs">{label}</Label>
                <Input type={type} value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-xs">สถานะ</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">หมายเหตุ</Label>
              <Input value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>ยืนยันการลบ</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">คุณต้องการลบรายการยืมนี้ใช่หรือไม่?</p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={() => handleDelete(deleteId)}>ลบ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
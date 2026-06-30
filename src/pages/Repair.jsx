import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Wrench, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const statusColors = {
  'Pending': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', text: 'รอดำเนินการ' },
  'Completed': { bg: 'rgba(16,185,129,0.12)', color: '#10b981', text: 'ซ่อมได้' },
  'Cancelled': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', text: 'เสีย' },
};

export default function Repair() {
  const [repairs, setRepairs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    device_id: '',
    device_name: '',
    reported_by: '',
    issue_description: '',
  });
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [repairsRes, devicesRes] = await Promise.all([
        supabase.from('repairs').select('*').order('created_at', { ascending: false }),
        supabase.from('devices').select('id, asset_tag, name, assigned_to, status') // 💡 ดึง status ของ device มาด้วย
      ]);

      setRepairs(repairsRes.data || []);
      setDevices(devicesRes.data || []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleDeviceChange = (deviceId) => {
    const selectedDevice = devices.find(d => d.id === deviceId);
    if (selectedDevice) {
      setForm(prev => ({
        ...prev,
        device_id: deviceId,
        device_name: selectedDevice.name
      }));
    }
  };

  // 1. ตอนกดสร้างใบแจ้งซ่อม -> บันทึกใบซ่อม + อัปเดตสถานะหน้า device เป็น "กำลังแจ้งซ่อม"
  const handleSubmitData = async () => {
    if (!form.device_id || !form.device_name || !form.issue_description.trim() || !form.reported_by.trim()) {
      setError('กรุณากรอกข้อมูลสำคัญให้ครบถ้วน');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // บันทึกใบซ่อมลงตาราง repairs
      const { error: insertError } = await supabase
        .from('repairs')
        .insert([
          {
            device_id: form.device_id,
            device_name: form.device_name,
            reported_by: form.reported_by.trim(),
            issue_description: form.issue_description.trim(),
            status: 'Pending',
            notes: ''
          }
        ]);

      if (insertError) throw insertError;

      // 🔄 อัปเดตสถานะของเครื่องในตาราง devices เป็น "กำลังแจ้งซ่อม"
      await supabase
        .from('devices')
        .update({ status: 'กำลังแจ้งซ่อม' }) 
        .eq('id', form.device_id);

      setForm({ device_id: '', device_name: '', reported_by: '', issue_description: '' });
      setIsModalOpen(false);
      loadData();

    } catch (err) {
      setError('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setSaving(false);
    }
  };
// ⚡ ฟังก์ชันปิดงานซ่อม: ซ่อมได้ (อัปเดตสถานะ) / เสีย (ลบแถวใบซ่อม + ส่งสถานะเสียไปหน้า device)
// ⚡ ฟังก์ชันปิดงานซ่อม: ซ่อมได้ (ส่งกลับสำรอง + ลบแถว) / เสีย (ส่งกลับเสีย + ลบแถว)
  const handleCloseRepairJob = async (repairId, deviceId, finalStatus) => {
    try {
      if (finalStatus === 'Completed') {
        // 🟢 กรณี ซ่อมได้: อัปเดตเครื่องเป็น "สำรอง"
        if (deviceId) {
          await supabase
            .from('devices')
            .update({ status: 'สำรอง' })
            .eq('id', deviceId);
        }
        
      } else if (finalStatus === 'Cancelled') {
        // 🔴 กรณี เสีย: อัปเดตเครื่องเป็น "เสีย"
        if (deviceId) {
          await supabase
            .from('devices')
            .update({ status: 'เสีย' })
            .eq('id', deviceId);
        }
      }

      // 🗑️ ลบแถวข้อมูลใบซ่อมนี้ออกจากตาราง repairs ทันที (ทำเหมือนกันทั้งคู่)
      await supabase
        .from('repairs')
        .delete()
        .eq('id', repairId);

      // โหลดข้อมูลใหม่เพื่อล้างแถวออกจากหน้าจอ
      loadData();
    } catch (err) {
      console.error("เกิดข้อผิดพลาดในการจัดการงานซ่อม:", err);
    }
  };
  const filtered = repairs.filter(r => {
    const matchedDevice = devices.find(d => d.id === r.device_id);
    const searchStr = search.toLowerCase();
    return (
      r.device_name?.toLowerCase().includes(searchStr) ||
      matchedDevice?.asset_tag?.toLowerCase().includes(searchStr) ||
      r.reported_by?.toLowerCase().includes(searchStr)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Wrench className="text-primary" /> รายการซ่อมอุปกรณ์
        </h2>
        <Button onClick={() => setIsModalOpen(true)} className="gap-1.5">
          <Plus size={16} /> แจ้งซ่อม
        </Button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="ค้นหารหัสเครื่อง, ชื่ออุปกรณ์ หรือคนแจ้งซ่อม..."
          className="pl-10"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">รหัสอุปกรณ์</th>
              <th className="px-4 py-3 text-left">ชื่ออุปกรณ์</th>
              <th className="px-4 py-3 text-left">ผู้ถือครอง</th>
              <th className="px-4 py-3 text-left">บัญชีผู้ดำเนินการ</th>
              <th className="px-4 py-3 text-left">อาการเสีย / ปัญหา</th>
              <th className="px-4 py-3 text-left">สถานะใบซ่อม</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-4 text-muted-foreground">กำลังโหลดข้อมูล...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-4 text-muted-foreground">ไม่พบข้อมูลการแจ้งซ่อม</td>
              </tr>
            ) : (
              filtered.map(r => {
                const d = devices.find(dev => dev.id === r.device_id);
                const sc = statusColors[r.status] || { bg: 'rgba(107,114,128,0.12)', color: '#6b7280', text: r.status };
                
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{d?.asset_tag || '-'}</td>
                    <td className="px-4 py-3 font-medium">{r.device_name || d?.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d?.assigned_to || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.reported_by || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{r.issue_description}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-[11px] font-semibold" style={{ background: sc.bg, color: sc.color }}>
                        {sc.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        
                        {/* แสดงปุ่มจัดการเฉพาะตอนที่ใบซ่อมยังคาอยู่ที่รอดำเนินการ (Pending) */}
                        {r.status === 'Pending' && (
                          <>
                            {/* ปุ่ม ซ่อมได้ */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 gap-1"
                              onClick={() => handleCloseRepairJob(r.id, r.device_id, 'Completed')}
                            >
                              <CheckCircle2 size={14} />
                              <span className="text-xs">ซ่อมได้</span>
                            </Button>

                            {/* ปุ่ม เสีย */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 gap-1"
                              onClick={() => handleCloseRepairJob(r.id, r.device_id, 'Cancelled')}
                            >
                              <XCircle size={14} />
                              <span className="text-xs">เสีย</span>
                            </Button>
                          </>
                        )}

                        {r.status !== 'Pending' && (
                          <span className="text-xs text-muted-foreground px-3">ปิดงานแล้ว</span>
                        )}

                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL ฟอร์มสร้างใบแจ้งซ่อม */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench size={18} className="text-primary" />
              <span>สร้างใบแจ้งซ่อมอุปกรณ์</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-xs font-medium">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground/80">เลือกอุปกรณ์ที่ต้องการซ่อม <span className="text-red-500">*</span></Label>
              <Select value={form.device_id} onValueChange={handleDeviceChange}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="เลือกตามรหัสทรัพย์สิน หรือ ชื่อเครื่อง" />
                </SelectTrigger>
                <SelectContent>
                  {/* 💡 แสดงเฉพาะอุปกรณ์ที่ยังมีสถานะเปิดใช้งานอยู่ หรือปรับตัวกรองตามหน้าเครื่องของคุณได้เลยครับ */}
                  {devices.map((dev) => (
                    <SelectItem key={dev.id} value={dev.id} className="text-xs">
                      [{dev.asset_tag || 'ไม่มีรหัส'}] {dev.name} {dev.status ? `(${dev.status})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.device_id && (
              <div className="p-2.5 bg-muted/40 rounded-lg border text-[11px] text-muted-foreground space-y-0.5">
                <p><span className="font-semibold text-foreground/70">ชื่ออุปกรณ์ในระบบ:</span> {form.device_name}</p>
                <p><span className="font-semibold text-foreground/70">ผู้รับผิดชอบเครื่องปัจจุบัน:</span> {devices.find(d => d.id === form.device_id)?.assigned_to || '-'}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground/80">บัญชีผู้ดำเนินการ / ผู้แจ้งเรื่อง <span className="text-red-500">*</span></Label>
              <Input
                value={form.reported_by}
                onChange={e => setForm(prev => ({ ...prev, reported_by: e.target.value }))}
                placeholder="กรอกชื่อผู้บันทึกรายการ"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground/80">อาการเสีย / ปัญหาที่พบ <span className="text-red-500">*</span></Label>
              <Textarea
                value={form.issue_description}
                onChange={e => setForm(prev => ({ ...prev, issue_description: e.target.value }))}
                placeholder="ระบุรายละเอียด เช่น เปิดไม่ติด, หน้าจอแตก..."
                className="text-xs min-h-[90px] resize-none"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="text-xs">
              ยกเลิก
            </Button>
            <Button type="button" onClick={handleSubmitData} disabled={saving} className="text-xs">
              {saving ? 'กำลังบันทึก...' : 'ยืนยันการแจ้งซ่อม'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
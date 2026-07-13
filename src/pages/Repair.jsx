import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Wrench, AlertCircle, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { logDeviceHistory } from '@/lib/deviceHistory';

const statusColors = {
  'รออนุมัติแจ้งซ่อม': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', text: 'รออนุมัติแจ้งซ่อม' },
  'กำลังซ่อม': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', text: 'กำลังซ่อม' },
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

  // ✅ state สำหรับ dropdown ค้นหาอุปกรณ์
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceDropdownOpen, setDeviceDropdownOpen] = useState(false);
  const deviceDropdownRef = useRef(null);

  const [form, setForm] = useState({
    device_id: '',
    device_name: '',
    asset_tag: '',
    reported_by: '',
    issue_description: '',
  });
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [repairsRes, devicesRes] = await Promise.all([
        supabase.from('repairs').select('*').order('created_at', { ascending: false }),
        supabase.from('devices').select('id, asset_tag, name, assigned_to, status')
      ]);

      setRepairs(repairsRes.data || []);
      setDevices(devicesRes.data || []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      setForm({
        device_id: '',
        device_name: '',
        reported_by: '',
        issue_description: '',
      });
      setDeviceSearch('');
      setDeviceDropdownOpen(false);
      setError('');
    }
    setDeviceDropdownOpen(false);
  }, [isModalOpen]);

  // ✅ ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (deviceDropdownRef.current && !deviceDropdownRef.current.contains(e.target)) {
        setDeviceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDeviceChange = (deviceId) => {
    const selectedDevice = devices.find(d => d.id === deviceId);
    if (selectedDevice) {
      setForm(prev => ({
        ...prev,
        device_id: deviceId,
        device_name: selectedDevice.name,
        asset_tag: selectedDevice.asset_tag
      }));
      setDeviceSearch(`[${selectedDevice.asset_tag || 'ไม่มีรหัส'}] ${selectedDevice.name}`);
      setDeviceDropdownOpen(false);
    }
  };

  // ✅ กรองรายการอุปกรณ์ตามคำค้นหา (เฉพาะเครื่องสถานะ "ใช้งาน" เหมือนเดิม)
  const availableDevices = devices.filter(dev => dev.status === 'ใช้งาน');
  const filteredDeviceOptions = availableDevices.filter(dev => {
    const q = deviceSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (dev.name || '').toLowerCase().includes(q) ||
      (dev.asset_tag || '').toLowerCase().includes(q)
    );
  });

  const handleSubmitData = async () => {
    if (!form.device_id || !form.issue_description.trim() || !form.reported_by.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const selectedDevice = devices.find(d => d.id === form.device_id);
    if (!selectedDevice) {
      setError('ไม่พบข้อมูลอุปกรณ์ในระบบ');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const { data: repairData, error: insertRepairError } = await supabase
        .from('repairs')
        .insert([{
          device_id: form.device_id,
          device_name: selectedDevice.name,
          reported_by: form.reported_by.trim(),
          issue_description: form.issue_description.trim(),
          status: 'รออนุมัติแจ้งซ่อม'
        }])
        .select()
        .single();
      if (insertRepairError) throw insertRepairError;

      const { error: insertApprovalError } = await supabase
        .from('approvals')
        .insert([{
          device_id: form.device_id,
          device_name: form.device_name,
          description: form.issue_description.trim(),
          request_type: 'repair',
          repair_id: repairData.id,
          requested_by: form.reported_by.trim(),
          status: 'Pending',
          user_id: user?.id || null
        }]);

      if (insertApprovalError) throw insertApprovalError;

      const { error: statusError } = await supabase
        .from('devices')
        .update({ status: 'กำลังแจ้งซ่อม' })
        .eq('id', form.device_id);
      if (statusError) throw statusError;
      await logDeviceHistory({
        deviceId: form.device_id,
        assetTag: selectedDevice.asset_tag,
        deviceName: selectedDevice.name,
        action: 'repair_request',
        description: form.issue_description.trim(),
        performedBy: form.reported_by.trim(),
      });
      setIsModalOpen(false);
      loadData();

    } catch (err) {
      console.error("รายละเอียด Error:", err);
      setError('บันทึกข้อมูลไม่สำเร็จ: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseRepairJob = async (repairId, deviceId, finalStatus) => {
    try {
      if (finalStatus === 'Completed') {
        if (deviceId) {
          await supabase.from('devices').update({ status: 'สำรอง' }).eq('id', deviceId);
        }
      } else if (finalStatus === 'Cancelled') {
        if (deviceId) {
          await supabase.from('devices').update({ status: 'เสีย' }).eq('id', deviceId);
        }
      }

      await supabase.from('repairs').delete().eq('id', repairId);
      await logDeviceHistory({
        deviceId: deviceId,
        action: finalStatus === 'Completed' ? 'repair_completed' : 'repair_cancelled',
        description: finalStatus === 'Completed' ? 'ซ่อมเสร็จ กลับมาใช้งานได้' : 'ซ่อมไม่ได้ อุปกรณ์เสีย',
      });
      loadData();
    } catch (err) {
      console.error("เกิดข้อผิดพลาดในการจัดการงานซ่อม:", err);
    }
  };

  const filtered = repairs.filter(r => {
    const searchStr = search.toLowerCase().trim();
    const currentStatus = (r.status || '').trim();
    const isRelevantStatus = currentStatus === 'รออนุมัติแจ้งซ่อม' || currentStatus === 'กำลังซ่อม';

    if (!isRelevantStatus) return false;
    if (!searchStr) return true;

    const matchedDevice = devices.find(d => d.id === r.device_id);
    const deviceName = (r.device_name || matchedDevice?.name || '').toLowerCase();
    const assetTag = (matchedDevice?.asset_tag || '').toLowerCase();
    const reportedBy = (r.reported_by || '').toLowerCase();
    const issueDesc = (r.issue_description || '').toLowerCase();
    const statusText = currentStatus.toLowerCase();

    return (
      deviceName.includes(searchStr) ||
      assetTag.includes(searchStr) ||
      reportedBy.includes(searchStr) ||
      issueDesc.includes(searchStr) ||
      statusText.includes(searchStr)
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
                        {r.status === 'กำลังซ่อม' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 gap-1"
                              onClick={() => handleCloseRepairJob(r.id, r.device_id, 'Completed')}
                            >
                              <CheckCircle2 size={14} />
                              <span className="text-xs">ซ่อมได้</span>
                            </Button>

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

                        {r.status === 'รออนุมัติแจ้งซ่อม' && (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md font-medium">⏳ รออนุมัติจากหัวหน้า</span>
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

            {/* ✅ Dropdown ค้นหาอุปกรณ์ (แทนที่ Select เดิม) */}
            <div className="space-y-1.5 relative" ref={deviceDropdownRef}>
              <Label className="text-xs font-bold text-foreground/80">
                เลือกอุปกรณ์ที่ต้องการซ่อม <span className="text-red-500">*</span>
              </Label>

              <div className="relative">
                <Input
                  value={deviceSearch}
                  onChange={(e) => {
                    setDeviceSearch(e.target.value);
                    setDeviceDropdownOpen(true);   // ✅ เปิดตอนพิมพ์
                    if (form.device_id) {
                      setForm(prev => ({ ...prev, device_id: '', device_name: '', asset_tag: '' }));
                    }
                  }}
                  onClick={() => setDeviceDropdownOpen(true)}   // ✅ เปิดตอนกดคลิกช่องนี้ตรงๆ
                  placeholder="พิมพ์ค้นหารหัสทรัพย์สิน หรือ ชื่อเครื่อง..."
                  className="h-9 text-xs pr-8"
                />
                <ChevronDown
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
              </div>

              {deviceDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-56 overflow-y-auto">
                  {filteredDeviceOptions.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                      ไม่พบอุปกรณ์ที่ตรงกับคำค้นหา
                    </div>
                  ) : (
                    filteredDeviceOptions.map((dev) => (
                      <div
                        key={dev.id}
                        onClick={() => handleDeviceChange(dev.id)}
                        className={`px-3 py-2 text-xs cursor-pointer hover:bg-muted/60 transition-colors ${form.device_id === dev.id ? 'bg-primary/10 font-semibold' : ''
                          }`}
                      >
                        [{dev.asset_tag || 'ไม่มีรหัส'}] {dev.name}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

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
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="text-xs hover:bg-[#111827] hover:text-white ">
              ยกเลิก
            </Button>
            <Button type="button" onClick={handleSubmitData} disabled={saving} variant="outline" className="text-xs hover:bg-[#111827] hover:text-white" >
              {saving ? 'กำลังส่งคำขอ...' : 'ขออนุมัติแจ้งซ่อม'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
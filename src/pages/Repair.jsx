import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Wrench, AlertCircle, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { logDeviceHistory } from '@/lib/deviceHistory';
import PrintRepairFormDialog from "@/components/device/PrintRepairFormDialog";

const statusColors = {
  'รออนุมัติแจ้งซ่อม': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', text: 'รออนุมัติแจ้งซ่อม' },
  'กำลังซ่อม': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', text: 'กำลังซ่อม' },
  'Completed': { bg: 'rgba(16,185,129,0.12)', color: '#10b981', text: 'ซ่อมได้' },
  'Cancelled': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', text: 'เสีย' },
};

// ✅ ฟอร์มว่างเปล่าเริ่มต้น แยกออกมาเป็นค่าคงที่ ใช้ได้ทั้งตอน init state และตอนรีเซ็ตฟอร์ม
const emptyRepairForm = {
  device_id: '',
  device_name: '',
  asset_tag: '',
  reported_by: '',
  issue_description: '',
};

/**
 * สร้างเลขที่เอกสารเป็นเลขรันนิ่งล้วน (5 หลัก) เช่น "00001", "00002"
 * ใช้แพทเทิร์นเดียวกับ generateRequestNo ในหน้าเคลื่อนย้าย (DeviceEditFormDialog.jsx)
 */
function generateRequestNo(sequence) {
  return String(sequence).padStart(5, '0');
}

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

  const [form, setForm] = useState(emptyRepairForm);
  const [error, setError] = useState('');

  // ✅ state สำหรับ dialog ฟอร์มปริ้นใบแจ้งซ่อม (แสดงหลังส่งคำขอสำเร็จ)
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printData, setPrintData] = useState(null);

  // โหลดข้อมูลใบซ่อม + อุปกรณ์ทั้งหมดพร้อมกัน
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

  // รีเซ็ตฟอร์ม + ปิด dropdown ทุกครั้งที่เปิด modal ใหม่
  useEffect(() => {
    if (isModalOpen) {
      setForm(emptyRepairForm);
      setDeviceSearch('');
      setError('');
    }
    setDeviceDropdownOpen(false);
  }, [isModalOpen]);

  // ปิด dropdown เมื่อคลิกข้างนอกกล่องค้นหาอุปกรณ์
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

  // กรองรายการอุปกรณ์ในดรอปดาวน์ตามคำค้นหา (เฉพาะเครื่องสถานะ "ใช้งาน" เท่านั้นที่แจ้งซ่อมได้)
  const availableDevices = devices.filter(dev => dev.status === 'ใช้งาน');
  const filteredDeviceOptions = availableDevices.filter(dev => {
    const q = deviceSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (dev.name || '').toLowerCase().includes(q) ||
      (dev.asset_tag || '').toLowerCase().includes(q)
    );
  });

  // ส่งคำขอแจ้งซ่อม: สร้าง repair + approval พร้อมกัน แล้วอัปเดตสถานะอุปกรณ์
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

      // นับจำนวนคำขอแจ้งซ่อมทั้งหมดที่เคยเกิดขึ้น (รวมคำขอนี้ที่เพิ่ง insert ไปด้วย) ใช้เป็นเลขที่เอกสารแบบรันนิ่ง
      const { count: totalCount, error: countError } = await supabase
        .from('approvals')
        .select('id', { count: 'exact', head: true })
        .eq('request_type', 'repair');
      if (countError) throw countError;

      const sequence = totalCount || 1;
      const now = new Date();

      // เตรียมข้อมูลสำหรับฟอร์มปริ้น แล้วปิด modal กรอกข้อมูล เปิด dialog ปริ้นแทน
      setPrintData({
        requestNo: generateRequestNo(sequence),
        requestDate: now.toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' }),
        requestTime: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        deviceName: selectedDevice.name,
        assetTag: selectedDevice.asset_tag,
        reportedBy: form.reported_by.trim(),
        issueDescription: form.issue_description.trim(),
      });

      setIsModalOpen(false);
      setShowPrintPreview(true);
      loadData();
    } catch (err) {
      console.error("รายละเอียด Error:", err);
      setError('บันทึกข้อมูลไม่สำเร็จ: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ปิดงานซ่อม: "ซ่อมได้" คืนอุปกรณ์เป็นสำรอง (เคลียร์แผนก/ผู้ถือ) / "เสีย" เปลี่ยนสถานะเป็นเสียถาวร
  const handleCloseRepairJob = async (repairId, deviceId, finalStatus) => {
    try {
      if (finalStatus === 'Completed') {
        if (deviceId) {
          await supabase
            .from('devices')
            .update({
              status: 'สำรอง',
              department: null,
              assigned_to: null
            })
            .eq('id', deviceId);
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
        description: finalStatus === 'Completed'
          ? 'ซ่อมเสร็จ กลับมาใช้งานได้ (สถานะ: สำรอง, ไม่มีแผนก/ผู้รับมอบหมาย)'
          : 'ซ่อมไม่ได้ อุปกรณ์เสีย',
      });

      loadData();
    } catch (err) {
      console.error("เกิดข้อผิดพลาดในการจัดการงานซ่อม:", err);
    }
  };

  // แสดงเฉพาะใบซ่อมที่ยัง active อยู่ (รออนุมัติ / กำลังซ่อม) + ค้นหาได้จากหลาย field
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

  // ✅ ปุ่ม action ของแต่ละใบซ่อม แยกเป็น component ย่อย ใช้ร่วมกันทั้ง mobile card และ desktop table
  const RepairActions = ({ r }) => {
    if (r.status === 'กำลังซ่อม') {
      return (
        <div className="flex gap-1.5">
          <Button
            variant="ghost" size="sm"
            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 gap-1 flex-1 sm:flex-none"
            onClick={() => handleCloseRepairJob(r.id, r.device_id, 'Completed')}
          >
            <CheckCircle2 size={14} />
            <span className="text-xs">ซ่อมได้</span>
          </Button>
          <Button
            variant="ghost" size="sm"
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 gap-1 flex-1 sm:flex-none"
            onClick={() => handleCloseRepairJob(r.id, r.device_id, 'Cancelled')}
          >
            <XCircle size={14} />
            <span className="text-xs">เสีย</span>
          </Button>
        </div>
      );
    }
    if (r.status === 'รออนุมัติแจ้งซ่อม') {
      return (
        <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md font-medium whitespace-nowrap">
          ⏳ รออนุมัติจากหัวหน้า
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-5">
      {/* ✅ หัวข้อ + ปุ่มแจ้งซ่อม: มือถือเรียงแนวตั้งปุ่มเต็มความกว้าง / จอใหญ่เรียงแนวนอนแบบเดิม */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
          <Wrench className="text-primary" size={22} />
          รายการซ่อม
        </h2>
        <Button onClick={() => setIsModalOpen(true)} className="gap-1.5 w-full sm:w-auto">
          <Plus size={16} /> แจ้งซ่อม
        </Button>
      </div>

      <div className="relative flex-1 min-w-0 sm:min-w-48">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="ค้นหารหัสเครื่อง, ชื่ออุปกรณ์ หรือคนแจ้งซ่อม..." className="pl-9 h-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">

        {/* ✅ MOBILE VIEW (< md): การ์ดแถวยาว แทนตารางที่มี 7 คอลัมน์ (แน่นเกินจอมือถือ) */}
        <div className="md:hidden divide-y divide-border">
          {loading ? (
            <p className="text-center py-6 text-muted-foreground text-sm">กำลังโหลดข้อมูล...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">ไม่พบข้อมูลการแจ้งซ่อม</p>
          ) : (
            filtered.map(r => {
              const d = devices.find(dev => dev.id === r.device_id);
              const sc = statusColors[r.status] || { bg: 'rgba(107,114,128,0.12)', color: '#6b7280', text: r.status };
              return (
                <div key={r.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{r.device_name || d?.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{d?.asset_tag || '-'}</p>
                    </div>
                    <span
                      className="px-2 py-1 rounded-full text-[11px] font-semibold shrink-0"
                      style={{ background: sc.bg, color: sc.color }}
                    >
                      {sc.text}
                    </span>
                  </div>

                  <div className="text-xs space-y-1">
                    <p><span className="text-muted-foreground">ผู้ถือครอง:</span> {d?.assigned_to || '-'}</p>
                    <p><span className="text-muted-foreground">ผู้แจ้ง:</span> {r.reported_by || '-'}</p>
                    <p className="text-muted-foreground">{r.issue_description}</p>
                  </div>

                  <div className="pt-1">
                    <RepairActions r={r} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ✅ DESKTOP / TABLET VIEW (md ขึ้นไป): ตารางเดิม */}
        <table className="hidden md:table w-full text-sm">
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
                      <div className="flex justify-end">
                        <RepairActions r={r} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL ฟอร์มสร้างใบแจ้งซ่อม — Dialog component รองรับ responsive อยู่แล้ว (w-[92%] บนมือถือ) */}
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

            {/* Dropdown ค้นหาอุปกรณ์ */}
            <div className="space-y-1.5 relative" ref={deviceDropdownRef}>
              <Label className="text-xs font-bold text-foreground/80">
                เลือกอุปกรณ์ที่ต้องการซ่อม <span className="text-red-500">*</span>
              </Label>

              <div className="relative">
                <Input
                  value={deviceSearch}
                  onChange={(e) => {
                    setDeviceSearch(e.target.value);
                    setDeviceDropdownOpen(true);
                    if (form.device_id) {
                      setForm(prev => ({ ...prev, device_id: '', device_name: '', asset_tag: '' }));
                    }
                  }}
                  onClick={() => setDeviceDropdownOpen(true)}
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
                        className={`px-3 py-2 text-xs cursor-pointer hover:bg-muted/60 transition-colors ${form.device_id === dev.id ? 'bg-primary/10 font-semibold' : ''}`}
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
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="text-xs hover:bg-[#111827] hover:text-white">
              ยกเลิก
            </Button>
            <Button type="button" onClick={handleSubmitData} disabled={saving} variant="outline" className="text-xs hover:bg-[#111827] hover:text-white">
              {saving ? 'กำลังส่งคำขอ...' : 'ขออนุมัติแจ้งซ่อม'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ฟอร์มปริ้นใบแจ้งซ่อม — เปิดขึ้นหลังส่งคำขอสำเร็จ พร้อม auto สร้าง/เปิด PDF */}
      <PrintRepairFormDialog
        open={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        data={printData}
      />
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ClipboardCheck, Check, X, Filter, Search, RefreshCw, Laptop, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// สีกำกับประเภทคำขอ (Request Type)
const typeDetails = {
  Repair: { label: 'แจ้งซ่อม', bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', icon: RefreshCw },
  Move: { label: 'เคลื่อนย้าย', bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6', icon: Laptop },
  Edit: { label: 'แก้ไขข้อมูล', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', icon: Pencil },
  Delete: { label: 'ลบอุปกรณ์', bg: 'rgba(239,68,68,0.12)', color: '#ef4444', icon: Trash2 },
};

export default function Approve() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState(null);

  // 🔍 ฟังก์ชันแกะประวัติและเรนเดอร์ฟิลด์เปลี่ยนค่าแบบ Inline CSS กันปัญหาสีไม่ขึ้น
  const renderChangedFields = (noteString) => {
    if (!noteString) return null;

    let payload = {};
    try {
      // 🔄 ดึงข้อความในวงเล็บปีกกา { ... } ออกมาจาก String หมายเหตุ
      const jsonMatch = noteString.match(/\{([\s\S]*)\}/);
      if (!jsonMatch) return null;
      payload = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("Error parsing note JSON in renderChangedFields:", e);
      return null;
    }

    const labels = {
      asset_tag: "Asset Tag",
      name: "ชื่ออุปกรณ์",
      category: "ประเภท",
      department: "แผนก",
      assigned_to: "ผู้รับผิดชอบ",
      status: "สถานะ",
      purchase_date: "วันที่ซื้อ",
      warranty_expire: "วันหมดประกัน",
      brand: "ยี่ห้อ",
      model: "รุ่น",
      serial_number: "Serial Number"
    };

    const changes = [];

    // วนลูปแปลงโครงสร้างให้อยู่ในรูปแบบ { old, new } และคัดเฉพาะฟิลด์ที่มีการเปลี่ยนแปลงจริง
    Object.keys(labels).forEach((key) => {
      const newValue = payload[key] !== undefined && payload[key] !== null ? String(payload[key]).trim() : '';
      const oldValue = payload[`original_${key}`] !== undefined && payload[`original_${key}`] !== null ? String(payload[`original_${key}`]).trim() : '';

      if (newValue !== oldValue && (newValue || oldValue)) {
        changes.push({
          key,
          label: labels[key],
          old: oldValue || "—",
          new: newValue || "—"
        });
      }
    });

    if (changes.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', marginTop: '6px' }}>
        {changes.map((changeItem) => (
          <div
            key={changeItem.key}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '6px 10px', 
              backgroundColor: '#f8fafc', 
              borderRadius: '6px', 
              border: '1px solid #e2e8f0',
              width: '100%'
            }}
          >
            {/* ป้ายชื่อแอตทริบิวต์ */}
            <div style={{ width: '100px', flexShrink: 0 }}>
              <span style={{ 
                backgroundColor: '#e2e8f0', 
                padding: '2px 6px', 
                borderRadius: '4px', 
                color: '#334155', 
                fontWeight: '600', 
                fontSize: '11px',
                display: 'block',
                textAlign: 'center'
              }}>
                {changeItem.label}
              </span>
            </div>

            {/* ส่วนแสดงค่าเก่า -> ค่าใหม่ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ textDecoration: 'line-through', color: '#ef4444', backgroundColor: '#fef2f2', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
                {changeItem.old}
              </span>
              
              <span style={{ color: '#3b82f6', fontFamily: 'monospace', fontSize: '11px' }}>➡️</span>
              
              <span style={{ color: '#16a34a', backgroundColor: '#f0fdf4', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                {changeItem.new}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ดึงข้อมูลจาก Supabase
  const loadApprovals = async () => {
    try {
      setLoading(true);
      const { data: approvalsData, error: appErr } = await supabase
        .from('approvals')
        .select('*')
        .or('status.eq.Pending,status.eq.pending')
        .order('created_at', { ascending: false });

      if (appErr) throw appErr;

      const { data: devicesData } = await supabase
        .from('devices')
        .select('id, asset_tag, name, assigned_to');

      const combinedData = approvalsData.map(app => {
        const relatedDevice = devicesData?.find(dev => dev.id === app.device_id);
        return {
          ...app,
          devices: relatedDevice || null
        };
      });

      setApprovals(combinedData);
    } catch (err) {
      console.error("Error loading:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // ค้นหาฝั่ง Client
  const filtered = approvals.filter(item => {
    const matchSearch = !search ||
      item.device_name?.toLowerCase().includes(search.toLowerCase()) ||
      item.devices?.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.requested_by?.toLowerCase().includes(search.toLowerCase()) ||
      item.ticket_no?.toLowerCase().includes(search.toLowerCase());

    const matchType = filterType === 'all' || item.request_type?.toLowerCase() === filterType.toLowerCase();
    return matchSearch && matchType;
  });

  // ฟังก์ชันกดปุ่มอนุมัติ
  const handleApproveDirect = async (item) => {
    setSubmitting(true);
    try {
      if (item.request_type === 'Delete') {
        const { error: deviceDeleteErr } = await supabase
          .from('devices')
          .delete()
          .eq('id', item.device_id);

        if (deviceDeleteErr) throw deviceDeleteErr;

        const { error: approvalDeleteErr } = await supabase
          .from('approvals')
          .delete()
          .eq('id', item.id);

        if (approvalDeleteErr) throw approvalDeleteErr;

        await loadApprovals();
        alert("อนุมัติลบอุปกรณ์ออกจากระบบเสร็จสิ้น");
        return;
      }

      let updatedData = {};
      if (item.note) {
        const jsonMatch = item.note.match(/\{([\s\S]*)\}/);
        if (jsonMatch) {
          updatedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("ไม่พบโครงสร้างข้อมูลวัตถุ JSON ในหมายเหตุ");
        }
      } else {
        throw new Error("ไม่พบข้อมูลชุดใหม่ในคำขออนุมัติ");
      }

      const deviceUpdates = {
        asset_tag: updatedData.asset_tag,
        name: updatedData.name,
        category: updatedData.category,
        department: updatedData.department,
        assigned_to: updatedData.assigned_to,
        purchase_date: updatedData.purchase_date,
        warranty_expire: updatedData.warranty_expire,
        status: 'ใช้งาน'
      };

      const { error: deviceError } = await supabase
        .from('devices')
        .update(deviceUpdates)
        .eq('id', item.device_id);

      if (deviceError) throw deviceError;

      const { error: deleteError } = await supabase
        .from('approvals')
        .delete()
        .eq('id', item.id);

      if (deleteError) throw deleteError;

      await loadApprovals();
      alert("อนุมัติการแก้ไขข้อมูลและปรับสถานะเป็น 'ใช้งาน' เรียบร้อยแล้ว");
    } catch (err) {
      console.error("Error during approval:", err);
      alert("เกิดข้อผิดพลาดในการอนุมัติคำขอ: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectDirect = async (item) => {
    setSubmitting(true);
    try {
      const originalStatus = item.payload?.status || 'ใช้งาน';

      await supabase
        .from('devices')
        .update({ status: originalStatus })
        .eq('id', item.device_id);

      await supabase
        .from('approvals')
        .delete()
        .eq('id', item.id);

      await loadApprovals();
      alert(`ปฏิเสธรายการเรียบร้อยแล้ว`);
    } catch (err) {
      console.error("Error during rejection:", err);
      alert("เกิดข้อผิดพลาดในการปฏิเสธคำขอ");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
    loadApprovals();
  }, []);

  return (
    <div className="space-y-5">
      {/* ส่วนหัวหน้าจอ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
            <ClipboardCheck className="text-primary" size={24} />
            <span>งานรออนุมัติ</span>
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            ศูนย์รวมคำขอ แจ้งซ่อม, ลบ, แก้ไข และเคลื่อนย้ายอุปกรณ์ที่รอการตรวจสอบ ({filtered.length} รายการ)
          </p>
        </div>
      </div>

      {/* แถบค้นหา */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="ค้นหาชื่ออุปกรณ์, ผู้ขอ..." className="pl-9 h-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44 bg-card">
            <Filter size={14} className="mr-2 text-muted-foreground" />
            <SelectValue placeholder="ประเภทคำขอ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกประเภทคำขอ</SelectItem>
            <SelectItem value="Repair">🛠️ แจ้งซ่อมอุปกรณ์</SelectItem>
            <SelectItem value="Move">📦 เคลื่อนย้ายอุปกรณ์</SelectItem>
            <SelectItem value="Edit">✏️ แก้ไขข้อมูล</SelectItem>
            <SelectItem value="Delete">🗑️ ลบอุปกรณ์จากระบบ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ตารางแสดงรายการ */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-card border border-dashed rounded-xl text-muted-foreground">
          <ClipboardCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">ไม่มีรายการที่รอการอนุมัติในขณะนี้</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">รหัสอุปกรณ์</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">ชื่ออุปกรณ์</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">ผู้ถือครอง</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">บัญชีผู้ดำเนินการ</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">รายละเอียดประวัติการเปลี่ยนค่า</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{item.devices?.asset_tag || '—'}</td>
                      <td className="px-4 py-3 text-foreground">{item.devices?.name || item.device_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.devices?.assigned_to || '—'}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{user?.email || 'System'}</td>
                      
                      {/* คอลัมน์แสดงรายละเอียดประวัติการแก้ไข */}
                      <td className="px-4 py-3 max-w-xl">
                        <div className="flex flex-col gap-1 text-xs">
                          {item.request_type === 'Edit' ? (
                            <div className="space-y-2 w-full">
                              {/* รายละเอียดงานหลัก */}
                              <div className="leading-relaxed">
                                <span className="text-muted-foreground font-medium">รายละเอียดงาน: </span>
                                <span className="text-foreground font-semibold break-words">
                                  {item.note?.split("{")[0]
                                    ?.replace("ขอแก้ไขข้อมูลอุปกรณ์:", "")
                                    ?.replace("รายละเอียดงาน:", "")
                                    ?.replace("| ข้อมูลใหม่:", "")
                                    ?.trim() || "เปลี่ยนสถานะอุปกรณ์"}
                                </span>
                              </div>

                              {/* บล็อกกรอบเส้นประมินิมอลตามที่คุณกำหนด */}
                              <div className="p-3 rounded-xl border border-dashed border-muted-foreground/30 bg-card" style={{ padding: '12px', borderRadius: '12px', border: '1px dashed #cbd5e1', backgroundColor: '#fafafa' }}>
                                <p className="text-xs font-bold mb-2 flex items-center gap-1 text-slate-500">
                                  <span>🔍 ข้อมูลที่เปลี่ยนแปลง:</span>
                                </p>
                                {renderChangedFields(item.note)}
                              </div>
                            </div>
                          ) : (
                            // คำขอประเภทอื่น ๆ (ซ่อม, ย้าย, ลบ)
                            <div className="leading-relaxed">
                              <span className="text-muted-foreground font-medium">รายละเอียดงาน: </span>
                              <span className={item.request_type === 'Delete' ? "text-red-600 font-semibold break-words" : "text-foreground font-semibold break-words"}>
                                {item.request_type === 'Repair' && `[แจ้งซ่อม] `}
                                {item.request_type === 'Move' && `[เคลื่อนย้าย] `}
                                {item.request_type === 'Delete' && `[ขออนุมัติลบ] `}
                                {item.description || item.note || '—'}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* ปุ่มกดจัดการด้านหลัง */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleApproveDirect(item)}
                            disabled={submitting}
                          >
                            {submitting ? 'กำลังบันทึก...' : <><Check size={12} className="mr-1" /> อนุมัติ</>}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleRejectDirect(item)}
                            disabled={submitting}
                          >
                            {submitting ? 'กำลังปฏิเสธ...' : <><X size={12} className="mr-1" /> ปฏิเสธ</>}
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
    </div>
  );
}
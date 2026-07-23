import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { History, Search, Download, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Monitor } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import * as XLSX from "xlsx";

const actionLabels = {
  create: { label: 'เพิ่มอุปกรณ์', color: '#10b981' },
  edit: { label: 'แก้ไขข้อมูล', color: '#3b82f6' },
  edit_approved: { label: 'อนุมัติแก้ไข', color: '#3b82f6' },
  edit_rejected: { label: 'ปฏิเสธการแก้ไข', color: '#6b7280' },
  delete_request: { label: 'ขออนุมัติลบ', color: '#f59e0b' },
  delete_approved: { label: 'อนุมัติลบ', color: '#ef4444' },
  delete_rejected: { label: 'ปฏิเสธการลบ', color: '#6b7280' },
  repair_request: { label: 'แจ้งซ่อม', color: '#f59e0b' },
  repair_approved: { label: 'อนุมัติซ่อม', color: '#3b82f6' },
  repair_rejected: { label: 'ปฏิเสธแจ้งซ่อม', color: '#6b7280' },
  repair_completed: { label: 'ซ่อมเสร็จ (ใช้งานได้)', color: '#10b981' },
  repair_cancelled: { label: 'ซ่อมไม่ได้ (เสีย)', color: '#ef4444' },
  move_request: { label: 'ขอเคลื่อนย้าย', color: '#f59e0b' },
  move_approved: { label: 'อนุมัติเคลื่อนย้าย', color: '#3b82f6' },
  move_rejected: { label: 'ปฏิเสธเคลื่อนย้าย', color: '#6b7280' },
};

const ITEMS_PER_PAGE = 10; // ✅ 10 รายการต่อหน้า ตามที่ขอ

export default function HistoryPage() {
  const [devices, setDevices] = useState([]);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1); // ✅ state หน้าปัจจุบัน

  const loadData = async () => {
    setLoading(true);
    const [{ data: devicesData }, { data: historyData }] = await Promise.all([
      supabase.from('devices').select('*').order('created_at', { ascending: false }),
      supabase.from('device_history').select('*').order('created_at', { ascending: false }),
    ]);
    setDevices(devicesData || []);
    setHistoryLogs(historyData || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // ✅ sort ซ้ำตาม created_at desc เสมอ (ไม่พึ่งพาลำดับจากการ query อย่างเดียว)
  // กันกรณี timestamp ชนกันหรือมี log ถูกเพิ่มเข้ามาไม่เรียงลำดับ ให้ log ล่าสุดอยู่บนสุดเสมอ
  const getDeviceLogs = (deviceId) =>
    historyLogs
      .filter(log => log.device_id === deviceId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const filteredDevices = devices.filter(d => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      (d.name || '').toLowerCase().includes(q) ||
      (d.asset_tag || '').toLowerCase().includes(q) ||
      (d.assigned_to || '').toLowerCase().includes(q)
    );
  });

  // ✅ คำนวณ pagination จากผลลัพธ์ที่ค้นหาแล้ว
  const totalPages = Math.max(1, Math.ceil(filteredDevices.length / ITEMS_PER_PAGE));

  // ✅ ถ้าค้นหาใหม่แล้วหน้าปัจจุบันเกินจำนวนหน้าที่มี ให้ดีดกลับไปหน้า 1
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const paginatedDevices = filteredDevices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleExportExcel = (device) => {
    const logs = getDeviceLogs(device.id);
    if (logs.length === 0) {
      alert('ไม่มีประวัติให้ export');
      return;
    }

    const rows = logs.map(log => ({
      'วันที่': new Date(log.created_at).toLocaleDateString('th-TH'),
      'เวลา': new Date(log.created_at).toLocaleTimeString('th-TH'),
      'การกระทำ': actionLabels[log.action]?.label || log.action,
      'รายละเอียด': log.description || '',
      'ผู้ดำเนินการ': log.performed_by || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 40 }, { wch: 20 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'History');

    const fileName = `ประวัติ_${device.asset_tag || device.name}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
            <History className="text-primary" size={22} />
            ประวัติการทำงานในระบบ </h2>
        </div>
      </div>
      <div className="relative flex-1 min-w-48">
         <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="ค้นหาด้วยชื่ออุปกรณ์, รหัสทรัพย์สิน, ผู้ถือครอง..."
          className="pl-9 h-10 w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredDevices.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Monitor size={40} className="mx-auto mb-3 opacity-30" />
          <p>ไม่พบข้อมูลอุปกรณ์</p>
        </div>
      ) : (
        <>
          {/* ✅ เปลี่ยนจาก grid การ์ด เป็น รายการแถวยาวเรียงลงมาทีละแถว (1 คอลัมน์) */}
          <div className="flex flex-col gap-3">
            {paginatedDevices.map(device => {
              const logs = getDeviceLogs(device.id);
              const isExpanded = expandedId === device.id;
              const previewLogs = logs.slice(0, 3);

              return (
                <div key={device.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-foreground truncate">{device.name}</p>
                        <span className="text-xs text-muted-foreground font-mono">{device.asset_tag || '—'}</span>
                        <span className="text-xs text-muted-foreground">• {logs.length} รายการในประวัติ</span>
                      </div>

                      <div className="mt-3 space-y-2">
                        {logs.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">ยังไม่มีประวัติการทำงาน</p>
                        ) : (
                          (isExpanded ? logs : previewLogs).map(log => {
                            const meta = actionLabels[log.action] || { label: log.action, color: '#6b7280' };
                            const date = new Date(log.created_at);
                            return (
                              <div key={log.id} className="flex items-start gap-2 text-xs border-l-2 pl-2" style={{ borderColor: meta.color }}>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                                    <span className="text-muted-foreground">
                                      {date.toLocaleDateString('th-TH')} {date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  {log.description && <p className="text-muted-foreground truncate">{log.description}</p>}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {logs.length > 3 && (
                        <button
                          className="mt-3 text-xs text-primary flex items-center gap-1 hover:underline"
                          onClick={() => setExpandedId(isExpanded ? null : device.id)}
                        >
                          {isExpanded ? (<>ย่อประวัติ <ChevronUp size={12} /></>) : (<>ดูทั้งหมด ({logs.length}) <ChevronDown size={12} /></>)}
                        </button>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      title="Export เป็น Excel"
                      onClick={() => handleExportExcel(device)}
                    >
                      <Download size={15} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ✅ ส่วนแบ่งหน้า แสดงเฉพาะเมื่อมีมากกว่า 1 หน้า */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1 py-2 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                แสดง {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredDevices.length)} จาก {filteredDevices.length} อุปกรณ์
              </p>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} />
                </Button>

                <span className="text-xs text-muted-foreground px-2">
                  หน้า {currentPage} / {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
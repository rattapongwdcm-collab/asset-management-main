import React, { useState, useEffect } from 'react';
import { Monitor, Eye, ArrowRightLeft, Trash2, CalendarDays, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import DeleteConfirmDialog from '@/components/Device/DeleteConfirmDialog';
import { logDeviceHistory } from '@/lib/deviceHistory';

const ITEMS_PER_PAGE = 10;

export default function DeviceTable({
  loading,
  filtered,
  statusColors,
  setDetailItem,
  setEditItem,
  setDeleteId,
  deleteId,
  fetchDevices
}) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  // ✅ ถ้าข้อมูลถูกกรอง/ค้นหาใหม่แล้วหน้าปัจจุบันเกินจำนวนหน้าที่มี ให้ดีดกลับไปหน้า 1
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [filtered.length, totalPages, currentPage]);

  const paginatedItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

const handleDelete = async (deviceId) => {
  const device = filtered.find(d => d.id === deviceId);
  if (!device) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert("กรุณาเข้าสู่ระบบก่อนทำรายการ");
    return;
  }

  try {
    const { error: approvalError } = await supabase.from('approvals').insert([{
      device_id: device.id,
      device_name: device.name,
      request_type: 'delete',
      status: 'Pending',
      user_id: user.id,
      description: `ขอลบอุปกรณ์ ${device.asset_tag || ''}`
    }]);
    if (approvalError) throw approvalError;

    const { error: statusError } = await supabase
      .from('devices')
      .update({ status: 'รออนุมัติลบ' })
      .eq('id', device.id);
    if (statusError) throw statusError;
    
    await logDeviceHistory({
      deviceId: device.id,
      assetTag: device.asset_tag,
      deviceName: device.name,
      action: 'delete_request',
      description: `ขออนุมัติลบอุปกรณ์ ${device.asset_tag || ''}`,
      performedBy: user.email,
    });
    fetchDevices();
    setDeleteId(null);   // ✅ ปิด dialog ยืนยันแทน ไม่ต้อง alert ซ้ำ
  } catch (error) {
    console.error("Error:", error);
    alert("เกิดข้อผิดพลาด: " + error.message);   // เก็บ alert ไว้เฉพาะกรณี error เท่านั้น
  }
};
  const isLocked = (status) =>
    status === 'รออนุมัติลบ' ||
    status === 'รออนุมัติแก้ไข' ||
    status === 'รออนุมัติเคลื่อนย้าย' ||
    status === 'กำลังซ่อม';

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Monitor size={40} className="mx-auto mb-3 opacity-30" />
        <p>ไม่พบข้อมูลอุปกรณ์</p>
      </div>
    );
  }

  const renderWarrantyStatus = (expireDateString) => {
    if (!expireDateString) return <span className="text-muted-foreground/40 font-mono text-xs">—</span>;

    const expireDate = new Date(expireDateString);
    const today = new Date();

    today.setHours(0, 0, 0, 0);
    expireDate.setHours(0, 0, 0, 0);

    const diffTime = expireDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const formattedDate = expireDate.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-300 shadow-sm animate-pulse">
          <AlertTriangle size={12} className="text-red-600" />
          หมดประกัน ({formattedDate})
        </span>
      );
    }

    if (diffDays <= 30) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300 shadow-sm">
          <CalendarDays size={12} className="text-yellow-600" />
          ใกล้หมด ({formattedDate})
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
        <CheckCircle2 size={12} className="text-emerald-600" />
        {formattedDate}
      </span>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">รหัสอุปกรณ์</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">ชื่ออุปกรณ์</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">ประเภท</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">แผนก</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">มอบหมาย</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">สถานะ</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">วันหมดประกัน</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedItems.map((d) => {
              const sc = statusColors[d.status] || { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' };
              const locked = isLocked(d.status);

              return (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.asset_tag || '—'}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{d.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.department || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.assigned_to || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center justify-center rounded-full text-xs font-medium w-24 h-7 shadow-sm text-center"
                      style={{ background: sc.bg, color: sc.color }}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {renderWarrantyStatus(d.warranty_expire)}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailItem(d);
                        }}
                      >
                        <Eye size={14} />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-foreground/70 hover:text-foreground"
                        disabled={locked}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (setEditItem) setEditItem(d);
                        }}
                      >
                        <ArrowRightLeft size={14} className={locked ? 'opacity-30' : ''} />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={locked}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(d.id);
                        }}
                      >
                        <Trash2 size={14} className={locked ? 'opacity-30' : ''} />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ✅ ส่วนแบ่งหน้า แสดงเฉพาะเมื่อมีมากกว่า 1 หน้า */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            แสดง {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} จาก {filtered.length} รายการ
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
              <ChevronRight size={10} />
            </Button>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        deleteId={deleteId}
        setDeleteId={setDeleteId}
        handleDelete={handleDelete}
        deviceName={filtered.find(d => d.id === deleteId)?.name}
      />
    </div>
  );
}
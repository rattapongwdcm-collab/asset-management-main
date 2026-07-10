import React from 'react';
import { Monitor, Eye, ArrowRightLeft, Trash2, CalendarDays, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import DeleteConfirmDialog from '@/components/Device/DeleteConfirmDialog';

export default function DeviceTable({
  loading,
  filtered,
  statusColors,
  setDetailItem,
  setEditItem, // ➕ เปิด Dialog เคลื่อนย้าย (ไม่ใช่แก้ไขทั่วไปแล้ว)
  setDeleteId,
  deleteId,
  fetchDevices
}) {
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

      fetchDevices();
      alert("ส่งคำขออนุมัติลบสำเร็จ");
    } catch (error) {
      console.error("Error:", error);
      alert("เกิดข้อผิดพลาด: " + error.message);
    }
  };

  // สถานะที่ควรล็อกปุ่มไว้ ไม่ให้กดซ้ำระหว่างรออนุมัติ / กำลังซ่อม
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
            {filtered.map((d) => {
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
                      {/* 1. ปุ่ม Detail */}
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

                      {/* 2. ปุ่ม เคลื่อนย้าย (เดิมคือปุ่ม Edit) */}
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

                      {/* 3. ปุ่ม Delete */}
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
      <DeleteConfirmDialog
        deleteId={deleteId}
        setDeleteId={setDeleteId}
        handleDelete={handleDelete}
        deviceName={filtered.find(d => d.id === deleteId)?.name}
      />
    </div>
  );
}
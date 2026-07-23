import React, { useState, useEffect, useMemo } from 'react';
import { Monitor, Eye, ArrowRightLeft, Trash2, CalendarDays, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
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

  // ✅ state สำหรับ sort หัวตาราง — ค่าเริ่มต้นเรียงตาม "วันหมดประกัน" ใกล้หมดก่อน
  const [sortConfig, setSortConfig] = useState({ key: 'warranty_expire', direction: 'asc' });

  // ✅ role ของผู้ใช้ปัจจุบัน — ใช้จำกัดสิทธิ์ของ guest ให้ดูได้อย่างเดียว (ไม่ให้ย้าย/ลบ)
  const [userRole, setUserRole] = useState(null);
  const isGuest = userRole === 'guest';

  useEffect(() => {
    const loadUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setUserRole(data?.role || 'user');
    };
    loadUserRole();
  }, []);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // ✅ ฟังก์ชันเปรียบเทียบค่าสำหรับ sort แต่ละคอลัมน์ — วันหมดประกันเทียบแบบวันที่ ที่เหลือเทียบแบบข้อความ (ไม่สนตัวพิมพ์)
  const compareValues = (a, b, key) => {
    if (key === 'warranty_expire') {
      const da = a.warranty_expire ? new Date(a.warranty_expire).getTime() : null;
      const db = b.warranty_expire ? new Date(b.warranty_expire).getTime() : null;
      if (da === null && db === null) return 0;
      if (da === null) return 1;  // ไม่มีวันหมดประกัน ให้ไปอยู่ท้ายสุดเสมอ
      if (db === null) return -1;
      return da - db;
    }
    const va = (a[key] ?? '').toString().toLowerCase();
    const vb = (b[key] ?? '').toString().toLowerCase();
    return va.localeCompare(vb, 'th');
  };

  // ✅ เรียงข้อมูลตาม sortConfig (ต่อยอดจาก `filtered` ที่ส่งมาจาก Device.jsx) ก่อนค่อยแบ่งหน้า
  const sortedItems = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const cmp = compareValues(a, b, sortConfig.key);
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [sortedItems.length, totalPages, currentPage]);

  const paginatedItems = sortedItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleDelete = async (deviceId) => {
    // ✅ กันไว้อีกชั้น (defense in depth) — guest ห้ามลบแม้จะเรียกฟังก์ชันนี้ตรงๆ
    if (isGuest) {
      alert('บัญชี guest ดูข้อมูลได้อย่างเดียว ไม่สามารถลบอุปกรณ์ได้');
      return;
    }

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
      setDeleteId(null);
    } catch (error) {
      console.error("Error:", error);
      alert("เกิดข้อผิดพลาด: " + error.message);
    }
  };

  // ✅ เพิ่ม 'กำลังแจ้งซ่อม' เข้าไปในรายการสถานะที่ต้อง lock ปุ่ม
  // (เดิมเช็คแค่ 'กำลังซ่อม' ซึ่งเป็นสถานะหลังอนุมัติแจ้งซ่อมแล้วเท่านั้น
  //  ทำให้ช่วงที่เพิ่งกดแจ้งซ่อมและรออนุมัติอยู่ - สถานะ 'กำลังแจ้งซ่อม' - ปุ่มเคลื่อนย้าย/ลบยังไม่ถูก disable)
  const isLocked = (status) =>
    status === 'รออนุมัติลบ' ||
    status === 'รออนุมัติแก้ไข' ||
    status === 'รออนุมัติเคลื่อนย้าย' ||
    status === 'กำลังแจ้งซ่อม' ||
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
      day: 'numeric', month: 'short', year: 'numeric'
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

  // ✅ หัวคอลัมน์แบบกดเรียงได้ — คลิกที่ข้อความ/ทั้งเซลล์ได้เลย, hover เปลี่ยนเคอร์เซอร์เป็นนิ้วชี้และพื้นหลังเข้มขึ้นเล็กน้อย
  // ลูกศรจะโชว์ทิศทางปัจจุบันถ้าคอลัมน์นี้กำลังถูก sort อยู่ ไม่งั้นโชว์ไอคอนจางๆ บอกว่ากดได้
  const SortableHeader = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th
        className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:bg-muted/60 transition-colors"
        onClick={() => handleSort(sortKey)}
      >
        <div className="flex items-center gap-1">
          {label}
          {isActive ? (
            sortConfig.direction === 'asc'
              ? <ChevronUp size={13} className="text-foreground" />
              : <ChevronDown size={13} className="text-foreground" />
          ) : (
            <ChevronsUpDown size={13} className="opacity-30" />
          )}
        </div>
      </th>
    );
  };

  // ✅ ปุ่ม action ชุดเดียว ใช้ร่วมกันทั้ง table (desktop) และ card (mobile)
  // guest เห็นปุ่มย้าย/ลบเหมือนเดิม แต่กดไม่ได้ (disabled) และสีจางลง — ไม่ซ่อนไปเลย
  const ActionButtons = ({ d, locked }) => {
    const editDisabled = locked || isGuest;
    const deleteDisabled = locked || isGuest;
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          onClick={(e) => { e.stopPropagation(); setDetailItem(d); }}
        >
          <Eye size={14} />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-8 w-8 text-foreground/70 hover:text-foreground"
          disabled={editDisabled}
          onClick={(e) => { e.stopPropagation(); if (setEditItem) setEditItem(d); }}
        >
          <ArrowRightLeft size={14} className={editDisabled ? 'opacity-30' : ''} />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
          disabled={deleteDisabled}
          onClick={(e) => { e.stopPropagation(); setDeleteId(d.id); }}
        >
          <Trash2 size={14} className={deleteDisabled ? 'opacity-30' : ''} />
        </Button>
      </div>
    );
  };
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"> 
    <div className="md:hidden divide-y divide-border">
        {paginatedItems.map((d) => { 
          const sc = statusColors[d.status] || { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' };
          const locked = isLocked(d.status);
          return (
            <div key={d.id} className="p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{d.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{d.asset_tag || '—'}</p>
                </div>
                <span
                  className="inline-flex items-center justify-center rounded-full text-xs font-medium px-2.5 h-6 shrink-0"
                  style={{ background: sc.bg, color: sc.color }}
                >
                  {d.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div><span className="text-muted-foreground">ประเภท:</span> {d.category || '—'}</div>
                <div className="truncate"><span className="text-muted-foreground">แผนก:</span> {d.department || '—'}</div>
                <div className="truncate col-span-2"><span className="text-muted-foreground">มอบหมาย:</span> {d.assigned_to || '—'}</div>
              </div>

              <div className="flex items-center justify-between pt-1">
                {renderWarrantyStatus(d.warranty_expire)}
                <ActionButtons d={d} locked={locked} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <SortableHeader label="รหัสอุปกรณ์" sortKey="asset_tag" />
              <SortableHeader label="ชื่ออุปกรณ์" sortKey="name" />
              <SortableHeader label="ประเภท" sortKey="category" />
              <SortableHeader label="แผนก" sortKey="department" />
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">มอบหมาย</th>
              <SortableHeader label="สถานะ" sortKey="status" />
              <SortableHeader label="วันหมดประกัน" sortKey="warranty_expire" />
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
                  <td className="px-4 py-3">{renderWarrantyStatus(d.warranty_expire)}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <ActionButtons d={d} locked={locked} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            แสดง {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, sortedItems.length)} จาก {sortedItems.length} รายการ
          </p>

          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm" className="h-8 px-2.5"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              หน้า {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline" size="sm" className="h-8 px-2.5"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={14} />
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
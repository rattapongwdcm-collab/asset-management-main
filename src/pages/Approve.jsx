import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Wrench } from 'lucide-react'; // อย่าลืม import icon นี้
import DeleteAction from '@/components/Approvals/DeleteAction';

export default function Approve() {
  const [approvals, setApprovals] = useState([]);

  const loadApprovals = async () => {
    const { data, error } = await supabase
      .from('approvals')
      .select('*')
      // กรองเอาเฉพาะรายการสถานะ 'รออนุมัติ' (หรือ Pending) เพื่อไม่ให้ข้อมูลเก่าๆ มาปน
      .in('status', ['Pending', 'รออนุมัติ'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching approvals:", error);
      return;
    }
    setApprovals(data || []);
  };

  useEffect(() => { loadApprovals(); }, []);

  return (
    <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Wrench className="text-primary" size={20} /> รายการซ่อมอุปกรณ์
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">รหัสอุปกรณ์</th><th className="px-4 py-3 text-left">ชื่ออุปกรณ์</th><th className="px-4 py-3 text-left">ผู้ถือครอง</th><th className="px-4 py-3 text-left">บัญชีผู้ดำเนินการ</th><th className="px-4 py-3 text-left">ประเภท</th><th className="px-4 py-3 text-left">สถานะ</th><th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {approvals.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs">{r.asset_tag || '-'}</td>
                <td className="px-4 py-3 font-medium">{r.name}</td>

                {/* ข้อมูลผู้ถือครองจากตาราง devices (ดึงจาก payload หรือ object ที่เก็บไว้) */}
                <td className="px-4 py-3 text-muted-foreground">{r.assigned_to || '-'}</td>

                {/* บัญชีผู้ดำเนินการ: ดึงจากที่บันทึกอีเมลตอน login มาไว้ในคอลัมน์ requested_by */}
                <td className="px-4 py-3 text-muted-foreground">{r.requested_by || 'unknown@dcm.com'}</td>

                {/* ประเภท: Fix ค่าเป็น 'ขอลบข้อมูล' */}
                <td className="px-4 py-3 text-muted-foreground">ขอลบข้อมูล</td>

                {/* สถานะ: Fix ค่าเป็น 'รออนุมัติ' */}
                <td className="px-4 py-3 text-muted-foreground">รออนุมัติ</td>

                <td className="px-4 py-3 text-right">
                  <DeleteAction item={r} onRefresh={loadApprovals} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
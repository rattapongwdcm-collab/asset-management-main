import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ClipboardCheck, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Approve() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [userRole, setUserRole] = useState(null); // 🟢 เพิ่ม state เก็บ role

  const loadData = async () => {
    setLoading(true);

    // 1. ตรวจสอบสิทธิ์ผู้ใช้งานปัจจุบัน
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile) setUserRole(profile.role);
    }

    // 2. ดึงข้อมูลคำขอ
    const { data, error } = await supabase
    .from('approvals')
    .select(`
      *,
      profiles:user_id (
        email
      )
    `) // 🟢 เพิ่มส่วนนี้เพื่อดึงอีเมลจากตาราง profiles ที่เชื่อมกับ user_id
    .order('created_at', { ascending: false });
      console.log("Data loaded from Supabase:", data);
  if (data) {
    setApprovals(data);
  }
};

    useEffect(() => { loadData(); }, []);

    const handleAction = async (item, action) => {
      // เพิ่มการป้องกันสิทธิ์ซ้ำอีกชั้นที่ฟังก์ชันนี้
      if (userRole !== 'admin') {
        alert("คุณไม่มีสิทธิ์ดำเนินการนี้");
        return;
      }

      setSubmittingId(item.id);
      try {
        const type = (item.request_type || '').toLowerCase();

        if (action === 'approve') {
          if (type === 'repair') {
            await supabase.from('repairs').insert([{
              device_id: item.device_id,
              device_name: item.device_name,
              issue_description: item.description,
              status: 'Pending'
            }]);
            await supabase.from('devices').update({ status: 'กำลังซ่อม' }).eq('id', item.device_id);
          } else if (type === 'edit') {
            await supabase.from('devices').update(item.changed_fields).eq('id', item.device_id);
          } else if (type === 'delete') {
            await supabase.from('devices').delete().eq('id', item.device_id);
          } else {
            await supabase.from('devices').update({ status: 'ใช้งาน' }).eq('id', item.device_id);
          }
        } else {
          await supabase.from('devices').update({ status: 'ใช้งาน' }).eq('id', item.device_id);
        }

        await supabase.from('approvals').update({ status: action === 'approve' ? 'Approved' : 'Rejected' }).eq('id', item.id);
        alert(`ดำเนินการ ${action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'} เรียบร้อย`);
        loadData();
      } catch (err) {
        alert("Error: " + err.message);
      } finally {
        setSubmittingId(null);
      }
    };

    return (
      <div className="space-y-6 p-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardCheck className="text-primary" /> งานรออนุมัติ ({approvals.length})
        </h2>

        <div className="bg-card border rounded-lg shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left">วันที่</th>
                <th className="px-4 py-3 text-left">ผู้ขอ</th>
                <th className="px-4 py-3 text-left">รหัสอุปกรณ์</th>
                <th className="px-4 py-3 text-left">ชื่ออุปกรณ์</th>
                <th className="px-4 py-3 text-left">ประเภท</th>
                <th className="px-4 py-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map(item => (
                <tr key={item.id} className="border-b">
                  <td className="px-4 py-3">{new Date(item.created_at).toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3">{item.profiles?.email || item.user_id}</td>
                  <td className="px-4 py-3">{item.approvals?.asset_tag || item.asset_tag}</td>
                  <td className="px-4 py-3">{item.devices?.name || item.device_name}</td>
                  <td className="px-4 py-3 font-semibold capitalize">{item.request_type}</td>
                  <td className="px-4 py-3 flex justify-center gap-2">
                    {userRole === 'admin' ? ( // 🟢 เช็คสิทธิ์ก่อนแสดงปุ่ม
                      <>
                        <Button size="sm" onClick={() => handleAction(item, 'approve')} disabled={submittingId === item.id}>
                          {submittingId === item.id ? '...' : <Check size={16} />}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAction(item, 'reject')} disabled={submittingId === item.id}>
                          <X size={16} />
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">ไม่มีสิทธิ์</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
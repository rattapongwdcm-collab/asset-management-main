import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ClipboardCheck, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logDeviceHistory } from '@/lib/deviceHistory';

export default function Approve() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [confirmAction, setConfirmAction] = useState({ open: false, item: null, type: '' });

  const loadData = async () => {
    setLoading(true);
    // ... (ส่วนดึง user role เหมือนเดิม) ...

    const { data, error } = await supabase
      .from('approvals')
      .select('*, profiles (email), devices (name, asset_tag)')
      .eq('status', 'Pending') // 🟢 เพิ่มบรรทัดนี้: กรองเอาเฉพาะงานที่ยังรออนุมัติ
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error loading data:", error);
    } else {
      setApprovals(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleExecuteAction = async () => {
    const { item, type } = confirmAction;
    setSubmittingId(item.id);
    const requestType = (item.request_type || '').trim().toLowerCase();

    try {
      if (type === 'approve') {
        if (requestType === 'repair') {
          const { error: repairError } = await supabase
            .from('repairs')
            .update({ status: 'กำลังซ่อม' })
            .eq('id', item.repair_id);
          if (repairError) throw repairError;

          const { error: statusError } = await supabase
            .from('devices')
            .update({ status: 'กำลังซ่อม' })
            .eq('id', item.device_id);
          if (statusError) throw statusError;

          // ✅ log
          await logDeviceHistory({
            deviceId: item.device_id,
            action: 'repair_approved',
            description: `อนุมัติแจ้งซ่อม: ${item.description || ''}`,
          });
        }
        else if (requestType === 'edit') {
          const { error: editError } = await supabase
            .from('devices')
            .update(item.changed_fields)
            .eq('id', item.device_id);
          if (editError) throw editError;

          const { error: statusError } = await supabase
            .from('devices')
            .update({ status: 'ใช้งาน' })
            .eq('id', item.device_id);
          if (statusError) throw statusError;

          // ✅ log
          await logDeviceHistory({
            deviceId: item.device_id,
            action: 'edit_approved',
            description: `อนุมัติแก้ไขข้อมูลอุปกรณ์`,
          });
        }
        else if (requestType === 'move') {
          const { department, assigned_to } = item.changed_fields || {};

          const { error: moveError } = await supabase
            .from('devices')
            .update({
              department,
              assigned_to,
              status: 'ใช้งาน'
            })
            .eq('id', item.device_id);
          if (moveError) throw moveError;

          // ✅ log
          await logDeviceHistory({
            deviceId: item.device_id,
            action: 'move_approved',
            description: `อนุมัติเคลื่อนย้ายไปแผนก ${department || ''}`,
          });
        }
        else if (requestType === 'delete') {
          // ✅ log ก่อนลบ device จริง (สำคัญ: ต้อง log ก่อน ไม่งั้น FK constraint จะพังตอน insert)
          await logDeviceHistory({
            deviceId: item.device_id,
            action: 'delete_approved',
            description: `อนุมัติลบอุปกรณ์ออกจากระบบ`,
          });

          const { error: cleanupError } = await supabase
            .from('approvals')
            .delete()
            .eq('device_id', item.device_id);
          if (cleanupError) throw cleanupError;

          const { error: deleteError } = await supabase
            .from('devices')
            .delete()
            .eq('id', item.device_id);
          if (deleteError) throw deleteError;

          await loadData();
          setSubmittingId(null);
          setConfirmAction({ open: false, item: null, type: '' });
          return;
        }
        else {
          throw new Error(`ไม่รู้จัก request_type: "${item.request_type}"`);
        }
      }
      else if (type === 'reject') {
        if (requestType === 'repair' && item.repair_id) {
          const { error: deleteRepairError } = await supabase
            .from('repairs')
            .delete()
            .eq('id', item.repair_id);
          if (deleteRepairError) throw deleteRepairError;
        }
        const { error: revertError } = await supabase
          .from('devices')
          .update({ status: 'ใช้งาน' })
          .eq('id', item.device_id);
        if (revertError) throw revertError;

        // ✅ log สำหรับทุกประเภทที่ถูกปฏิเสธ
        const rejectActionMap = {
          repair: 'repair_rejected',
          edit: 'edit_rejected',
          move: 'move_rejected',
          delete: 'delete_rejected'
        };
        await logDeviceHistory({
          deviceId: item.device_id,
          action: rejectActionMap[requestType] || 'rejected',
          description: `ปฏิเสธคำขอ: ${item.description || ''}`,
        });
      }

      const { error: closeError } = await supabase
        .from('approvals')
        .update({ status: type === 'approve' ? 'Approved' : 'Rejected' })
        .eq('id', item.id);
      if (closeError) throw closeError;

      await loadData();
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setSubmittingId(null);
      setConfirmAction({ open: false, item: null, type: '' });
    }
  };
  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
        <ClipboardCheck className="text-primary" size={22} />
        รายการอุปกรณ์ </h2>

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
            {approvals.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="px-4 py-3">{new Date(item.created_at).toLocaleString('th-TH')}</td>
                <td className="px-4 py-3">{item.profiles?.email || '—'}</td>
                <td className="px-4 py-3">{item.devices?.asset_tag || item.description || '—'}</td>
                <td className="px-4 py-3">{item.devices?.name || item.device_name || '—'}</td>
                <td className="px-4 py-3 font-semibold capitalize">{item.request_type}</td>
                <td className="px-4 py-3 flex justify-center gap-2">
                  <>
                    <Button
                      size="sm"
                      onClick={() => setConfirmAction({ open: true, item, type: 'approve' })}
                      disabled={submittingId === item.id}
                    >
                      <Check size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setConfirmAction({ open: true, item, type: 'reject' })}
                      disabled={submittingId === item.id}
                    >
                      <X size={16} />
                    </Button>
                  </>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmAction.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-2xl max-w-sm w-full border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">
              ยืนยันการ{confirmAction.type === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}?
            </h3>
            <p className="text-sm text-muted-foreground mt-2 mb-6">คุณต้องการดำเนินการกับรายการนี้ใช่หรือไม่?</p>
            <div className="flex justify-end gap-2">
              <Button className="hover:bg-[#111827] hover:text-white"
                variant="outline" onClick={() => setConfirmAction({ ...confirmAction, open: false })}>ยกเลิก</Button>
              <Button className="hover:bg-[#111827] hover:text-white"
                variant="outline variant={confirmAction.type === 'approve' ? 'default' : 'destructive'} " onClick={handleExecuteAction}>ยืนยัน</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
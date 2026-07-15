import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ClipboardCheck, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logDeviceHistory } from '@/lib/deviceHistory';

// ✅ map ชนิดคำขอ -> ชื่อ action ตอนถูกปฏิเสธ ใช้ตอน log ประวัติ แยกไว้นอก component กันสร้างซ้ำทุก render
const rejectActionMap = {
  repair: 'repair_rejected',
  edit: 'edit_rejected',
  move: 'move_rejected',
  delete: 'delete_rejected',
  delete_accessory: 'delete_accessory_rejected',
};

export default function Approve() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  // ⚠️ userRole: ยังไม่มีจุดไหนในไฟล์นี้เรียก setUserRole หรือใช้ค่านี้จริง
  // เก็บไว้ตามเดิมเผื่อมีโค้ดส่วนอื่นพึ่งพาอยู่ — ถ้ายืนยันว่าไม่ใช้ ให้ลบ state นี้ทิ้งได้เลย
  const [userRole, setUserRole] = useState(null);
  const [confirmAction, setConfirmAction] = useState({ open: false, item: null, type: '' });

  // โหลดรายการคำขออนุมัติที่ยัง Pending อยู่ พร้อมข้อมูลผู้ขอ, อุปกรณ์ (devices) และอุปกรณ์เสริม (accessories) ที่เกี่ยวข้อง
  const loadData = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('approvals')
      .select('*, profiles (email), devices (name, asset_tag), accessories (name)')
      .eq('status', 'Pending') // กรองเอาเฉพาะงานที่ยังรออนุมัติ
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error loading data:", error);
    } else {
      setApprovals(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // ดำเนินการอนุมัติ/ปฏิเสธคำขอ ตามชนิด request_type (repair / edit / move / delete / delete_accessory)
  const handleExecuteAction = async () => {
    const { item, type } = confirmAction;
    setSubmittingId(item.id);
    const requestType = (item.request_type || '').trim().toLowerCase();

    // ดึงอีเมลผู้กดอนุมัติ/ปฏิเสธ ใช้บันทึกทั้งใน approvals และ device_history
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const approverEmail = currentUser?.email || 'ไม่ทราบผู้ดำเนินการ';

    try {
      if (type === 'approve') {

        // ---------- อนุมัติแจ้งซ่อม ----------
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

          await logDeviceHistory({
            deviceId: item.device_id,
            action: 'repair_approved',
            description: `อนุมัติแจ้งซ่อม: ${item.description || ''}`,
            performedBy: approverEmail,
          });
        }

        // ---------- อนุมัติแก้ไขข้อมูลอุปกรณ์ ----------
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

          await logDeviceHistory({
            deviceId: item.device_id,
            action: 'edit_approved',
            description: `อนุมัติแก้ไขข้อมูลอุปกรณ์`,
            performedBy: approverEmail,
          });
        }

        // ---------- อนุมัติเคลื่อนย้ายอุปกรณ์ ----------
        else if (requestType === 'move') {
          const { department, assigned_to } = item.changed_fields || {};

          const { error: moveError } = await supabase
            .from('devices')
            .update({ department, assigned_to, status: 'ใช้งาน' })
            .eq('id', item.device_id);
          if (moveError) throw moveError;

          await logDeviceHistory({
            deviceId: item.device_id,
            action: 'move_approved',
            description: `อนุมัติเคลื่อนย้ายไปแผนก ${department || ''}`,
            performedBy: approverEmail,
          });
        }

        // ---------- อนุมัติลบอุปกรณ์ (devices) ----------
        else if (requestType === 'delete') {
          // ต้อง log ก่อนลบ device จริงเสมอ ไม่งั้น FK constraint จะพังตอน insert log ทีหลัง
          await logDeviceHistory({
            deviceId: item.device_id,
            action: 'delete_approved',
            description: `อนุมัติลบอุปกรณ์ออกจากระบบ: ${item.devices?.name || ''} (${item.devices?.asset_tag || ''})`,
            performedBy: approverEmail,
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

          // กรณี delete ปิดงานจบตรงนี้เลย (ไม่ต้องไปอัปเดตสถานะ approvals ต่อ เพราะลบทั้งแถวไปแล้ว)
          await loadData();
          setSubmittingId(null);
          setConfirmAction({ open: false, item: null, type: '' });
          return;
        }

        // ---------- อนุมัติลบอุปกรณ์เสริม (accessories) ----------
        else if (requestType === 'delete_accessory') {
          // อุปกรณ์เสริมไม่มีตาราง history แยก จึงลบทั้งคำขอ (ของอุปกรณ์เสริมชิ้นนี้) และตัว accessory เอง
          const { error: cleanupError } = await supabase
            .from('approvals')
            .delete()
            .eq('accessory_id', item.accessory_id);
          if (cleanupError) throw cleanupError;

          const { error: deleteError } = await supabase
            .from('accessories')
            .delete()
            .eq('id', item.accessory_id);
          if (deleteError) throw deleteError;

          // ปิดงานจบตรงนี้เลย เหมือน branch 'delete' ของ devices เพราะลบทั้งแถว approvals ไปแล้ว
          await loadData();
          setSubmittingId(null);
          setConfirmAction({ open: false, item: null, type: '' });
          return;
        }

        else {
          throw new Error(`ไม่รู้จัก request_type: "${item.request_type}"`);
        }
      }

      // ---------- ปฏิเสธคำขอ (ทุกชนิด) ----------
      else if (type === 'reject') {
        if (requestType === 'repair' && item.repair_id) {
          const { error: deleteRepairError } = await supabase
            .from('repairs')
            .delete()
            .eq('id', item.repair_id);
          if (deleteRepairError) throw deleteRepairError;
        }

        // การปฏิเสธคำขอลบอุปกรณ์เสริม ไม่ต้องแตะตาราง devices เลย (accessories ไม่ผูกกับ devices)
        if (requestType !== 'delete_accessory') {
          const { error: revertError } = await supabase
            .from('devices')
            .update({ status: 'ใช้งาน' })
            .eq('id', item.device_id);
          if (revertError) throw revertError;

          await logDeviceHistory({
            deviceId: item.device_id,
            action: rejectActionMap[requestType] || 'rejected',
            description: `ปฏิเสธคำขอ: ${item.description || ''}`,
            performedBy: approverEmail,
          });
        }
      }

      // ปิดงาน: อัปเดตสถานะ + บันทึกผู้อนุมัติ/ปฏิเสธไว้ในตาราง approvals เอง
      const { error: closeError } = await supabase
        .from('approvals')
        .update({
          status: type === 'approve' ? 'Approved' : 'Rejected',
          approved_by_email: approverEmail,
        })
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

  // ปุ่มอนุมัติ/ปฏิเสธ แยกเป็น component ย่อย ใช้ร่วมกันทั้ง mobile card และ desktop table
  const ApproveActions = ({ item }) => (
    <div className="flex gap-2 w-full sm:w-auto">
      <Button
        size="sm"
        className="text-xs hover:bg-[#111827] hover:text-white flex-1 sm:flex-none"
        variant="outline"
        onClick={() => setConfirmAction({ open: true, item, type: 'approve' })}
        disabled={submittingId === item.id}
      >
        <Check size={16} />
      </Button>
      <Button
        size="sm"
        className="text-xs hover:bg-[#111827] hover:text-white flex-1 sm:flex-none"
        variant="outline"
        onClick={() => setConfirmAction({ open: true, item, type: 'reject' })}
        disabled={submittingId === item.id}
      >
        <X size={16} />
      </Button>
    </div>
  );

  // ชื่อ/รหัสที่จะโชว์ในตาราง รองรับทั้งรายการของ devices และ accessories
  const displayName = (item) => item.devices?.name || item.device_name || item.accessories?.name || item.accessory_name || '—';
  const displayCode = (item) => item.devices?.asset_tag || item.description || '—';

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
        <ClipboardCheck className="text-primary" size={22} />
        รายการอุปกรณ์
      </h2>

      <div className="bg-card border rounded-lg shadow-sm overflow-hidden">

        {/* MOBILE VIEW (< md): การ์ดแถวยาว แทนตารางที่มี 6 คอลัมน์ (แน่นเกินจอมือถือ) */}
        <div className="md:hidden divide-y divide-border">
          {loading ? (
            <p className="text-center py-6 text-muted-foreground text-sm">กำลังโหลดข้อมูล...</p>
          ) : approvals.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">ไม่มีรายการรออนุมัติ</p>
          ) : (
            approvals.map((item) => (
              <div key={item.id} className="p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{displayName(item)}</p>
                    <p className="font-mono text-xs text-muted-foreground">{displayCode(item)}</p>
                  </div>
                  <span className="text-xs font-semibold capitalize px-2 py-1 rounded-full bg-primary/10 text-primary shrink-0">
                    {item.request_type}
                  </span>
                </div>

                <div className="text-xs space-y-1 text-muted-foreground">
                  <p>วันที่: {new Date(item.created_at).toLocaleString('th-TH')}</p>
                  <p>ผู้ขอ: {item.profiles?.email || '—'}</p>
                </div>

                <div className="pt-1">
                  <ApproveActions item={item} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* DESKTOP / TABLET VIEW (md ขึ้นไป): ตารางเดิม */}
        <table className="hidden md:table w-full text-sm">
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
            {loading ? (
              <tr><td colSpan="6" className="text-center py-4 text-muted-foreground">กำลังโหลดข้อมูล...</td></tr>
            ) : approvals.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-4 text-muted-foreground">ไม่มีรายการรออนุมัติ</td></tr>
            ) : (
              approvals.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="px-4 py-3">{new Date(item.created_at).toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3">{item.profiles?.email || '—'}</td>
                  <td className="px-4 py-3">{displayCode(item)}</td>
                  <td className="px-4 py-3">{displayName(item)}</td>
                  <td className="px-4 py-3 font-semibold capitalize">{item.request_type}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <ApproveActions item={item} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Popup ยืนยันอนุมัติ/ปฏิเสธ */}
      {confirmAction.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white p-6 rounded-lg shadow-2xl max-w-sm w-full border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">
              ยืนยันการ{confirmAction.type === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}?
            </h3>
            <p className="text-sm text-muted-foreground mt-2 mb-6">คุณต้องการดำเนินการกับรายการนี้ใช่หรือไม่?</p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <Button
                className="text-xs hover:bg-[#111827] hover:text-white"
                variant="outline"
                onClick={() => setConfirmAction({ ...confirmAction, open: false })}
              >
                ยกเลิก
              </Button>
              <Button
                className="text-xs hover:bg-[#111827] hover:text-white"
                variant={confirmAction.type === 'approve' ? 'outline' : 'destructive'}
                onClick={handleExecuteAction}
              >
                ยืนยัน
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
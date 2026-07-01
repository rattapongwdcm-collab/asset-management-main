import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export default function DeleteAction({ item, onRefresh }) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (isApproved) => {
    setLoading(true);
    try {
      if (isApproved) {
        // 1. อนุมัติ: ลบออกจากตาราง devices
        const { error: deleteError } = await supabase
          .from('devices')
          .delete()
          .eq('id', item.device_id);
        if (deleteError) throw deleteError;

        // 2. อัปเดตสถานะคำขอเป็น Approved
        await supabase.from('approvals').update({ status: 'Approved' }).eq('id', item.id);
      } else {
        // 1. ปฏิเสธ: คืนสถานะอุปกรณ์ให้ 'พร้อมใช้งาน' (หรือสถานะปกติของคุณ)
        await supabase.from('devices')
          .update({ status: 'พร้อมใช้งาน' }) 
          .eq('id', item.device_id);

        // 2. อัปเดตสถานะคำขอเป็น Rejected
        await supabase.from('approvals').update({ status: 'Rejected' }).eq('id', item.id);
      }
      onRefresh();
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 justify-end">
      <Button 
        size="sm" 
        variant="outline" 
        onClick={() => handleAction(false)} 
        disabled={loading}
        className="text-xs"
      >
        ปฏิเสธ
      </Button>
      <Button 
        size="sm" 
        variant="default" 
        onClick={() => handleAction(true)} 
        disabled={loading}
        className="text-xs bg-primary hover:bg-primary/90"
      >
        อนุมัติ
      </Button>
    </div>
  );
}
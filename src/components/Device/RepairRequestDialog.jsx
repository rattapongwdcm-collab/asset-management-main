import React, { useState } from 'react';
import { Wrench, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase'; // 💡 เช็ค path ตัวแปร supabase ของพี่ด้วยนะครับ
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function RepairRequestDialog({ isOpen, onClose, device, onSuccess }) {
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('ปกติ');
  const [loading, setLoading] = useState(false);

  if (!device) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      alert('กรุณากรอกอาการเสียหรือเหตุผลที่ส่งซ่อม');
      return;
    }

    setLoading(false);
    try {
      setLoading(true);

      // 🚀 1. อัปเดตสถานะที่ตาราง devices เป็น "รออนุมัติส่งซ่อม"
      // พร้อมกับแนบข้อมูลอาการเสียเข้าไป (แนะนำให้มีฟิลด์เก็บ หรือส่งผ่านคอมเมนต์ในระบบ)
      const { error } = await supabase
        .from('devices')
        .update({ 
          status: 'รออนุมัติส่งซ่อม',
          // 💡 ถ้าพี่มีฟิลด์เหล่านี้ในตาราง devices สามารถเปิดใช้งานได้ครับ:
          // repair_reason: `${urgency === 'ด่วนที่สุด' ? '[🔥ด่วนที่สุด] ' : ''}${description}`
        })
        .eq('id', device.id);

      if (error) throw error;

      // 💡 ข้อความจำลองเพื่อส่งไปให้ Trigger ขยายความใน Log (ถ้าต้องการ)
      // แต่ ณ ปัจจุบัน Trigger จะบันทึกการเปลี่ยนสถานะ 'รออนุมัติส่งซ่อม' ให้พี่อัตโนมัติอยู่แล้วครับ

      alert('ส่งคำขออนุมัติแจ้งซ่อมเรียบร้อยแล้ว');
      setDescription('');
      setUrgency('ปกติ');
      if (onSuccess) onSuccess(); // ปิด Dialog และสั่ง reload หน้าจอหลัก
    } catch (error) {
      console.error('Error submitting repair request:', error);
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border border-border rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
              <Wrench size={18} />
            </div>
            สร้างรายการแจ้งซ่อมอุปกรณ์
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs mt-1">
            ยื่นคำขอส่งซ่อมสำหรับอุปกรณ์ <span className="font-semibold text-foreground">{device.name}</span> ({device.asset_tag || 'ไม่ระบุรหัส'})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* ส่วนเลือกความเร่งด่วน */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Clock size={12} /> ระดับความเร่งด่วน
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['ปกติ', 'ด่วน', 'ด่วนที่สุด'].map((level) => {
                const isActive = urgency === level;
                let activeStyle = "bg-amber-50 text-amber-600 border-amber-300 dark:bg-amber-950/20";
                if (level === 'ด่วนที่สุด') activeStyle = "bg-rose-50 text-rose-600 border-rose-300 dark:bg-rose-950/20";
                if (level === 'ปกติ') activeStyle = "bg-primary/10 text-primary border-primary/30";

                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setUrgency(level)}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                      isActive 
                        ? `${activeStyle} shadow-sm font-semibold` 
                        : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                    }`}
                  >
                    {level === 'ด่วนที่สุด' && '🔥 '}
                    {level}
                  </button>
                );
              })}
            </div>
          </div>

          {/* รายละเอียดอาการเสีย */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <AlertCircle size={12} /> อาการเสีย / เหตุผลการส่งซ่อม
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="กรุณาระบุรายละเอียด เช่น หน้าจอเปิดไม่ติด, เครื่องร้อนผิดปกติ, อัปเกรด RAM..."
              rows={4}
              className="w-full text-sm p-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-4 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="text-xs h-9"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white font-medium"
            >
              {loading ? 'กำลังบันทึก...' : '⚙️ ยื่นคำขอแจ้งซ่อม'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
import React, { useState } from 'react';
import { History, ArrowDownToLine, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DeviceHistoryView from '@/components/Device/DeviceHistoryView';

export default function HistoryPage() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-200">

      {/* ส่วนหัวของหน้า Page (Header) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <History className="text-primary h-6 w-6" />
            <span>ประวัติการทำงานในระบบ (System History)</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ตรวจสอบบันทึกการเพิ่ม ลบ แก้ไข ข้อมูลอุปกรณ์และสินทรัพย์ไอทีทั้งหมด
          </p>
        </div>
      </div>

        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input type="text" placeholder="ค้นหาด้วย รหัสอุปกรณ์ (เช่น PC-202), รายละเอียด, ผู้จัดการ..." className="pl-9 h-10 w-full" value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {/* 🎯 แสดงผลข้อมูลแบบเต็มหน้า (ไม่มี bg-card ห่อหุ้มแล้ว) */}
        <div className="w-full">
          {/* ส่ง searchTerm ไปกรองข้อมูล และกำหนดให้เต็มหน้าจอโดยปรับพิกัด scroll */}
          <DeviceHistoryView deviceId={null} searchTerm={searchTerm} isFullPage={true} />
        </div>

      </div>
      );
}
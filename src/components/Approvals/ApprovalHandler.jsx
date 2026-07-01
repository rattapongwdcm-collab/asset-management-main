import React from 'react';
import DeleteAction from './DeleteAction'; // ตรวจสอบ Path ให้ถูกต้องตามตำแหน่งไฟล์คุณ
import RepairAction from './RepairAction';
import BorrowAction from './BorrowAction';
import EditAction from './EditAction';

export default function ApprovalHandler({ item, onRefresh }) {
  // ตรวจสอบว่ามี item หรือไม่ เพื่อป้องกัน Error
  if (!item) return null;

  switch (item.request_type) {
    case 'Delete': 
      return <DeleteAction item={item} onRefresh={onRefresh} />;
    case 'Repair': 
      return <RepairAction item={item} onRefresh={onRefresh} />;
    case 'Borrow': 
      return <BorrowAction item={item} onRefresh={onRefresh} />;
    case 'Edit':   
      return <EditAction item={item} onRefresh={onRefresh} />;
    default: 
      return <span className="text-muted-foreground text-xs">ไม่พบ Action</span>;
  }
}
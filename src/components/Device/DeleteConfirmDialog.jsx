import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function DeleteConfirmDialog({ deleteId, setDeleteId, handleDelete }) {
  return (
    <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>ยืนยันการลบ</DialogTitle>
        </DialogHeader>
        
        <p className="text-sm text-muted-foreground mt-1">
          คุณต้องการลบอุปกรณ์นี้ใช่หรือไม่? ข้อมูลจะถูกลบถาวร
        </p>
        
        <div className="flex justify-end gap-3 mt-4">
          <Button className="hover:bg-[#111827] hover:text-white" variant="outline" onClick={() => setDeleteId(null)}>
            ยกเลิก
          </Button>
          <Button  className="hover:bg-[#111827] hover:text-white" variant="destructive" onClick={() => handleDelete(deleteId)}>
            ลบ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
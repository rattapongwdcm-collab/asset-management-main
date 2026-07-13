import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function CloseConfirmDialog({
  isOpen,
  setIsOpen,
  setDialogOpen,
  setErrors,
  setForm,
  emptyForm
}) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>ยืนยันการปิด</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          คุณมีข้อมูลที่ยังไม่ได้บันทึก ต้องการปิดหน้าต่างหรือไม่?
        </p>

        <div className="flex justify-end gap-3 mt-4">
          <Button
            className="hover:bg-[#111827] hover:text-white"
            variant="outline"
            onClick={() => setIsOpen(false)}
          >
            กลับไปแก้ไข
          </Button>

          <Button
            className="hover:bg-[#111827] hover:text-white"
            variant="destructive"
            onClick={() => {
              setIsOpen(false);
              setDialogOpen(false);
              setErrors({});
              setForm(emptyForm);
            }}
          >
            ปิดโดยไม่บันทึก
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
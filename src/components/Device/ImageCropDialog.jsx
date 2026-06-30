import React from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function ImageCropDialog({
  isOpen,
  setIsOpen,
  imageSrc,
  crop,
  setCrop,
  zoom,
  setZoom,
  onCropComplete,
  onSave
}) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>ปรับแต่งขนาดรูปภาพ</DialogTitle>
        </DialogHeader>

        {/* พื้นที่สำหรับตัดรูป */}
        <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden mt-2">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1} 
              cropShape="rect" // ใช้ "rect" สำหรับทรงเหลี่ยมมน หรือเปลี่ยนเป็น "round" สำหรับวงกลม
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        {/* แถบเลื่อนปรับขนาดด้วย input range มาตรฐาน */}
        <div className="space-y-1.5 mt-4">
          <div className="flex justify-between text-xs text-muted-foreground font-medium">
            <span>ซูมรูปภาพ</span>
            <span>{zoom}x</span>
          </div>
          <input
            type="range"
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
          />
        </div>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            ยกเลิก
          </Button>
          <Button onClick={onSave}>
            ยืนยันตัดรูปภาพ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
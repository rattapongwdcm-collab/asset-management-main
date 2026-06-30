import React from 'react';
import { Camera } from 'lucide-react'; // เปลี่ยนจาก Plus เป็น Camera ให้ฟีลเปลี่ยนรูปโปรไฟล์

export default function ImageUploader({ imageUrl, onImageChange }) {
  return (
    <div className="flex flex-col items-center">
      <label
        htmlFor="upload-image"
        className="relative group mt-4 cursor-pointer w-32 h-32 rounded-xl overflow-hidden border-2 border-muted shadow-sm block"
      >
        {imageUrl ? (
          <>
            {/* 1. รูปภาพหลัก */}
            <img
              src={imageUrl}
              alt="preview"
              className="w-full h-full object-cover transition duration-200"
            />
            
            {/* 2. เลเยอร์สีดำโปร่งแสงที่จะโผล่มาตอน Hover (เหมือน Facebook) */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity duration-200">
              <Camera size={22} />
              <span className="text-[11px] mt-1 font-medium">อัปเดตรูป</span>
            </div>
          </>
        ) : (
          /* 3. สเตตัสตอนยังไม่มีการอัปโหลดรูปภาพ */
          <div className="w-full h-full bg-muted/60 flex flex-col items-center justify-center hover:bg-muted transition text-muted-foreground">
            <Camera size={26} className="text-muted-foreground/70" />
            <span className="text-xs mt-1.5 font-medium">เพิ่มรูปภาพ</span>
          </div>
        )}
      </label>

      {/* Input ซ่อนไว้ด้านหลังเหมือนเดิม */}
      <input
        id="upload-image"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onImageChange}
      />
    </div>
  );
}
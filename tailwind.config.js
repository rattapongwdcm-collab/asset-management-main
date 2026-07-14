/** @type {import('tailwindcss').Config} */
export default {
  // 🔧 แก้ปัญหา popup/dialog กลายเป็นสีดำบนมือถือที่เปิด dark mode:
  // ค่า default ของ Tailwind คือ 'media' ซึ่งจะสลับสีตามการตั้งค่าเครื่องผู้ใช้อัตโนมัติ
  // เปลี่ยนเป็น 'class' เพื่อให้เว็บเป็น light mode เสมอ จนกว่าจะมีการเพิ่ม class
  // "dark" ให้ <html> เอง (เช่น ตอนทำปุ่มสลับธีมในอนาคต)
  darkMode: 'class',

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 🔹 1. ชุดสีเดิมของโปรเจกต์คุณ (ยังเก็บไว้ใช้งานได้ปกติ)
        primary: '#1E2A3A',
        accent: '#0EA5E9',
        surface: '#FFFFFF',

        // 🔹 2. แมปชื่อสีพื้นฐานให้ดึงค่าจากตัวแปร CSS Variables (oklch) ใน index.css อัตโนมัติ
        // ช่วยแก้ปัญหาคลาส border-border หรือ background ของ shadcn หาไม่เจอ
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
}
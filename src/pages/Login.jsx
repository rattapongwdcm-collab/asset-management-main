import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ state สำหรับสลับไปหน้า "เปลี่ยนรหัสผ่าน"
  const [mode, setMode] = useState("login"); // 'login' | 'reset'

const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");
  setLoading(true);
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw authError;

    // ✅ สร้าง session token ใหม่ทุกครั้งที่ login สำเร็จ
    const sessionToken = crypto.randomUUID();
    localStorage.setItem('active_session_token', sessionToken);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ active_session: sessionToken })
      .eq('id', authData.user.id);
    if (updateError) throw updateError;

    window.location.href = "/";
  } catch (err) {
    setError(err.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  } finally {
    setLoading(false);
  }
};

  return (
    <AuthLayout
      icon={mode === "login" ? Lock : KeyRound}
      title={mode === "login" ? "เข้าสู่ระบบ" : "เปลี่ยนรหัสผ่าน"}
      subtitle="Asset Management System"
    >
      {mode === "login" ? (
        <>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : "เข้าสู่ระบบ"}
            </Button>

            {/* ✅ ลิงก์ไปหน้าเปลี่ยนรหัสผ่าน */}
            <button
              type="button"
              onClick={() => { setMode("reset"); setError(""); }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              ลืมรหัสผ่าน / ต้องการเปลี่ยนรหัสผ่าน?
            </button>
          </form>
        </>
      ) : (
        <ResetPasswordForm onBack={() => setMode("login")} />
      )}
    </AuthLayout>
  );
}

// ✅ ฟอร์มเปลี่ยนรหัสผ่าน — ยืนยันตัวตนด้วยอีเมล + รหัสผ่านเดิมก่อน แล้วค่อยตั้งรหัสผ่านใหม่
function ResetPasswordForm({ onBack }) {
  const [email, setEmail] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const MIN_LENGTH = 5; // ✅ รหัสผ่านใหม่ขั้นต่ำ 5 ตัวอักษร ตามที่ระบุ

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // ตรวจสอบข้อมูลก่อนส่ง
    if (!email.trim() || !oldPassword || !newPassword || !confirmPassword) {
      setError("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }
    if (newPassword.length < MIN_LENGTH) {
      setError(`รหัสผ่านใหม่ต้องมีอย่างน้อย ${MIN_LENGTH} ตัวอักษร`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านใหม่และรหัสยืนยันไม่ตรงกัน");
      return;
    }
    if (newPassword === oldPassword) {
      setError("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม");
      return;
    }

    setLoading(true);
    try {
      // 1. ยืนยันตัวตนด้วยรหัสผ่านเดิม (sign in ก่อนเพื่อเช็คว่ารหัสเดิมถูกต้องจริง)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: oldPassword,
      });
      if (signInError) {
        throw new Error("อีเมลหรือรหัสผ่านเดิมไม่ถูกต้อง");
      }

      // 2. อัปเดตรหัสผ่านใหม่
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      // 3. ออกจากระบบหลังเปลี่ยนสำเร็จ ให้ผู้ใช้ล็อกอินใหม่ด้วยรหัสผ่านใหม่เอง
      await supabase.auth.signOut();

      setSuccess(true);
    } catch (err) {
      setError(err.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4 py-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <p className="font-medium text-foreground">เปลี่ยนรหัสผ่านสำเร็จ</p>
          <p className="text-sm text-muted-foreground mt-1">กรุณาเข้าสู่ระบบอีกครั้งด้วยรหัสผ่านใหม่</p>
        </div>
        <Button onClick={onBack} className="w-full h-11">
          กลับไปหน้าเข้าสู่ระบบ
        </Button>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">อีเมล</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">รหัสผ่านเดิม</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="รหัสผ่านปัจจุบัน"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>

        <div className="border-t pt-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">รหัสผ่านใหม่ (อย่างน้อย {MIN_LENGTH} ตัวอักษร)</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10 h-12"
                required
                minLength={MIN_LENGTH}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">ยืนยันรหัสผ่านใหม่</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 h-12"
                required
                minLength={MIN_LENGTH}
              />
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              กำลังเปลี่ยนรหัสผ่าน...
            </>
          ) : "เปลี่ยนรหัสผ่าน"}
        </Button>

        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
        >
          <ArrowLeft size={12} />
          กลับไปหน้าเข้าสู่ระบบ
        </button>
      </form>
    </>
  );
}
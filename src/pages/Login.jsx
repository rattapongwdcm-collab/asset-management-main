import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

const MIN_PASSWORD_LENGTH = 5;

// ป้องกัน open redirect: ยอมรับเฉพาะ path ที่ขึ้นต้นด้วย "/" ตัวเดียว
// และไม่ใช่ "//..." (protocol-relative URL) หรือมี "://" ปนอยู่
// เช่น "/device?id=1" ผ่าน, "//evil.com" หรือ "https://evil.com" ไม่ผ่าน -> fallback เป็น "/"
function getSafeRedirect(redirectParam) {
  if (!redirectParam) return "/";
  if (!redirectParam.startsWith("/")) return "/";
  if (redirectParam.startsWith("//")) return "/";
  if (redirectParam.includes("://")) return "/";
  return redirectParam;
}

function IconInput({ icon: Icon, className = "", ...inputProps }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input className={`pl-10 h-11 sm:h-12 ${className}`} {...inputProps} />
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("login");
  const [searchParams] = useSearchParams();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const sessionToken = crypto.randomUUID();
      localStorage.setItem("active_session_token", sessionToken);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ active_session: sessionToken })
        .eq("id", authData.user.id);

      if (updateError) {
        await supabase.auth.signOut();
        throw updateError;
      }

      // พาไปปลายทางที่ตั้งใจไว้ (เช่น /device?id=xxx จาก QR code)
      // หรือหน้า default "/" ถ้าไม่มี redirect หรือ redirect ไม่ปลอดภัย
      const redirectTo = getSafeRedirect(searchParams.get("redirect"));
      window.location.href = redirectTo;
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
      subtitle="ระบบบริหารจัดการสินทรัพย์"
    >
      {mode === "login" ? (
        <>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <IconInput
              icon={Mail}
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="email@dcm.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <IconInput
              icon={Lock}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" className="w-full h-11 sm:h-12 font-medium" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                "เข้าสู่ระบบ"
              )}
            </Button>

            <button
              type="button"
              onClick={() => {
                setMode("reset");
                setError("");
              }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              ลืมรหัสผ่าน / ต้องการเปลี่ยนรหัสผ่าน?
            </button>
          </form>
        </>
      ) : (
        <ResetPasswordForm initialEmail={email} onBack={() => setMode("login")} />
      )}
    </AuthLayout>
  );
}

// ResetPasswordForm ไม่เกี่ยวข้องกับ redirect flow เลยเหมือนเดิมทุกบรรทัด ไม่ต้องแก้
function ResetPasswordForm({ initialEmail = "", onBack }) {
  const [email, setEmail] = useState(initialEmail);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !oldPassword || !newPassword || !confirmPassword) {
      setError("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`รหัสผ่านใหม่ต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: oldPassword,
      });
      if (signInError) {
        throw new Error("อีเมลหรือรหัสผ่านเดิมไม่ถูกต้อง");
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

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
        <Button onClick={onBack} className="w-full h-11 sm:h-12">
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

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">อีเมล</Label>
          <IconInput
            icon={Mail}
            type="email"
            autoComplete="email"
            autoFocus={!initialEmail}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">รหัสผ่านเดิม</Label>
          <IconInput
            icon={Lock}
            type="password"
            autoComplete="current-password"
            autoFocus={!!initialEmail}
            placeholder="รหัสผ่านปัจจุบัน"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
          />
        </div>

        <div className="border-t pt-4 space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              รหัสผ่านใหม่ (อย่างน้อย {MIN_PASSWORD_LENGTH} ตัวอักษร)
            </Label>
            <IconInput
              icon={KeyRound}
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">ยืนยันรหัสผ่านใหม่</Label>
            <IconInput
              icon={KeyRound}
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>
        </div>

        <Button type="submit" className="w-full h-11 sm:h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              กำลังเปลี่ยนรหัสผ่าน...
            </>
          ) : (
            "เปลี่ยนรหัสผ่าน"
          )}
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
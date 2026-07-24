import { createClient } from "https://esm.sh/@supabase/supabase-js@2";



const corsHeaders = {

  "Access-Control-Allow-Origin": "*",

  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",

};



Deno.serve(async (req) => {

  if (req.method === "OPTIONS") {

    return new Response("ok", { headers: corsHeaders });

  }



  try {

    // client ที่ใช้ token ของผู้เรียก เพื่อตรวจว่าคนเรียกเป็น admin จริง

    const authHeader = req.headers.get("Authorization")!;

    const callerClient = createClient(

      Deno.env.get("SUPABASE_URL")!,

      Deno.env.get("SUPABASE_ANON_KEY")!,

      { global: { headers: { Authorization: authHeader } } }

    );



    const { data: { user: callerUser }, error: authErr } = await callerClient.auth.getUser();

    if (authErr || !callerUser) {

      return new Response(JSON.stringify({ error: "ไม่ได้รับอนุญาต" }), { status: 401, headers: corsHeaders });

    }



    const { data: callerProfile } = await callerClient

      .from("profiles")

      .select("role")

      .eq("id", callerUser.id)

      .single();



    if (callerProfile?.role !== "admin") {

      return new Response(JSON.stringify({ error: "เฉพาะ Admin เท่านั้นที่สร้างบัญชีได้" }), { status: 403, headers: corsHeaders });

    }



    // client แบบ admin (service role) — ใช้แค่ในฟังก์ชันนี้ ไม่เคยส่งออกไป frontend

      const adminClient = createClient(

        Deno.env.get("SUPABASE_URL")!,

        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

      );



    const { email, password, role, full_name } = await req.json();



    if (!email || !password || password.length < 5) {

      return new Response(JSON.stringify({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง (รหัสผ่านต้องยาว 5 ตัวขึ้นไป)" }), { status: 400, headers: corsHeaders });

    }



    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({

      email,

      password,

      email_confirm: true, // ไม่ต้องรอ user กดยืนยันอีเมล

    });

    if (createErr) throw createErr;



    // อัปเดต profile ที่ trigger สร้างอัตโนมัติ (ถ้ามี) หรือ insert ใหม่

    const { error: profileErr } = await adminClient

      .from("profiles")

      .upsert({

        id: created.user.id,

        email,

        full_name: full_name || null,

        role: role === "admin" ? "admin" : "user",

      });

    if (profileErr) throw profileErr;



    return new Response(JSON.stringify({ success: true, user: created.user }), { headers: corsHeaders });

  } catch (err) {

    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });

  }

});
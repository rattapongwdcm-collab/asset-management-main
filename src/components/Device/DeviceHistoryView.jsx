import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { History, Clock } from 'lucide-react';

export default function DeviceHistoryView({ deviceId, searchTerm = "", isFullPage = false }) {
  const [historyLogs, setHistoryLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoadingHistory(true);
      
      let query = supabase
        .from('device_logs') 
        .select('*');

      if (deviceId) {
        query = query.eq('device_id', deviceId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching logs:', error.message);
      } else {
        setHistoryLogs(data || []);
        setFilteredLogs(data || []);
      }
      setLoadingHistory(false);
    };

    fetchLogs();
  }, [deviceId]);

  // 🔍 คอยดักจับการค้นหา Client-side (กรองรหัสอุปกรณ์ หรือรายละเอียดงาน)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredLogs(historyLogs);
      return;
    }

    const keyword = searchTerm.toLowerCase();
    const filtered = historyLogs.filter(log => {
      return (
        log.device_id?.toLowerCase().includes(keyword) ||
        log.details?.toLowerCase().includes(keyword) ||
        log.operator_name?.toLowerCase().includes(keyword) ||
        log.action_type?.toLowerCase().includes(keyword) ||
        log.changed_fields?.toLowerCase().includes(keyword)
      );
    });
    setFilteredLogs(filtered);
  }, [searchTerm, historyLogs]);

  // ฟังก์ชันแยกสีตาม Action ของ Log
  const getActionColor = (action) => {
    const act = action?.toUpperCase() || "";
    if (act.includes("เพิ่ม") || act.includes("CREATE")) return "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200";
    if (act.includes("ลบ") || act.includes("DELETE")) return "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200";
    return "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200";
  };

  const renderChangedFields = (fields) => {
    if (!fields) return null;
    let parsedFields = fields;
    if (typeof fields === 'string') {
      try {
        if (fields.trim().startsWith('{') || fields.trim().startsWith('[')) {
          parsedFields = JSON.parse(fields);
        }
      } catch (e) {
        parsedFields = fields;
      }
    }

    if (typeof parsedFields === 'object' && parsedFields !== null) {
      return (
        <div className="space-y-2 mt-2 w-full">
          {Object.entries(parsedFields).map(([key, value]) => (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-background/50 p-2 rounded-lg border text-xs w-full">
              <span className="font-semibold text-foreground/80 shrink-0 bg-muted px-2 py-0.5 rounded border sm:w-[25%] text-center font-mono truncate">
                {key}
              </span>
              <div className="flex items-center gap-2 flex-wrap pl-1 sm:pl-0 sm:w-[75%]">
                {value?.old !== undefined && (
                  <>
                    <span className="text-rose-600 dark:text-rose-400 line-through bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded truncate max-w-[45%]">{String(value.old)}</span>
                    <span className="text-muted-foreground font-mono">→</span>
                  </>
                )}
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded truncate max-w-[45%]">
                  {value?.new !== undefined ? String(value.new) : String(value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    const fieldLines = String(fields).split(/,|\n/).filter(Boolean);
    return (
      <div className="space-y-1 mt-2 w-full">
        {fieldLines.map((line, idx) => (
          <p key={idx} className="font-mono text-xs text-foreground/80 bg-background/50 p-2 rounded-lg flex items-start gap-2 border w-full">
            <span className="text-amber-500 shrink-0">▪</span>
            <span className="whitespace-pre-line breaking-words w-[95%]">{line.trim()}</span>
          </p>
        ))}
      </div>
    );
  };

  if (loadingHistory) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
        <p className="text-sm text-muted-foreground">กำลังดึงข้อมูลประวัติย้อนหลัง...</p>
      </div>
    );
  }

  if (filteredLogs.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground bg-muted/10 border border-dashed rounded-xl">
        <History size={36} className="mx-auto mb-2 opacity-30 text-muted-foreground" />
        <p className="text-sm">ไม่พบประวัติการทำรายการตามเงื่อนไขที่ค้นหา</p>
      </div>
    );
  }

  return (
    <div
      // 💡 ปรับให้หน้าประวัติรวมแสดงผลได้ยาวเต็มที่ขึ้น (max-h-[72vh]) ถ้าเปิดผ่าน HistoryPage
      className="overflow-y-auto pr-1 scrollbar-none"
      style={{ 
        maxHeight: isFullPage ? '72vh' : '58vh',
        scrollbarWidth: 'none', 
        msOverflowStyle: 'none' 
      }}
    >
      <style>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="relative border-l-2 border-muted pl-5 ml-4 space-y-6 my-3">
        {filteredLogs.map((log) => (
          <div key={log.id} className="relative animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="absolute -left-[27px] top-1 bg-background border-2 border-primary rounded-full w-3 h-3 shadow-sm z-10" />

            <div className="bg-background p-4 rounded-xl border shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold tracking-wide px-2.5 py-0.5 rounded-full border shadow-sm uppercase ${getActionColor(log.action_type)}`}>
                    {log.action_type || "EDITED"}
                  </span>
                  {/* 🏷️ เพิ่ม Badge แสดงรหัสอุปกรณ์ติดในแต่ละการ์ดประวัติด้วยเพื่อให้รู้ว่าเป็นของเครื่องไหนในหน้าประวัติรวม */}
                </div>
                <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Clock size={12} />
                  {log.created_at ? new Date(log.created_at).toLocaleString('th-TH', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  }) : "-"}
                </span>
              </div>

              <div className="text-xs space-y-3 mt-3">
                <div className="leading-relaxed">
                  <span className="text-muted-foreground font-medium">รายละเอียดงาน: </span>
                  <span className="text-foreground font-semibold break-words">{log.details || "ไม่มีข้อมูลรายละเอียดเพิ่มเติม"}</span>
                </div>

                {log.changed_fields && (
                  <div className="p-3 bg-muted/30 rounded-xl border border-dashed border-muted-foreground/15 w-full">
                    <p className="text-[11px] font-bold text-primary flex items-center gap-1">
                      <span>🔍 ข้อมูลการแก้ไขแอตทริบิวต์:</span>
                    </p>
                    {renderChangedFields(log.changed_fields)}
                  </div>
                )}
              </div>

              <div className="text-[11px] pt-2 mt-3 border-t border-dashed text-muted-foreground flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span>เจ้าหน้าที่ผู้จัดการ:</span>
                  <span className="font-semibold text-foreground bg-muted/60 border rounded px-2 py-0.5 shadow-sm">
                    👤 {log.operator_name || log.user_email || "System"}
                  </span>
                </div>
                {log.user_role && (
                  <span className="text-[9px] font-extrabold tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded border uppercase">
                    {log.user_role}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
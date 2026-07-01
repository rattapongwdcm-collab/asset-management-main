import { Button } from '@/components/ui/button';
import { PackagePlus } from 'lucide-react';

export default function BorrowAction({ device, onBorrowRequest }) {
  // เงื่อนไขการ Disable: เครื่องถูกยืมอยู่, รออนุมัติ, หรือกำลังซ่อม
  const isUnavailable = device.status !== 'ว่าง';

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      disabled={isUnavailable}
      onClick={() => onBorrowRequest(device)}
    >
      <PackagePlus 
        size={14} 
        className={isUnavailable ? 'opacity-30 cursor-not-allowed' : 'text-blue-600'} 
      />
    </Button>
  );
}
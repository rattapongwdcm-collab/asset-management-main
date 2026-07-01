import { Button } from '@/components/ui/button';
import { Wrench } from 'lucide-react';

export default function RepairAction({ device, onRequestRepair }) {
  const isPending = device.status === 'กำลังซ่อม' || device.status === 'รออนุมัติซ่อม';

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      disabled={isPending}
      onClick={() => onRequestRepair(device)}
    >
      <Wrench 
        size={14} 
        className={isPending ? 'opacity-30 cursor-not-allowed' : 'text-foreground/70'} 
      />
    </Button>
  );
}
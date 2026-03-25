import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

interface EditableCellProps {
  value: string | number | boolean | null;
  onChange: (value: any) => void;
  type?: 'text' | 'checkbox' | 'select';
  options?: { value: string; label: string }[];
  className?: string;
  disabled?: boolean;
}

export default function EditableCell({ value, onChange, type = 'text', options, className, disabled }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(value ?? ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(String(value ?? ''));
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  if (type === 'checkbox') {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <Checkbox
          checked={!!value}
          onCheckedChange={v => onChange(v)}
          disabled={disabled}
        />
      </div>
    );
  }

  if (type === 'select' && options) {
    return (
      <Select value={String(value ?? '')} onValueChange={v => onChange(v)} disabled={disabled}>
        <SelectTrigger className={cn('h-7 text-xs border-0 bg-transparent shadow-none px-1 font-body', className)}>
          <SelectValue placeholder="–" />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (localValue !== String(value ?? '')) onChange(localValue);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            setEditing(false);
            if (localValue !== String(value ?? '')) onChange(localValue);
          }
          if (e.key === 'Escape') {
            setEditing(false);
            setLocalValue(String(value ?? ''));
          }
        }}
        className={cn('h-7 text-xs border-0 bg-transparent shadow-none px-1 rounded-none focus-visible:ring-1 focus-visible:ring-primary font-body', className)}
        disabled={disabled}
      />
    );
  }

  return (
    <div
      onClick={() => !disabled && setEditing(true)}
      className={cn(
        'px-1 py-1 text-xs cursor-pointer min-h-[28px] flex items-center truncate font-body hover:bg-primary/5 rounded-sm transition-colors',
        disabled && 'cursor-default opacity-60',
        className
      )}
      title={String(value ?? '')}
    >
      {value != null && String(value) !== '' ? String(value) : <span className="text-muted-foreground/40">–</span>}
    </div>
  );
}

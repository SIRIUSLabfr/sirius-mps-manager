import { useState, useEffect, useRef } from 'react';
import { format, parse, isValid } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateInputProps {
  /** Date value as Date object */
  value?: Date;
  /** Called with new Date or undefined when cleared */
  onChange: (date: Date | undefined) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional className for the wrapper */
  className?: string;
  /** Size variant */
  size?: 'default' | 'sm';
  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * Combined date input: manual text entry (DD.MM.YYYY) + calendar picker.
 * Supports typing digits directly and selecting from calendar popup.
 */
export function DateInput({
  value,
  onChange,
  placeholder = 'TT.MM.JJJJ',
  className,
  size = 'default',
  disabled,
}: DateInputProps) {
  const [textValue, setTextValue] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync text from value prop
  useEffect(() => {
    if (value && isValid(value)) {
      setTextValue(format(value, 'dd.MM.yyyy'));
    } else {
      setTextValue('');
    }
  }, [value]);

  const handleTextChange = (raw: string) => {
    // Auto-format: insert dots after DD and MM
    let digits = raw.replace(/[^\d]/g, '');
    if (digits.length > 8) digits = digits.slice(0, 8);

    let formatted = '';
    for (let i = 0; i < digits.length; i++) {
      if (i === 2 || i === 4) formatted += '.';
      formatted += digits[i];
    }
    setTextValue(formatted);

    // Try to parse complete date
    if (digits.length === 8) {
      const parsed = parse(formatted, 'dd.MM.yyyy', new Date());
      if (isValid(parsed) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
        onChange(parsed);
      }
    }
  };

  const handleBlur = () => {
    if (!textValue) {
      onChange(undefined);
      return;
    }
    const parsed = parse(textValue, 'dd.MM.yyyy', new Date());
    if (isValid(parsed) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
      onChange(parsed);
    } else {
      // Reset to current value
      if (value && isValid(value)) {
        setTextValue(format(value, 'dd.MM.yyyy'));
      } else {
        setTextValue('');
      }
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    onChange(date);
    setOpen(false);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
    setTextValue('');
  };

  const isSmall = size === 'sm';

  return (
    <div className={cn('flex items-center gap-0 relative', className)}>
      <Input
        ref={inputRef}
        value={textValue}
        onChange={e => handleTextChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            handleBlur();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'pr-16 font-body',
          isSmall ? 'h-8 text-sm' : 'h-9 text-sm',
        )}
      />
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        {textValue && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={clear}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleCalendarSelect}
              locale={de}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

/**
 * DateInput that works with string values (yyyy-MM-dd format, e.g. from DB).
 */
interface DateInputStringProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  size?: 'default' | 'sm';
  disabled?: boolean;
}

export function DateInputString({
  value,
  onChange,
  ...rest
}: DateInputStringProps) {
  const dateValue = value ? new Date(value) : undefined;
  const validDate = dateValue && isValid(dateValue) ? dateValue : undefined;

  return (
    <DateInput
      value={validDate}
      onChange={d => onChange(d ? format(d, 'yyyy-MM-dd') : null)}
      {...rest}
    />
  );
}

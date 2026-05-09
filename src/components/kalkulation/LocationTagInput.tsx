import { useState, useRef, KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Komma-separierter Wert (kompatibel mit DeviceGroup.label string) */
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}

const splitTags = (s: string): string[] =>
  s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

const joinTags = (tags: string[]): string => tags.join(', ');

/**
 * Tag-Input à la Mail-Empfänger: Enter / Komma fügt einen Tag hinzu,
 * Backspace im leeren Eingabefeld entfernt den letzten Tag, X-Button
 * pro Tag löscht ihn. Speichert intern weiterhin als komma-separierten
 * String, damit das DeviceGroup.label-Schema unverändert bleibt.
 */
export default function LocationTagInput({
  value,
  onChange,
  placeholder,
  className,
}: Props) {
  const tags = splitTags(value);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commitDraft = () => {
    const t = draft.trim();
    if (!t) return;
    if (tags.includes(t)) {
      setDraft('');
      return;
    }
    onChange(joinTags([...tags, t]));
    setDraft('');
  };

  const removeTag = (idx: number) => {
    onChange(joinTags(tags.filter((_, i) => i !== idx)));
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      e.preventDefault();
      removeTag(tags.length - 1);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 min-h-9 px-2 py-1 rounded-md border-0 border-b border-border focus-within:border-primary cursor-text',
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((t, i) => (
        <Badge
          key={`${t}-${i}`}
          variant="secondary"
          className="h-6 text-xs font-medium gap-1 pl-2 pr-1"
        >
          {t}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(i);
            }}
            className="hover:text-destructive p-0.5 rounded"
            aria-label={`${t} entfernen`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={commitDraft}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[60px] outline-none bg-transparent text-sm h-7"
      />
    </div>
  );
}

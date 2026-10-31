import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  /** called when a suggestion is clicked (after onChange) */
  onPick?: (value: string) => void;
  onBlur?: (value: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
};

/** Free-text input with a themed, scrollable suggestion list (replaces native datalists). */
export function SuggestInput({ value, onChange, options, onPick, onBlur, onKeyDown, className, placeholder, autoFocus }: Props) {
  const [open, setOpen] = useState(!!autoFocus);
  const [active, setActive] = useState(-1);
  const matches = useMemo(() => {
    const q = value.trim().toUpperCase();
    const uniq = [...new Set(options.filter(Boolean))];
    return q ? uniq.filter((o) => o.toUpperCase().includes(q)) : uniq;
  }, [options, value]);

  const pick = (o: string) => {
    onChange(o);
    setOpen(false);
    setActive(-1);
    onPick?.(o);
  };

  return (
    <Popover open={open && matches.length > 0}>
      <PopoverAnchor asChild>
        <Input
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder}
          className={cn("uppercase", className)}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value.toUpperCase());
            setOpen(true);
            setActive(-1);
          }}
          onBlur={(e) => {
            setOpen(false);
            onBlur?.(e.target.value.toUpperCase());
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, matches.length - 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
              return;
            }
            if (e.key === "Enter" && open && active >= 0 && matches[active]) {
              e.preventDefault();
              pick(matches[active]);
              return;
            }
            if (e.key === "Escape") setOpen(false);
            onKeyDown?.(e);
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-40 p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onWheel={(e) => e.stopPropagation()}
      >
        <ul className="max-h-60 overflow-y-auto overscroll-contain" role="listbox">
          {matches.map((o, i) => (
            <li
              key={o}
              role="option"
              aria-selected={i === active}
              className={cn(
                "num cursor-pointer rounded-sm px-2 py-1.5 text-xs hover:bg-muted",
                i === active && "bg-muted",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
            >
              {o}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

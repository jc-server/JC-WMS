import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export type SelectOption = string | { value: string; label: string };

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
}: {
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getLabel = (val: string) => {
    if (val === '' || val === undefined || val === null) {
      return placeholder;
    }
    const opt = options.find((o) =>
      typeof o === 'string' ? o === val : o.value === val
    );
    if (!opt) return placeholder;
    return typeof opt === 'string' ? opt : opt.label;
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all text-sm text-left disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`truncate ${!value ? 'text-slate-400 dark:text-slate-500' : ''}`}>
          {getLabel(value)}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ml-2 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1">
          {options.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              No options
            </div>
          )}
          {options.map((opt) => {
            const optVal = typeof opt === 'string' ? opt : opt.value;
            const optLabel = typeof opt === 'string' ? opt : opt.label;
            return (
              <button
                key={optVal}
                type="button"
                onClick={() => {
                  onChange(optVal);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                  value === optVal
                    ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-semibold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-700/50'
                }`}
              >
                <span className="truncate">{optLabel}</span>
                {value === optVal && <Check className="w-4 h-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
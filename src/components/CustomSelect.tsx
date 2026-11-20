import { useState, useEffect, useRef, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export type SelectOption = string | { value: string; label: string };

const getOptionValue = (o: SelectOption): string => (typeof o === 'string' ? o : o.value);
const getOptionLabel = (o: SelectOption): string => (typeof o === 'string' ? o : o.label);

type Position = { top: number; left: number; width: number; maxHeight: number };

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  ariaLabel,
}: {
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Accessible name for the combobox and its listbox. Pass this when the
   *  surrounding <label> isn't associated via htmlFor/id. */
  ariaLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0, width: 0, maxHeight: 240 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const getLabel = (val: string) => {
    if (!val) return placeholder;
    const opt = options.find((o) => getOptionValue(o) === val);
    return opt ? getOptionLabel(opt) : placeholder;
  };

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 4;
    const maxHeight = 240;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openUpward = spaceBelow < maxHeight && spaceAbove > spaceBelow;
    const availableHeight = Math.min(maxHeight, openUpward ? spaceAbove : spaceBelow);
    setPosition({
      top: openUpward ? rect.top - availableHeight - margin : rect.bottom + margin,
      left: rect.left,
      width: rect.width,
      maxHeight: availableHeight,
    });
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Reposition on scroll / resize while open.
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Reset / initialize highlighted index.
  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex((o) => getOptionValue(o) === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [isOpen, options, value]);

  const selectOption = (idx: number) => {
    if (idx < 0 || idx >= options.length) return;
    onChange(getOptionValue(options[idx]));
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setHighlightedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setHighlightedIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        selectOption(highlightedIndex);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  // Scroll highlighted option into view.
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !dropdownRef.current) return;
    const el = dropdownRef.current.querySelector(
      `[data-option-index="${highlightedIndex}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  const dropdown =
    isOpen &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={dropdownRef}
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel}
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          width: position.width,
          maxHeight: position.maxHeight,
        }}
        className="z-[100] overflow-y-auto bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl py-1"
      >
        {options.length === 0 && (
          <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
            No options
          </div>
        )}
        {options.map((opt, idx) => {
          const optVal = getOptionValue(opt);
          const optLabel = getOptionLabel(opt);
          const isSelected = value === optVal;
          const isHighlighted = highlightedIndex === idx;
          return (
            <button
              // Composite key: option *value* alone can collide if the source
              // list somehow contains duplicates (e.g. a bad settings write),
              // which React would log as a key-collision warning.
              key={`${idx}-${optVal}`}
              type="button"
              role="option"
              id={`${listboxId}-opt-${idx}`}
              aria-selected={isSelected}
              data-option-index={idx}
              onMouseEnter={() => setHighlightedIndex(idx)}
              onClick={() => selectOption(idx)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                isSelected
                  ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-semibold'
                  : isHighlighted
                  ? 'bg-slate-50 dark:bg-zinc-700/50 text-slate-700 dark:text-slate-200'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              <span className="truncate">{optLabel}</span>
              {isSelected && <Check className="w-4 h-4 shrink-0" />}
            </button>
          );
        })}
      </div>,
      document.body
    );

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-activedescendant={
          isOpen && highlightedIndex >= 0 ? `${listboxId}-opt-${highlightedIndex}` : undefined
        }
        disabled={disabled}
        onClick={() => setIsOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all text-sm text-left disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`truncate ${!value ? 'text-slate-400 dark:text-slate-500' : ''}`}>
          {getLabel(value)}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ml-2 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>
      {dropdown}
    </div>
  );
}
import React, { useEffect, useMemo, useRef, useState } from 'react';

export type ColorChoice = 'green' | 'red' | 'far red' | 'far-red' | 'farred';

export interface ImmunoFormValue {
  slides: number;
  primaries: string[];
  colors: ColorChoice[];
}

interface ImmunoSectionProps {
  index: number;
  value: ImmunoFormValue;
  onChange: (next: ImmunoFormValue) => void;
  onRemove: () => void;
}

const COLORS: ColorChoice[] = ['green', 'red', 'far red'];

function clampSlides(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export default function ImmunoSection(props: ImmunoSectionProps): JSX.Element {
  const { index, value, onChange, onRemove } = props;
  const [queryByPrimaryIndex, setQueryByPrimaryIndex] = useState<Record<number, string>>({});
  const [suggestionsByPrimaryIndex, setSuggestionsByPrimaryIndex] = useState<Record<number, string[]>>({});
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const activeItemIndexRef = useRef<number>(-1);

  // Debounced suggest fetch per primary input
  useEffect(() => {
    const controllers: AbortController[] = [];
    const timers: number[] = [];
    Object.entries(queryByPrimaryIndex).forEach(([k, q]) => {
      const primaryIdx = Number(k);
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setSuggestionsByPrimaryIndex(prev => ({ ...prev, [primaryIdx]: [] }));
        return;
      }
      const controller = new AbortController();
      controllers.push(controller);
      const timer = window.setTimeout(async () => {
        try {
          const res = await fetch(`/api/suggest/targets?q=${encodeURIComponent(trimmed)}`, {
            signal: controller.signal
          });
          if (!res.ok) throw new Error(`Suggest HTTP ${res.status}`);
          const data = await res.json();
          const suggestions = Array.isArray(data?.suggestions) ? data.suggestions as string[] : [];
          setSuggestionsByPrimaryIndex(prev => ({ ...prev, [primaryIdx]: suggestions.slice(0, 8) }));
        } catch (err) {
          // Non-fatal during early UI bring-up
          // eslint-disable-next-line no-console
          console.warn('Suggest error', err);
        }
      }, 200);
      timers.push(timer);
    });
    return () => {
      controllers.forEach(c => c.abort());
      timers.forEach(t => window.clearTimeout(t));
    };
  }, [queryByPrimaryIndex]);

  const canAddPrimary = value.primaries.length < 3;

  function updateSlides(next: number): void {
    onChange({ ...value, slides: clampSlides(next) });
  }

  function updatePrimary(i: number, next: string): void {
    const primaries = value.primaries.slice();
    primaries[i] = next;
    onChange({ ...value, primaries });
  }

  function updateColor(i: number, next: ColorChoice): void {
    const colors = value.colors.slice();
    colors[i] = next;
    onChange({ ...value, colors });
  }

  function addPrimary(): void {
    if (!canAddPrimary) return;
    onChange({ ...value, primaries: [...value.primaries, ''], colors: [...value.colors, 'green'] });
  }

  function removePrimary(i: number): void {
    const primaries = value.primaries.slice();
    const colors = value.colors.slice();
    primaries.splice(i, 1);
    colors.splice(i, 1);
    onChange({ ...value, primaries, colors });
  }

  function handlePickSuggestion(i: number, suggestion: string): void {
    updatePrimary(i, suggestion);
    setOpenMenuIndex(null);
    setSuggestionsByPrimaryIndex(prev => ({ ...prev, [i]: [] }));
  }

  const sectionLabelId = useMemo(() => `immuno-${index}-label`, [index]);

  return (
    <section className="card immuno-section" aria-labelledby={sectionLabelId}>
      <div className="section-header">
        <h2 id={sectionLabelId}>Immuno {index + 1}</h2>
        <button type="button" className="ghost" onClick={onRemove} aria-label={`Remove Immuno ${index + 1}`}>
          Remove
        </button>
      </div>
      <div className="immuno-grid">
        <div className="field">
          <label htmlFor={`slides-${index}`}>Slides</label>
          <input
            id={`slides-${index}`}
            name={`slides-${index}`}
            type="number"
            min={1}
            inputMode="numeric"
            value={value.slides}
            onChange={(e) => updateSlides(Number(e.target.value))}
          />
        </div>

        {value.primaries.map((p, i) => {
          const inputId = `primary-${index}-${i}`;
          const colorId = `color-${index}-${i}`;
          const menuId = `menu-${index}-${i}`;
          const suggestions = suggestionsByPrimaryIndex[i] || [];
          return (
            <div key={i} className="primary-row">
              <div className="field grow">
                <label htmlFor={inputId}>Primary {i + 1}</label>
                <div className="combo">
                  <input
                    id={inputId}
                    role="combobox"
                    aria-expanded={openMenuIndex === i}
                    aria-controls={menuId}
                    aria-autocomplete="list"
                    autoComplete="off"
                    type="text"
                    value={p}
                    onChange={(e) => {
                      updatePrimary(i, e.target.value);
                      setQueryByPrimaryIndex(prev => ({ ...prev, [i]: e.target.value }));
                      setOpenMenuIndex(i);
                    }}
                    onFocus={() => setOpenMenuIndex(i)}
                    onKeyDown={(e) => {
                      if (!suggestions.length) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        activeItemIndexRef.current = Math.min(activeItemIndexRef.current + 1, suggestions.length - 1);
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        activeItemIndexRef.current = Math.max(activeItemIndexRef.current - 1, 0);
                      } else if (e.key === 'Enter') {
                        if (activeItemIndexRef.current >= 0) {
                          e.preventDefault();
                          handlePickSuggestion(i, suggestions[activeItemIndexRef.current]);
                        }
                      } else if (e.key === 'Escape') {
                        setOpenMenuIndex(null);
                      }
                    }}
                  />
                  {p && (
                    <button
                      type="button"
                      className="ghost"
                      aria-label={`Clear primary ${i + 1}`}
                      onClick={() => {
                        updatePrimary(i, '');
                        setSuggestionsByPrimaryIndex(prev => ({ ...prev, [i]: [] }));
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {openMenuIndex === i && suggestions.length > 0 && (
                  <ul id={menuId} role="listbox" className="suggest-menu" onMouseLeave={() => (activeItemIndexRef.current = -1)}>
                    {suggestions.map((s, idx) => (
                      <li
                        key={s}
                        role="option"
                        aria-selected={activeItemIndexRef.current === idx}
                        className={activeItemIndexRef.current === idx ? 'active' : ''}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handlePickSuggestion(i, s);
                        }}
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="field">
                <label htmlFor={colorId}>Color</label>
                <select
                  id={colorId}
                  value={value.colors[i] || 'green'}
                  onChange={(e) => updateColor(i, e.target.value as ColorChoice)}
                >
                  {COLORS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="sr-only">Actions</label>
                <button type="button" className="ghost" onClick={() => removePrimary(i)} aria-label={`Remove primary ${i + 1}`}>
                  Remove
                </button>
              </div>
            </div>
          );
        })}

        <div className="field">
          <button type="button" onClick={addPrimary} disabled={!canAddPrimary}>
            Add primary
          </button>
        </div>
      </div>
    </section>
  );
}



import React, { useMemo, useState } from 'react';
import ImmunoSection, { ImmunoFormValue } from './components/ImmunoSection';
import { Tables } from './components/Tables';

function App(): JSX.Element {
  const [immunos, setImmunos] = useState<ImmunoFormValue[]>([
    { slides: 1, primaries: [''], colors: ['green'] }
  ]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    primariesTable: any[][];
    secondariesTable: any[][];
    solutions: any[];
  } | null>(null);

  function addImmuno(): void {
    setImmunos(prev => [...prev, { slides: 1, primaries: [''], colors: ['green'] }]);
  }
  function removeImmuno(i: number): void {
    setImmunos(prev => prev.filter((_, idx) => idx !== i));
  }
  function updateImmuno(i: number, next: ImmunoFormValue): void {
    setImmunos(prev => prev.map((it, idx) => (idx === i ? next : it)));
  }

  const isFormValid = useMemo(() => {
    const issues: string[] = [];
    if (immunos.length < 1) issues.push('At least one immuno required.');
    immunos.forEach((im, idx) => {
      if (!Number.isFinite(im.slides) || im.slides < 1) {
        issues.push(`Immuno ${idx + 1}: slides must be ≥ 1.`);
      }
      if (im.primaries.length > 3) {
        issues.push(`Immuno ${idx + 1}: at most 3 primaries.`);
      }
      if (im.primaries.some((_, i) => !im.colors[i])) {
        issues.push(`Immuno ${idx + 1}: color required per primary.`);
      }
    });
    setWarnings(issues);
    return issues.length === 0;
  }, [immunos]);

  async function onComputePlan(): Promise<void> {
    if (!isFormValid) {
      // eslint-disable-next-line no-console
      console.warn('Invalid form; refusing to submit.', warnings);
      return;
    }
    try {
      setIsSubmitting(true);
      const payload = {
        immunos: immunos.map(im => ({
          slides: im.slides,
          primaries: im.primaries.filter(p => p && p.trim().length > 0),
          colors: im.colors.slice(0, im.primaries.length)
        }))
      };
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Compute plan failed', err);
      setWarnings(prev => [...prev, String(err)]);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <header>
        <h1>IHC Helper</h1>
      </header>
      <main>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onComputePlan();
          }}
        >
          {immunos.map((im, idx) => (
            <ImmunoSection
              key={idx}
              index={idx}
              value={im}
              onChange={(next) => updateImmuno(idx, next)}
              onRemove={() => removeImmuno(idx)}
            />
          ))}
          <div className="row">
            <button type="button" onClick={addImmuno}>Add immuno</button>
            <button type="submit" disabled={isSubmitting}>Compute plan</button>
          </div>
        </form>

        {warnings.length > 0 && (
          <div className="card warn" role="status" aria-live="polite">
            <strong>Warnings</strong>
            <ul>
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        {result && (
          <Tables
            primariesTable={result.primariesTable}
            secondariesTable={result.secondariesTable}
            solutions={result.solutions}
          />
        )}
      </main>
    </div>
  );
}

export default App;



import React, { useEffect, useMemo, useState } from 'react';
import ImmunoSection, { ImmunoFormValue } from './components/ImmunoSection';
import { Tables } from './components/Tables';

function App(): JSX.Element {
  const [immunos, setImmunos] = useState<ImmunoFormValue[]>([
    { slides: 1, primaries: [''], colors: ['green'] }
  ]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; kind: 'info' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    primariesTable: Array<Array<{ name: string; igClass?: string | null; dilution?: string | null; location?: string | null } | null>>;
    secondariesTable: Array<Array<{ name: string; host?: string | null; igSpecificity?: string | null; emission_nm?: number | null; location?: string | null } | null>>;
    solutions: Array<{
      immunoLabel: string;
      blocking: { total_mL: number; components: { label: string; volume_mL: number }[] };
      primary: { total_mL: number; antibodies: { label: string; stock_uL: number }[]; diluent: { blocking_mL: number; pbst_mL: number } };
      secondary: { total_mL: number; antibodies: { label: string; stock_uL: number }[]; pbst_mL: number };
    }>;
  } | null>(null);

  // Load persisted form on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ihc:lastInput');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.immunos)) return;
      const next = parsed.immunos
        .map((im: any) => ({
          slides: Number(im.slides) > 0 ? Math.floor(Number(im.slides)) : 1,
          primaries: Array.isArray(im.primaries) ? im.primaries.slice(0, 3).map((s: any) => String(s ?? '')) : [''],
          colors: Array.isArray(im.colors) ? im.colors.slice(0, 3) : ['green']
        }))
        .slice(0, 10);
      if (next.length > 0) setImmunos(next as ImmunoFormValue[]);
    } catch {
      // ignore
    }
  }, []);

  // Persist form on change
  useEffect(() => {
    try {
      localStorage.setItem('ihc:lastInput', JSON.stringify({ immunos }));
    } catch {
      // ignore
    }
  }, [immunos]);

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
      setToast({ message: 'Please fix form warnings before submitting.', kind: 'error' });
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
      const t0 = performance.now();
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
      // eslint-disable-next-line no-console
      console.log('[plan] request', payload);
      // Transform server response into UI-friendly shapes
      const ui = transformResponseToUI(data);
      setResult(ui);
      if (Array.isArray(data?.warnings) && data.warnings.length) {
        setWarnings(prev => [...prev, ...data.warnings]);
      }
      const t1 = performance.now();
      // eslint-disable-next-line no-console
      console.log(`[plan] response in ${(t1 - t0).toFixed(0)}ms`, data);
      setToast({ message: 'Plan computed successfully.', kind: 'info' });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Compute plan failed', err);
      setWarnings(prev => [...prev, String(err)]);
      setToast({ message: 'Failed to compute plan. See console and warnings.', kind: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function transformResponseToUI(data: any) {
    const primRows = (data?.primariesTable || []).map((row: any) => {
      const cells = Array.isArray(row?.cells) ? row.cells : [];
      return [0, 1, 2].map((i) => {
        const c = cells[i];
        if (!c) return null;
        const location = [c.storage_sheet, c.location].filter(Boolean).join(', ');
        return {
          name: c.name || 'N/A',
          igClass: c.ig_class || null,
          dilution: c.recommended_dilution || '1:1000',
          location: location || null
        };
      });
    });

    const secRows = (data?.secondariesTable || []).map((row: any) => {
      const cells = Array.isArray(row?.cells) ? row.cells : [];
      return [0, 1, 2].map((i) => {
        const c = cells[i];
        if (!c) return null;
        const location = [c.storage_sheet, c.location].filter(Boolean).join(', ');
        return {
          name: c.name || 'N/A',
          host: c.host_species || null,
          igSpecificity: c.ig_class || null,
          emission_nm: Number.isFinite(Number(c.emission_nm)) ? Number(c.emission_nm) : null,
          location: location || null
        };
      });
    });

    const solRows = (data?.solutions || []).map((s: any, idx: number) => {
      const blockingTotal_mL = Number(s?.blocking?.total_mL) || 0;
      const blockingComponents = [
        ...((s?.blocking?.serum || []).map((ser: any) => ({
          label: `Serum (${ser.host})`,
          volume_mL: ((Number(ser.volume_uL) || 0) / 1000)
        }))),
        { label: 'PBST + 0.01% BSA', volume_mL: ((Number(s?.blocking?.diluent_uL) || 0) / 1000) }
      ];
      const primary = {
        total_mL: Number(s?.primary?.total_mL) || 0,
        antibodies: ((s?.primary?.primaries || []) as any[]).map(p => ({ label: p.name || 'Primary', stock_uL: Number(p.volume_uL) || 0 })),
        diluent: {
          blocking_mL: ((Number(s?.primary?.blocking_uL) || 0) / 1000),
          pbst_mL: ((Number(s?.primary?.pbst_uL) || 0) / 1000)
        }
      };
      const secondary = {
        total_mL: Number(s?.secondary?.total_mL) || 0,
        antibodies: ((s?.secondary?.secondaries || []) as any[]).map(p => ({ label: p.name || 'Secondary', stock_uL: Number(p.volume_uL) || 0 })),
        pbst_mL: ((Number(s?.secondary?.pbst_uL) || 0) / 1000)
      };
      return {
        immunoLabel: `Immuno ${idx + 1}`,
        blocking: { total_mL: blockingTotal_mL, components: blockingComponents },
        primary,
        secondary
      };
    });

    return { primariesTable: primRows, secondariesTable: secRows, solutions: solRows };
  }

  return (
    <div className="app-shell">
      <header>
        <h1>IHC Helper</h1>
      </header>
      <main>
        {toast && (
          <div className={`toast ${toast.kind}`} role="status" aria-live="polite">
            {toast.message}
          </div>
        )}
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



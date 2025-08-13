import React from 'react';

export interface PrimariesTableCell {
  name: string;
  igClass?: string | null;
  dilution?: string | null;
  location?: string | null;
}

export interface SecondariesTableCell {
  name: string;
  host?: string | null;
  igSpecificity?: string | null;
  emission_nm?: number | null;
  location?: string | null;
}

export interface SolutionsBreakdown {
  immunoLabel: string;
  blocking: {
    total_mL: number;
    components: { label: string; volume_mL: number }[];
  };
  primary: {
    total_mL: number;
    antibodies: { label: string; stock_uL: number }[];
    diluent: { blocking_mL: number; pbst_mL: number };
  };
  secondary: {
    total_mL: number;
    antibodies: { label: string; stock_uL: number }[];
    pbst_mL: number;
  };
}

interface TablesProps {
  primariesTable: Array<Array<PrimariesTableCell | null>>; // rows by immuno, 3 columns max
  secondariesTable: Array<Array<SecondariesTableCell | null>>;
  solutions: SolutionsBreakdown[];
}

export function Tables(props: TablesProps): JSX.Element {
  const { primariesTable, secondariesTable, solutions } = props;

  function download(filename: string, text: string): void {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function escapeCsv(value: unknown): string {
    const s = value == null ? '' : String(value);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function handleExportPrimaries(): void {
    const headers = [
      'Immuno #',
      'Ab1 Name','Ab1 Ig','Ab1 Dilution','Ab1 Location',
      'Ab2 Name','Ab2 Ig','Ab2 Dilution','Ab2 Location',
      'Ab3 Name','Ab3 Ig','Ab3 Dilution','Ab3 Location'
    ];
    const rows = primariesTable.map((row, rIdx) => {
      const cells = [0,1,2].map(c => row[c]);
      const parts = [String(rIdx + 1)];
      cells.forEach((cell) => {
        parts.push(
          escapeCsv(cell?.name || 'N/A'),
          escapeCsv(cell?.igClass || ''),
          escapeCsv(cell?.dilution || ''),
          escapeCsv(cell?.location || '')
        );
      });
      return parts.join(',');
    });
    download('primaries.csv', [headers.join(','), ...rows].join('\n'));
  }

  function handleExportSecondaries(): void {
    const headers = [
      'Immuno #',
      'Ab1 Name','Ab1 Host','Ab1 Ig','Ab1 Emission (nm)','Ab1 Location',
      'Ab2 Name','Ab2 Host','Ab2 Ig','Ab2 Emission (nm)','Ab2 Location',
      'Ab3 Name','Ab3 Host','Ab3 Ig','Ab3 Emission (nm)','Ab3 Location'
    ];
    const rows = secondariesTable.map((row, rIdx) => {
      const cells = [0,1,2].map(c => row[c]);
      const parts = [String(rIdx + 1)];
      cells.forEach((cell) => {
        parts.push(
          escapeCsv(cell?.name || 'N/A'),
          escapeCsv(cell?.host || ''),
          escapeCsv(cell?.igSpecificity || ''),
          escapeCsv(cell?.emission_nm ?? ''),
          escapeCsv(cell?.location || '')
        );
      });
      return parts.join(',');
    });
    download('secondaries.csv', [headers.join(','), ...rows].join('\n'));
  }

  function handleExportSolutions(): void {
    const headers = [
      'Immuno #',
      'Blocking Total (mL)','Serum1 Host','Serum1 (mL)','Serum2 Host','Serum2 (mL)','PBST+BSA (mL)',
      'Primary Total (mL)','Primary Ab1 (µL)','Primary Ab2 (µL)','Primary Ab3 (µL)','Primary Diluent Block (mL)','Primary Diluent PBST (mL)',
      'Secondary Total (mL)','Secondary Ab1 (µL)','Secondary Ab2 (µL)','Secondary Ab3 (µL)','Secondary PBST (mL)'
    ];
    const rows = solutions.map((s, rIdx) => {
      const serumOnly = s.blocking.components.filter(c => /^Serum \(/.test(c.label));
      const pbst = s.blocking.components.find(c => /PBST/.test(c.label));
      const serum1 = serumOnly[0];
      const serum2 = serumOnly[1];
      const primAb = s.primary.antibodies;
      const secAb = s.secondary.antibodies;
      const parts: (string)[] = [String(rIdx + 1)];
      parts.push(
        escapeCsv(s.blocking.total_mL.toFixed(2)),
        escapeCsv(serum1 ? serum1.label.replace(/^Serum \((.*)\)$/,'$1') : ''),
        escapeCsv(serum1 ? serum1.volume_mL.toFixed(2) : ''),
        escapeCsv(serum2 ? serum2.label.replace(/^Serum \((.*)\)$/,'$1') : ''),
        escapeCsv(serum2 ? serum2.volume_mL.toFixed(2) : ''),
        escapeCsv(pbst ? pbst.volume_mL.toFixed(2) : '')
      );
      parts.push(
        escapeCsv(s.primary.total_mL.toFixed(2)),
        escapeCsv(primAb[0]?.stock_uL.toFixed(1) || ''),
        escapeCsv(primAb[1]?.stock_uL.toFixed(1) || ''),
        escapeCsv(primAb[2]?.stock_uL.toFixed(1) || ''),
        escapeCsv(s.primary.diluent.blocking_mL.toFixed(2)),
        escapeCsv(s.primary.diluent.pbst_mL.toFixed(2))
      );
      parts.push(
        escapeCsv(s.secondary.total_mL.toFixed(2)),
        escapeCsv(secAb[0]?.stock_uL.toFixed(1) || ''),
        escapeCsv(secAb[1]?.stock_uL.toFixed(1) || ''),
        escapeCsv(secAb[2]?.stock_uL.toFixed(1) || ''),
        escapeCsv(s.secondary.pbst_mL.toFixed(2))
      );
      return parts.join(',');
    });
    download('solutions.csv', [headers.join(','), ...rows].join('\n'));
  }
  return (
    <section className="tables">
      <div className="card">
        <h3>Primaries</h3>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" onClick={handleExportPrimaries} aria-label="Export primaries as CSV">Export CSV</button>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Immuno #</th>
              <th>Ab1</th>
              <th>Ab2</th>
              <th>Ab3</th>
            </tr>
          </thead>
          <tbody>
            {primariesTable.map((row, rIdx) => (
              <tr key={`p-${rIdx}`}>
                <td>{rIdx + 1}</td>
                {[0, 1, 2].map(c => {
                  const cell = row[c];
                  return (
                    <td key={c}>
                      {cell ? (
                        <div className="cell">
                          <div className="line-1">{cell.name || 'N/A'}</div>
                          <div className="muted small">
                            {(cell.igClass || '—') + ' · ' + (cell.dilution || '1:1000') + ' · ' + (cell.location || '—')}
                          </div>
                        </div>
                      ) : 'N/A'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Secondaries</h3>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" onClick={handleExportSecondaries} aria-label="Export secondaries as CSV">Export CSV</button>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Immuno #</th>
              <th>Ab1</th>
              <th>Ab2</th>
              <th>Ab3</th>
            </tr>
          </thead>
          <tbody>
            {secondariesTable.map((row, rIdx) => (
              <tr key={`s-${rIdx}`}>
                <td>{rIdx + 1}</td>
                {[0, 1, 2].map(c => {
                  const cell = row[c];
                  return (
                    <td key={c}>
                      {cell ? (
                        <div className="cell">
                          <div className="line-1">{cell.name || 'N/A'}</div>
                          <div className="muted small">
                            {(cell.host || '—') + ' · ' + (cell.igSpecificity || 'IgG') + ' · ' + (cell.emission_nm ?? '—') + ' nm · ' + (cell.location || '—')}
                          </div>
                        </div>
                      ) : 'N/A'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Solutions</h3>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" onClick={handleExportSolutions} aria-label="Export solutions as CSV">Export CSV</button>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Immuno #</th>
              <th>Blocking</th>
              <th>Primary</th>
              <th>Secondary</th>
            </tr>
          </thead>
          <tbody>
            {solutions.map((s, rIdx) => (
              <tr key={`sol-${rIdx}`}>
                <td>{rIdx + 1}</td>
                <td>
                  <div className="cell">
                    <div className="line-1">Total: {s.blocking.total_mL.toFixed(2)} mL</div>
                    <div className="muted small">
                      {s.blocking.components.map((c, i) => (
                        <span key={i}>{c.label}: {c.volume_mL.toFixed(2)} mL{i < s.blocking.components.length - 1 ? ' · ' : ''}</span>
                      ))}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="cell">
                    <div className="line-1">Total: {s.primary.total_mL.toFixed(2)} mL</div>
                    <div className="muted small">
                      {s.primary.antibodies.map((a, i) => (
                        <span key={i}>{a.label}: {a.stock_uL.toFixed(1)} µL{i < s.primary.antibodies.length - 1 ? ' · ' : ''}</span>
                      ))}
                      {' · Diluent: '}
                      <span>Block {s.primary.diluent.blocking_mL.toFixed(2)} mL</span>
                      {' + '}
                      <span>PBST {s.primary.diluent.pbst_mL.toFixed(2)} mL</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="cell">
                    <div className="line-1">Total: {s.secondary.total_mL.toFixed(2)} mL</div>
                    <div className="muted small">
                      {s.secondary.antibodies.map((a, i) => (
                        <span key={i}>{a.label}: {a.stock_uL.toFixed(1)} µL{i < s.secondary.antibodies.length - 1 ? ' · ' : ''}</span>
                      ))}
                      {' · PBST: '}
                      <span>{s.secondary.pbst_mL.toFixed(2)} mL</span>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}



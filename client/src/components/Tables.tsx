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
  primariesTable: PrimariesTableCell[][]; // rows by immuno, 3 columns max
  secondariesTable: SecondariesTableCell[][];
  solutions: SolutionsBreakdown[];
}

export function Tables(props: TablesProps): JSX.Element {
  const { primariesTable, secondariesTable, solutions } = props;
  return (
    <section className="tables">
      <div className="card">
        <h3>Primaries</h3>
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



import type { ComponentChildren } from 'preact';
import { SCHOOLS, type SchoolData } from '../data';
import { modeledRange } from '../sim';
import type { Closure, SchoolState } from '../sim/types';
import { canClose, nameOf } from './closeSend';
import { closureText } from './edits';
import { fmtCount, fmtMoney, fmtPct, fmtRange } from '../format';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Window } from './Window';

function Row({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="row fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Fact({ label, column, value }: { label: string; column: string; value: string | null }) {
  return (
    <Row label={label}>{value === null ? '—' : <Sourced k={`field.${column}`}>{value}</Sourced>}</Row>
  );
}

function orNull<T>(v: T | null, f: (v: T) => string): string | null {
  return v === null ? null : f(v);
}

export function schoolFacts(s: SchoolData) {
  return [
    { label: 'Enrolled 25-26', column: 'enrollment_2025_26', value: orNull(s.enrollment, fmtCount) },
    { label: 'Capacity', column: 'functional_capacity_model', value: orNull(s.capacity, fmtCount) },
    {
      label: 'Utilization',
      column: 'utilization_model_2526',
      value: s.enrollment !== null && s.capacity ? fmtPct(s.enrollment / s.capacity) : null,
    },
    { label: 'Built', column: 'year_built', value: orNull(s.yearBuilt, String) },
    { label: 'URM', column: 'is_urm_building', value: s.isUrm ? 'Yes' : 'No' },
    { label: 'Retrofit left', column: 'retrofit_cost_remaining_usd', value: orNull(s.retrofitRemaining, fmtMoney) },
    { label: 'Direct cert.', column: 'pct_direct_cert', value: orNull(s.pctDirectCert, fmtPct) },
    { label: 'DLI', column: 'dli_languages', value: s.dliLanguages ?? 'None' },
  ];
}

const FATE = { mothball: 'mothballed', lease: 'leased', sell: 'sold' };

interface SchoolSheetProps {
  id: string;
  state: SchoolState | undefined;
  onClose: () => void;
  /** Offered while planning. */
  onCloseSend?: () => void;
  /** This school's closure in the plan. */
  closing?: Closure;
  /** Schools the plan closes into this one. Closing it drops it as their receiver. */
  receivesFrom?: string[];
}

export function SchoolSheet({ id, state, onClose, onCloseSend, closing, receivesFrom = [] }: SchoolSheetProps) {
  const school = SCHOOLS.find((s) => s.id === id);
  if (!school) return null;
  return (
    <Window title={school.name} onClose={onClose} class="panel sheet">
      {state?.closed && (
        <p class="note">
          <Sourced k={K.buildingFate} text>{`Closed in ${state.closed.year}, ${FATE[state.closed.building]}.`}</Sourced>
        </p>
      )}
      {closing && <p class="note">In the plan: {closureText(closing)}</p>}
      {receivesFrom.length > 0 && <p class="note">In the plan: takes kids from {receivesFrom.map(nameOf).join(' and ')}.</p>}
      {onCloseSend && canClose(state) && (
        <button type="button" class="btn primary wide" onClick={onCloseSend}>
          {closing ? 'Change closure' : 'Close & send'}
        </button>
      )}
      <dl>
        {schoolFacts(school).map((f) => (
          <Fact key={f.column} {...f} />
        ))}
      </dl>
      {state && (
        <>
          <h3>Simulated</h3>
          <dl>
            <Row label="Enrollment">
              <Sourced k={K.enrollment}>{fmtRange(modeledRange(state.enrollment))}</Sourced>
            </Row>
            <Row label="Homerooms">
              <Sourced k={K.homerooms}>{fmtRange(modeledRange(state.homerooms))}</Sourced>
            </Row>
            <Row label="Blended">
              <Sourced k={K.blended}>{fmtRange(modeledRange(state.blendedHomerooms))}</Sourced>
            </Row>
          </dl>
        </>
      )}
    </Window>
  );
}

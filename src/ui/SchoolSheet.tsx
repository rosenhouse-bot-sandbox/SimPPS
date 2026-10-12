import type { ComponentChildren } from 'preact';
import { SCHOOLS, type SchoolData } from '../data';
import { FATE_DONE, modeledRange } from '../sim';
import type { Closure, GradeSpanChange, SchoolId, SchoolState } from '../sim/types';
import { nameOf } from './closeSend';
import { closureText, gradeSpanText } from './edits';
import { fmtCount, fmtMoney, fmtPct, fmtRange } from '../format';
import { isTerm, type GlossaryTerm, type PlainLabel } from './glossary';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Label, Term } from './Term';
import { Window } from './Window';

function Row({ label, children }: { label: GlossaryTerm | PlainLabel; children: ComponentChildren }) {
  return (
    <div class="row fact">
      <dt>
        <Label t={label} />
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

type FactData = { label: GlossaryTerm | PlainLabel; column: string; value: string | null };

function Fact({ label, column, value }: FactData) {
  return (
    <Row label={label}>
      {value === null ? (
        '—'
      ) : (
        <Sourced k={`field.${column}`} term={isTerm(label) ? label : undefined}>
          {value}
        </Sourced>
      )}
    </Row>
  );
}

function orNull<T>(v: T | null, f: (v: T) => string): string | null {
  return v === null ? null : f(v);
}

/** A converted school's capacity fact is its K-8 one; the simulated K-5 seats show apart. */
export function schoolFacts(s: SchoolData, converted = false): FactData[] {
  return [
    { label: 'Enrolled 25-26', column: 'enrollment_2025_26', value: orNull(s.enrollment, fmtCount) },
    { label: converted ? 'Capacity as K-8' : 'Capacity', column: 'functional_capacity_model', value: orNull(s.capacity, fmtCount) },
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

interface SchoolSheetProps {
  id: string;
  state: SchoolState | undefined;
  onClose: () => void;
  /** Offered while planning, for a school that can close. */
  onCloseSend?: () => void;
  /** This school's closure in the plan. */
  closing?: Closure;
  /** Schools the plan closes into this one. */
  receivesFrom?: string[];
  /** The plan re-zones blocks into this school. */
  rezonedInto?: boolean;
  /** Offered while planning, for an open school with a zone. */
  onEditBoundary?: () => void;
  /** Offered while planning, for a K-8 that can become K-5. */
  onSendGrades?: () => void;
  /** This school's grade-span change in the plan. */
  converting?: GradeSpanChange;
  /** K-8s the plan sends grades 6-8 into this school. */
  gradesFrom?: string[];
  /** Where a converted school's grades 6-8 go. */
  middleSchool?: SchoolId;
}

export function SchoolSheet({
  id,
  state,
  onClose,
  onCloseSend,
  closing,
  receivesFrom = [],
  rezonedInto = false,
  onEditBoundary,
  onSendGrades,
  converting,
  gradesFrom = [],
  middleSchool,
}: SchoolSheetProps) {
  const school = SCHOOLS.find((s) => s.id === id);
  if (!school) return null;
  return (
    <Window title={school.name} onClose={onClose} class="panel sheet">
      {state?.closed && (
        <p class="note">
          <Sourced k={K.buildingFate} text>{`Closed in ${state.closed.year}, ${FATE_DONE[state.closed.building]}.`}</Sourced>
        </p>
      )}
      {state?.open && state.converted && (
        <p class="note">
          <Sourced k={K.gradeSpan} text>
            {`K-5 since ${state.converted.year}.${middleSchool ? ` Grades 6–8 go to ${nameOf(middleSchool)}.` : ''}`}
          </Sourced>
        </p>
      )}
      {converting && (
        <p class="note">
          In the plan:{' '}
          <Sourced k={K.gradeSpan} text>
            {gradeSpanText(converting)}
          </Sourced>
        </p>
      )}
      {gradesFrom.length > 0 && (
        <p class="note">In the plan: takes grades 6–8 from {gradesFrom.map(nameOf).join(' and ')}. Undo that to close this school.</p>
      )}
      {closing && (
        <p class="note">
          In the plan:{' '}
          <Sourced k={K.closureSavings} text>
            {closureText(closing)}
          </Sourced>
        </p>
      )}
      {receivesFrom.length > 0 && (
        <p class="note">
          In the plan: takes kids from {receivesFrom.map(nameOf).join(' and ')}. Change that closure to close this school.
        </p>
      )}
      {rezonedInto && <p class="note">In the plan: blocks re-zone into this school. Undo those edits to close it.</p>}
      {onCloseSend && (
        <button type="button" class="btn primary wide" onClick={onCloseSend}>
          {closing ? 'Change closure' : 'Close & send'}
        </button>
      )}
      {onSendGrades && (
        <button type="button" class="btn wide" onClick={onSendGrades}>
          Send 6–8 to…
        </button>
      )}
      {onEditBoundary && (
        <button type="button" class="btn wide" onClick={onEditBoundary}>
          Edit boundary
        </button>
      )}
      <dl>
        {schoolFacts(school, !!state?.converted).map((f) => (
          <Fact key={f.column} {...f} />
        ))}
      </dl>
      {state?.open && (
        <>
          <h3>
            <Term t="Simulated" />
          </h3>
          <dl>
            <Row label="Enrollment">
              <Sourced k={K.enrollment} term="Enrollment">{fmtRange(modeledRange(state.enrollment))}</Sourced>
            </Row>
            {state.converted && (
              <Row label="K-5 seats">
                <Sourced k={K.gradeSpan}>{fmtCount(state.capacity)}</Sourced>
              </Row>
            )}
            <Row label="Homerooms">
              <Sourced k={K.homerooms} term="Homerooms">{fmtRange(modeledRange(state.homerooms))}</Sourced>
            </Row>
            <Row label="Blended">
              <Sourced k={K.blended} term="Blended">{fmtRange(modeledRange(state.blendedHomerooms))}</Sourced>
            </Row>
          </dl>
        </>
      )}
    </Window>
  );
}

import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_REPORT } from './fixtures';
import { ReportView } from './ReportView';
import { termsIn } from './terms.testing';

afterEach(cleanup);

describe('ReportView', () => {
  it('sorts every kid: those in PPS now add up to Kids, and the rest left', () => {
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={() => {}} />);
    for (const [label, n] of [
      ['Stayed', '22,100~'],
      ['Moved in PPS', '820~'],
      ['Came back', '140~'],
      ['New kindergartners', '2,900~'],
      ['Kids now', '25,960~'],
      ['Left PPS', '610~'],
      ['To high school', '3,100~'],
    ]) {
      const row = screen.getByText(label).closest('.flow') as HTMLElement;
      expect(row.querySelector('[data-source]')!.textContent).toBe(n);
    }
  });

  it('lists the three largest gaps against the ghost in exact counts', () => {
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={() => {}} />);
    const items = document.querySelectorAll('.ghost li');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe('▲ Positions cut 270 vs 420~');
    expect(items[1].textContent).toBe('▼ Kids 26,050 vs 26,075~');
    expect(items[2].textContent).toBe('▲ Gap −$43M vs −$65.2M~');
  });

  it('prints three sourced Bulletin headlines stamped SIMULATION', () => {
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={() => {}} />);
    const bulletin = screen.getByRole('region', { name: 'The Bulletin' });
    expect(bulletin.textContent).toContain('SIMULATION');
    const items = within(bulletin).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(FIXTURE_REPORT.headlines.slice(0, 3).map((h) => h.text));
    expect(items.map((li) => li.querySelector('[data-source]')?.getAttribute('data-source'))).toEqual(
      FIXTURE_REPORT.headlines.slice(0, 3).map((h) => h.sourceKey),
    );
  });

  it('moves on to the next January', () => {
    const onNext = vi.fn();
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: 'Plan 2028' }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("shows where each closed school's kids went, as sourced ranges, and scores the call", () => {
    const report = {
      ...FIXTURE_REPORT,
      closures: [
        {
          school: 'peninsula',
          kids: { lo: 177, hi: 199 },
          receivers: [{ school: 'rosa-parks', kids: { lo: 136, hi: 154 } }],
          otherPps: { lo: 14, hi: 20 },
          leftPps: { lo: 23, hi: 29 },
          guess: { stayInPps: 160, actual: { lo: 152, hi: 172 }, hit: true },
        },
      ],
    };
    render(<ReportView report={report} turn={1} onNext={() => {}} />);
    const section = screen.getByRole('region', { name: 'Where Peninsula kids went' });
    expect(section.querySelector('p')!.textContent).toBe('Peninsula, 177–199~ kids:');
    const rows = [...section.querySelectorAll('.flow')].map((r) => r.textContent);
    expect(rows).toEqual(['Rosa Parks136–154~', 'Other PPS14–20~', 'Left PPS23–29~']);
    expect([...section.querySelectorAll('.flow [data-source]')].map((e) => e.getAttribute('data-source'))).toEqual([
      'model.followRate',
      'model.nonFollowers',
      'model.nonFollowers',
    ]);
    expect(section.querySelector('.call')!.textContent).toBe('You called 160. Stayed in PPS: 152–172~ HIT');
    expect((section.querySelector('.flow .bar') as HTMLElement).style.width).toBe(`${(100 * 145) / 188}%`);
  });

  it('says MISS for a call outside the range, and nothing without one', () => {
    const outcome = {
      school: 'peninsula',
      kids: { lo: 177, hi: 199 },
      receivers: [{ school: 'rosa-parks', kids: { lo: 136, hi: 154 } }],
      otherPps: { lo: 14, hi: 20 },
      leftPps: { lo: 23, hi: 29 },
    };
    render(<ReportView report={{ ...FIXTURE_REPORT, closures: [{ ...outcome, guess: { stayInPps: 220, actual: { lo: 152, hi: 172 }, hit: false } }] }} turn={1} onNext={() => {}} />);
    expect(document.querySelector('.call')!.textContent).toContain('MISS');
    cleanup();
    render(<ReportView report={{ ...FIXTURE_REPORT, closures: [outcome] }} turn={1} onNext={() => {}} />);
    expect(document.querySelector('.call')).toBeNull();
  });

  it('shows where re-zoned kids went, as sourced ranges', () => {
    const rezoned = { kids: { lo: 45, hi: 55 }, zoneSchool: { lo: 40, hi: 48 }, otherPps: { lo: 1, hi: 5 }, leftPps: { lo: 0, hi: 3 } };
    render(<ReportView report={{ ...FIXTURE_REPORT, rezoned }} turn={1} onNext={() => {}} />);
    const where = screen.getByRole('region', { name: 'Where re-zoned kids went' });
    expect(where.textContent).toContain('Re-zoned, 45–55~ kids:');
    const row = (label: string) => screen.getByText(label).closest('.flow') as HTMLElement;
    expect(row('New zone school').querySelector('[data-source]')!.textContent).toBe('40–48~');
    expect(row('Other PPS school').querySelector('[data-source]')!.textContent).toBe('1–5~');
    expect(within(where).getAllByText('Left PPS')).toHaveLength(1);
    const sources = [...where.querySelectorAll('[data-source]')].map((e) => e.getAttribute('data-source'));
    expect(sources).toEqual(['model.sliceStay', 'model.sliceStay', 'model.nonFollowers', 'model.nonFollowers']);
  });

  it('shows where a converted K-8\'s middle graders went, as sourced ranges', () => {
    const conversions = [
      { school: 'vernon', to: 'harriet-tubman', kids: { lo: 45, hi: 55 }, receiver: { lo: 40, hi: 48 }, otherPps: { lo: 1, hi: 5 }, leftPps: { lo: 0, hi: 3 } },
    ];
    render(<ReportView report={{ ...FIXTURE_REPORT, conversions }} turn={1} onNext={() => {}} />);
    const section = screen.getByRole('region', { name: 'Where Vernon 6–8 went' });
    expect(section.textContent).toContain('Vernon 6–8, 45–55~ kids:');
    const rows = [...section.querySelectorAll('.flow')].map((r) => [r.querySelector('dt')!.textContent, r.querySelector('dd')!.textContent]);
    expect(rows).toEqual([
      ['Harriet Tubman', '40–48~'],
      ['Other PPS', '1–5~'],
      ['Left PPS', '0–3~'],
    ]);
    expect([...section.querySelectorAll('[data-source]')].map((e) => e.getAttribute('data-source'))).toEqual([
      'model.gradeSpan',
      'model.gradeSpan',
      'model.nonFollowers',
      'model.nonFollowers',
    ]);
  });

  it("shows where a moved program's kids went, as sourced ranges", () => {
    const programMoves = [
      {
        program: 'Spanish' as const,
        from: ['beach', 'james-john', 'sitton'],
        to: 'cesar-chavez',
        kids: { lo: 330, hi: 370 },
        receiver: { lo: 280, hi: 320 },
        leftDli: { lo: 40, hi: 50 },
        leftPps: { lo: 2, hi: 6 },
      },
    ];
    render(<ReportView report={{ ...FIXTURE_REPORT, programMoves }} turn={1} onNext={() => {}} />);
    const section = screen.getByRole('region', { name: "Where Beach, James John and Sitton's Spanish DLI kids went" });
    expect(section.textContent).toContain('Spanish DLI from Beach, James John and Sitton, 330–370~ kids:');
    const rows = [...section.querySelectorAll('.flow')].map((r) => [r.querySelector('dt')!.textContent, r.querySelector('dd')!.textContent]);
    expect(rows).toEqual([
      ['César Chávez', '280–320~'],
      ['Left DLI', '40–50~'],
      ['Left PPS', '2–6~'],
    ]);
    expect(new Set([...section.querySelectorAll('[data-source]')].map((e) => e.getAttribute('data-source')))).toEqual(new Set(['model.programMove']));
    expect(termsIn(section)).toEqual(['Left DLI', 'Left PPS']);
  });

  it('shows no re-zoning section without re-zoned kids', () => {
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={() => {}} />);
    expect(screen.queryByRole('region', { name: 'Where re-zoned kids went' })).toBeNull();
  });

  it('shows the Walk dial change for a year with boundary edits', () => {
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={() => {}} walk={{ before: 9_000, after: 9_046 }} />);
    const walk = screen.getByText(/K-5 walkers/).closest('p')!;
    expect(walk.textContent).toBe('K-5 walkers 9,000 → 9,046~');
    expect(walk.querySelector('[data-source]')!.getAttribute('data-source')).toBe('dial.walkK5');
  });

  it('keeps the Walk dials in the ghost list past the top three', () => {
    const vsGhost = [
      ...FIXTURE_REPORT.vsGhost,
      { dial: 'walkK5' as const, you: 9_100, ghost: 9_000, better: true },
      { dial: 'newBusRiders' as const, you: 40, ghost: 0, better: false },
    ];
    render(<ReportView report={{ ...FIXTURE_REPORT, vsGhost }} turn={1} onNext={() => {}} />);
    const items = [...document.querySelectorAll('.ghost li')].map((li) => li.textContent);
    expect(items).toHaveLength(5);
    expect(items[3]).toBe('▲ K-5 walkers 9,100 vs 9,000~');
    expect(items[4]).toBe('▼ New bus riders 40 vs 0~');
  });

  it('reports the levy vote as totals, for you and the ghost', () => {
    const election = { rate: 1.8, when: 'may' as const, renewal: false, yes: 0.618, passed: true };
    const ghostElection = { rate: 1.99, when: 'may' as const, renewal: true, yes: 0.46, passed: false };
    render(<ReportView report={{ ...FIXTURE_REPORT, election, ghostElection }} turn={1} onNext={() => {}} />);
    const vote = screen.getByRole('region', { name: 'Levy vote' });
    expect([...vote.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'You: $1.80, 62%~ yes PASSED',
      'Ghost: $1.99, 46%~ yes FAILED',
    ]);
    expect([...vote.querySelectorAll('[data-source]')].map((b) => b.getAttribute('data-source'))).toEqual([
      'model.levyRate',
      'model.election',
      'model.levyRate',
      'model.election',
    ]);
  });

  it("says you had no vote when only the ghost's levy was on the ballot", () => {
    const ghostElection = { rate: 1.99, when: 'may' as const, renewal: true, yes: 0.83, passed: true };
    render(<ReportView report={{ ...FIXTURE_REPORT, ghostElection }} turn={1} onNext={() => {}} />);
    const vote = screen.getByRole('region', { name: 'Levy vote' });
    expect([...vote.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'You had no levy vote this year.',
      'Ghost: $1.99, 83%~ yes PASSED',
    ]);
  });

  it('shows no levy vote without one', () => {
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={() => {}} />);
    expect(screen.queryByRole('region', { name: 'Levy vote' })).toBeNull();
  });

  it('opens a reveal sheet for each hidden card revealed', () => {
    const reveals = [
      { sourceKey: 'model.followRate', value: 0.8 },
      { sourceKey: 'model.closedZoneCapture', value: 0 },
    ];
    render(<ReportView report={{ ...FIXTURE_REPORT, reveals }} turn={3} onNext={() => {}} />);
    expect(screen.getByRole('region', { name: 'Revealed: Follow a closed school' })).toBeTruthy();
    expect(screen.getByRole('region', { name: "Revealed: Closed zone's kindergarten capture" })).toBeTruthy();
  });

  it('puts the reveals after the year results and the Bulletin', () => {
    const reveals = [{ sourceKey: 'model.followRate', value: 0.8 }];
    render(<ReportView report={{ ...FIXTURE_REPORT, reveals }} turn={3} onNext={() => {}} />);
    const bulletin = screen.getByRole('region', { name: 'The Bulletin' });
    const reveal = screen.getByRole('region', { name: 'Revealed: Follow a closed school' });
    expect(bulletin.compareDocumentPosition(reveal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sources each flow row to what it counts', () => {
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={() => {}} />);
    const key = (label: string) => screen.getByText(label).closest('.flow')!.querySelector('[data-source]')!.getAttribute('data-source');
    expect(key('New kindergartners')).toBe('model.kCapture');
    expect(key('To high school')).toBe('model.graduates');
    expect(key('Left PPS')).toBe('model.movingRoll');
  });
});

describe('ReportView glossary', () => {
  it('defines the headings, the flows that need it and the ghost dials', () => {
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={() => {}} />);
    expect(termsIn()).toEqual([
      'Where kids went',
      'Moved in PPS',
      'Came back',
      'Left PPS',
      'To high school',
      'Do-nothing ghost',
      'Positions cut',
      'Kids',
      'Gap',
      'The Bulletin',
    ]);
  });

  it('defines the closure, re-zoning, walk and levy rows', () => {
    const range = { lo: 1, hi: 2 };
    const report = {
      ...FIXTURE_REPORT,
      closures: [{ school: 'peninsula', kids: range, receivers: [{ school: 'rosa-parks', kids: range }], otherPps: range, leftPps: range }],
      rezoned: { kids: range, zoneSchool: range, otherPps: range, leftPps: range },
      election: { rate: 1.8, when: 'may' as const, renewal: false, yes: 0.6, passed: true },
      vsGhost: [{ dial: 'kindergartenCapture' as const, you: 0.7, ghost: 0.71, better: false }],
    };
    render(<ReportView report={report} turn={1} onNext={() => {}} walk={{ before: 1, after: 2 }} />);
    expect(termsIn()).toEqual(
      expect.arrayContaining(['Other PPS', 'Left PPS', 'New zone school', 'K-5 walkers', 'Levy vote', 'Kindergarten capture']),
    );
    expect(screen.getByRole('button', { name: 'K capture, what is Kindergarten capture?' })).toBeTruthy();
  });
});

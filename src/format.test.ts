import { describe, expect, it } from 'vitest';
import { fmtCount, fmtMiles, fmtMoney, fmtMoneyRange, fmtPct, fmtRange, fmtSignedMoney } from './format';

describe('format', () => {
  it('formats money compactly with a real minus sign', () => {
    expect(fmtMoney(-65_200_000)).toBe('−$65.2M');
    expect(fmtMoney(1_830_000_000)).toBe('$1.8B');
    expect(fmtMoney(155_000)).toBe('$155K');
    expect(fmtMoney(70)).toBe('$70');
    expect(fmtMoney(2.5e12)).toBe('$2.5T');
    expect(fmtMoney(-1e300)).toBe('−$999T+');
    expect(fmtMoney(NaN)).toBe('$?');
    expect(fmtSignedMoney(4_000_000)).toBe('+$4M');
  });

  it('formats shares and counts', () => {
    expect(fmtPct(0.048)).toBe('4.8%');
    expect(fmtPct(0.766)).toBe('76.6%');
    expect(fmtCount(26_400)).toBe('26.4K');
    expect(fmtCount(4_500)).toBe('4,500');
  });

  it('marks ranges as modeled', () => {
    expect(fmtRange({ lo: 190, hi: 225 })).toBe('190–225~');
    expect(fmtRange({ lo: 5, hi: 5 })).toBe('5~');
    expect(fmtRange({ lo: -61_200_000, hi: -59_200_000 }, fmtMoney)).toBe('−$61.2M to −$59.2M~');
  });

  it('shows a money range in one unit with its sign', () => {
    expect(fmtMoneyRange({ lo: -600_000, hi: -300_000 })).toBe('−$0.3–0.6M~');
    expect(fmtMoneyRange({ lo: 958_876, hi: 1_297_303 })).toBe('+$1–1.3M~');
    expect(fmtMoneyRange({ lo: -100_000, hi: 50_000 })).toBe('−$0.1M to +$0.1M~');
  });

  it('shows miles to one decimal with a sign when asked', () => {
    expect(fmtMiles(0.474)).toBe('0.5 mi');
    expect(fmtMiles(0.474, true)).toBe('+0.5 mi');
    expect(fmtMiles(-0.21, true)).toBe('−0.2 mi');
  });
});

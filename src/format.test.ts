import { describe, expect, it } from 'vitest';
import { fmtCount, fmtMoney, fmtPct, fmtRange, fmtSignedMoney } from './format';

describe('format', () => {
  it('formats money compactly with a real minus sign', () => {
    expect(fmtMoney(-65_200_000)).toBe('−$65.2M');
    expect(fmtMoney(1_830_000_000)).toBe('$1.8B');
    expect(fmtMoney(155_000)).toBe('$155K');
    expect(fmtMoney(70)).toBe('$70');
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
});

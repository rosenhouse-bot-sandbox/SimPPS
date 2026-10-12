import { describe, expect, it } from 'vitest';
import { setModelParams } from '../sim/model';
import { getSource } from '../sources/registry';
import { K } from './sources';

describe('UI source keys', () => {
  it('resolve to a registered source', () => {
    for (const k of Object.values(K)) expect(getSource(k), k).toBeDefined();
  });

  it('use the sim\'s or pps-data\'s source unless the UI owns the number', () => {
    for (const k of Object.values(K)) expect(k, k).toMatch(/^(ui|dial|model|field)\./);
  });

  it('quote the current model', () => {
    expect(getSource(K.paysOff)!.explain).toContain('$7K–$13K by need');
    setModelParams({ revenueBase: 8_000 });
    expect(getSource(K.paysOff)!.explain).toContain('$8K–$14K by need');
  });
});

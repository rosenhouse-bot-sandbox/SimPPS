import { describe, expect, it } from 'vitest';
import { getSource } from '../sources/registry';
import { K } from './sources';

describe('UI source keys', () => {
  it('resolve to a registered source', () => {
    for (const k of Object.values(K)) expect(getSource(k), k).toBeDefined();
  });

  it('use the sim\'s source unless the UI owns the number', () => {
    for (const k of Object.values(K)) expect(k, k).toMatch(/^(ui|dial|model)\./);
  });
});

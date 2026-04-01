import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const SCREENSHOT_PATTERN = /^Screenshot_(\d+)\.png$/;

function getNextFilenameFromList(existingFiles: string[]): string {
  let maxN = 0;
  for (const f of existingFiles) {
    const match = SCREENSHOT_PATTERN.exec(f);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxN) maxN = n;
    }
  }
  return `Screenshot_${maxN + 1}.png`;
}

describe('Filename Generation Property Tests', () => {
  /**
   * Property 10: Generated filename N is always max(existing) + 1
   * Validates: Requirements 8.3, 8.4
   */
  it('Property 10: generated N is always max(existing) + 1', () => {
    fc.assert(fc.property(
      fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 0, maxLength: 20 }),
      (ns) => {
        const files = ns.map((n) => `Screenshot_${n}.png`);
        const result = getNextFilenameFromList(files);
        const match = SCREENSHOT_PATTERN.exec(result);
        expect(match).not.toBeNull();
        const generatedN = parseInt(match![1], 10);
        const maxExisting = ns.length === 0 ? 0 : Math.max(...ns);
        expect(generatedN).toBe(maxExisting + 1);
      }
    ));
  });

  /**
   * Property 11: Filename pattern always matches Screenshot_{N}.png
   * Validates: Requirements 8.3, 8.10
   */
  it('Property 11: filename always matches Screenshot_{N}.png pattern', () => {
    fc.assert(fc.property(
      fc.array(fc.integer({ min: 1, max: 500 }), { minLength: 0, maxLength: 10 }),
      (ns) => {
        const files = ns.map((n) => `Screenshot_${n}.png`);
        const result = getNextFilenameFromList(files);
        expect(SCREENSHOT_PATTERN.test(result)).toBe(true);
      }
    ));
  });
});

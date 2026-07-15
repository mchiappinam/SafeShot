import { describe, it, expect } from 'vitest';
import { AnnotationEngine } from '../../src/renderer/annotation/AnnotationEngine';

/** Create a text annotation via the same public API the app uses, then finalize it. */
function addTextAnnotation(eng: AnnotationEngine, point: { x: number; y: number }, text: string, wrapWidth?: number): void {
  eng.setTool('text');
  eng.startStroke(point);
  eng.updateText(text);
  eng.setTextWrapWidth(wrapWidth);
  eng.finalizeText();
}

describe('AnnotationEngine - multi-line text hit-testing', () => {
  it('hits the first line of multi-line text', () => {
    const eng = new AnnotationEngine();
    eng.setTextSize(16);
    addTextAnnotation(eng, { x: 100, y: 100 }, 'line one\nline two\nline three');
    const [ann] = eng.getAnnotations();
    const start = ann.points[0];
    const id = eng.hitTestAnnotation({ x: start.x + 10, y: start.y + 5 });
    expect(id).toBe(ann.id);
  });

  it('hits the second line of multi-line text (regression for move-only-works-on-first-line bug)', () => {
    const eng = new AnnotationEngine();
    eng.setTextSize(16);
    addTextAnnotation(eng, { x: 100, y: 100 }, 'line one\nline two\nline three');
    const [ann] = eng.getAnnotations();
    const start = ann.points[0];
    const lineHeight = 16 + 4;
    const id = eng.hitTestAnnotation({ x: start.x + 10, y: start.y + lineHeight + 5 });
    expect(id).toBe(ann.id);
  });

  it('hits the last line of multi-line text', () => {
    const eng = new AnnotationEngine();
    eng.setTextSize(16);
    addTextAnnotation(eng, { x: 100, y: 100 }, 'line one\nline two\nline three');
    const [ann] = eng.getAnnotations();
    const start = ann.points[0];
    const lineHeight = 16 + 4;
    const id = eng.hitTestAnnotation({ x: start.x + 10, y: start.y + 2 * lineHeight + 2 });
    expect(id).toBe(ann.id);
  });

  it('misses below the last line of multi-line text', () => {
    const eng = new AnnotationEngine();
    eng.setTextSize(16);
    addTextAnnotation(eng, { x: 100, y: 100 }, 'line one\nline two\nline three');
    const [ann] = eng.getAnnotations();
    const start = ann.points[0];
    const lineHeight = 16 + 4;
    const id = eng.hitTestAnnotation({ x: start.x + 10, y: start.y + 3 * lineHeight + 20 });
    expect(id).toBeNull();
  });

  it('still hits single-line text (no regression for the common case)', () => {
    const eng = new AnnotationEngine();
    eng.setTextSize(16);
    addTextAnnotation(eng, { x: 100, y: 100 }, 'hello world');
    const [ann] = eng.getAnnotations();
    const start = ann.points[0];
    const id = eng.hitTestAnnotation({ x: start.x + 10, y: start.y + 5 });
    expect(id).toBe(ann.id);
  });

  it('uses the wrap width for the hit box when set, instead of a raw character estimate', () => {
    const eng = new AnnotationEngine();
    eng.setTextSize(16);
    // A narrow wrap width constrains the box even though the text itself is long.
    addTextAnnotation(eng, { x: 100, y: 100 }, 'a very long single line of text', 40);
    const [ann] = eng.getAnnotations();
    const start = ann.points[0];
    // Well within the 40px wrap width.
    expect(eng.hitTestAnnotation({ x: start.x + 20, y: start.y + 5 })).toBe(ann.id);
    // Far past the 40px wrap width, where a raw character-count estimate would still hit.
    expect(eng.hitTestAnnotation({ x: start.x + 300, y: start.y + 5 })).toBeNull();
  });

  it('can move a multi-line text annotation by dragging from its second line', () => {
    const eng = new AnnotationEngine();
    eng.setTextSize(16);
    addTextAnnotation(eng, { x: 100, y: 100 }, 'line one\nline two');
    const [ann] = eng.getAnnotations();
    const start = ann.points[0];
    const lineHeight = 16 + 4;
    const clickPoint = { x: start.x + 10, y: start.y + lineHeight + 5 };
    const hitId = eng.hitTestAnnotation(clickPoint);
    expect(hitId).toBe(ann.id);
    eng.startMoveAnnotation(hitId!, clickPoint);
    eng.updateMoveAnnotation({ x: clickPoint.x + 20, y: clickPoint.y + 30 });
    eng.finalizeMoveAnnotation();
    const [moved] = eng.getAnnotations();
    expect(moved.points[0].x).toBe(start.x + 20);
    expect(moved.points[0].y).toBe(start.y + 30);
  });
});

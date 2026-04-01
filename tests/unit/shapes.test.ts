import { describe, it, expect, vi } from 'vitest';
import { drawCircle, drawTriangle, drawOctagon, drawLine } from '../../src/renderer/annotation/shapes';
import { drawFreehand } from '../../src/renderer/annotation/freehand';

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
  } as unknown as CanvasRenderingContext2D;
}

const start = { x: 10, y: 10 };
const end = { x: 110, y: 110 };

describe('drawCircle', () => {
  it('calls ellipse with correct center and radii', () => {
    const ctx = makeCtx();
    drawCircle(ctx, start, end, '#FF0000', 2);
    expect(ctx.ellipse).toHaveBeenCalledWith(60, 60, 50, 50, 0, 0, Math.PI * 2);
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

describe('drawTriangle', () => {
  it('calls moveTo apex and lineTo base corners', () => {
    const ctx = makeCtx();
    drawTriangle(ctx, start, end, '#FF0000', 2);
    expect(ctx.moveTo).toHaveBeenCalledWith(60, 10); // apex top-center
    expect(ctx.lineTo).toHaveBeenCalledWith(110, 110); // bottom-right
    expect(ctx.lineTo).toHaveBeenCalledWith(10, 110);  // bottom-left
    expect(ctx.closePath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

describe('drawOctagon', () => {
  it('calls moveTo and 7 lineTo calls for 8 vertices', () => {
    const ctx = makeCtx();
    drawOctagon(ctx, start, end, '#FF0000', 2);
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(7);
    expect(ctx.closePath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

describe('drawLine', () => {
  it('draws from start to end', () => {
    const ctx = makeCtx();
    drawLine(ctx, start, end, '#FF0000', 2);
    expect(ctx.moveTo).toHaveBeenCalledWith(10, 10);
    expect(ctx.lineTo).toHaveBeenCalledWith(110, 110);
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

describe('drawFreehand', () => {
  it('draws nothing for empty points', () => {
    const ctx = makeCtx();
    drawFreehand(ctx, [], '#FF0000', 2);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('draws a dot for single point', () => {
    const ctx = makeCtx();
    drawFreehand(ctx, [{ x: 5, y: 5 }], '#FF0000', 2);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('draws stroke for multiple points', () => {
    const ctx = makeCtx();
    drawFreehand(ctx, [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 5 }], '#FF0000', 2);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.lineTo).toHaveBeenCalledTimes(2);
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

import { desktopCapturer, screen } from 'electron';
import type { NativeImage, DesktopCapturerSource, Display } from 'electron';
import type { ScreenData } from '../shared/types';

/**
 * Optional native addon interface for per-monitor DPI queries.
 * The real addon is implemented in task 4; this stub allows graceful fallback.
 */
interface NativeAddon {
  getMonitorScaleFactor?(displayId: string): number;
}

/**
 * Attempts to load the native addon from src/native/.
 * Returns null if the addon is not yet built (graceful fallback for task 4).
 */
function tryLoadNativeAddon(): NativeAddon | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../src/native/') as NativeAddon;
  } catch {
    return null;
  }
}

/**
 * ScreenCapture captures the pixel content of all connected displays.
 *
 * Requirements: 3.1, 3.3, 10.1, 10.4, 10.5
 */
export class ScreenCapture {
  /** Stored NativeImage references, keyed by displayId, for deferred release. */
  private capturedImages = new Map<string, NativeImage>();

  /** Native addon for per-monitor DPI — null when addon is not yet available. */
  private readonly nativeAddon: NativeAddon | null = tryLoadNativeAddon();

  /**
   * Captures all connected displays simultaneously.
   *
   * - Uses `desktopCapturer.getSources({ types: ['screen'] })` for pixel data.
   * - Uses `screen.getAllDisplays()` for bounds and scaleFactor.
   * - Queries native addon for DPI when available; falls back to Electron's scaleFactor.
   * - Returns results ordered left-to-right, then top-to-bottom (by bounds.x, then bounds.y).
   *
   * Requirements: 3.1, 3.3, 10.1, 10.4, 10.5
   */
  async captureAllDisplays(): Promise<ScreenData[]> {
    // Release any previously held images before a fresh capture
    this.release();

    const displays = screen.getAllDisplays();
    const maxW = Math.max(...displays.map(d => Math.round(d.bounds.width * d.scaleFactor)), 1920);
    const maxH = Math.max(...displays.map(d => Math.round(d.bounds.height * d.scaleFactor)), 1080);
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: maxW, height: maxH },
    });

    const results: ScreenData[] = [];

    for (const display of displays) {
      const source = this.matchSourceToDisplay(sources, display, displays);
      if (!source) continue;

      const nativeImg = source.thumbnail;
      const displayId = String(display.id);

      // Hold a reference so release() can nullify it later
      this.capturedImages.set(displayId, nativeImg);

      // Prefer native addon DPI; fall back to Electron's display.scaleFactor
      const scaleFactor = this.resolveScaleFactor(displayId, display.scaleFactor);

      // Physical pixel dimensions from the captured thumbnail
      const { width: nativeWidth, height: nativeHeight } = nativeImg.getSize();

      // Convert NativeImage → PNG → base64 data URL
      const pngBuffer = nativeImg.toPNG();
      const imageDataURL = `data:image/png;base64,${Buffer.from(pngBuffer).toString('base64')}`;

      results.push({
        displayId,
        bounds: {
          x: display.bounds.x,
          y: display.bounds.y,
          width: display.bounds.width,
          height: display.bounds.height,
        },
        scaleFactor,
        imageDataURL,
        nativeWidth,
        nativeHeight,
      });
    }

    // Sort left-to-right, top-to-bottom
    results.sort((a, b) =>
      a.bounds.x !== b.bounds.x ? a.bounds.x - b.bounds.x : a.bounds.y - b.bounds.y,
    );

    return results;
  }

  /**
   * Frees all stored NativeImage references, allowing the GC to reclaim memory.
   * Must be called when the overlay is closed.
   *
   * Requirements: 11.5, 14.2
   */
  release(): void {
    this.capturedImages.clear();
  }

  // ─── Private helpers ────────────────────────────────────────────────

  /**
   * Matches a desktopCapturer source to an Electron Display.
   *
   * Strategy (in order):
   * 1. Match by display ID embedded in the source's `id` string
   *    (Electron encodes the display ID in the source ID on most platforms).
   * 2. Fall back to positional matching (display index → source index).
   * 3. Last resort: return the first available source.
   */
  private matchSourceToDisplay(
    sources: DesktopCapturerSource[],
    display: Display,
    allDisplays: Display[],
  ): DesktopCapturerSource | null {
    const displayId = String(display.id);

    // Strategy 1: ID-based match
    const byId = sources.find((s) => s.id.includes(displayId));
    if (byId) return byId;

    // Strategy 2: positional match
    const idx = allDisplays.findIndex((d) => d.id === display.id);
    if (idx >= 0 && idx < sources.length) return sources[idx];

    // Strategy 3: fallback
    return sources[0] ?? null;
  }

  /**
   * Returns the DPI scale factor for a display.
   * Uses the native addon when available; otherwise uses Electron's value.
   */
  private resolveScaleFactor(displayId: string, electronScaleFactor: number): number {
    if (this.nativeAddon?.getMonitorScaleFactor) {
      try {
        return this.nativeAddon.getMonitorScaleFactor(displayId);
      } catch {
        // Native addon call failed — fall through to Electron fallback
      }
    }
    return electronScaleFactor;
  }
}

/**
 * Everything the command center starts (timers, animation frames, listeners) goes through a Life, so closing
 * the view stops all of it. The prototype owned the whole window; inside Obsidian it must clean up after itself.
 */
export class Life {
  private offs: (() => void)[] = [];
  alive = true;

  on<K extends keyof WindowEventMap>(t: Window, type: K, fn: (e: WindowEventMap[K]) => void, opts?: boolean | AddEventListenerOptions): void;
  on<K extends keyof HTMLElementEventMap>(t: HTMLElement | Document, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: boolean | AddEventListenerOptions): void;
  on(t: EventTarget, type: string, fn: (e: never) => void, opts?: boolean | AddEventListenerOptions) {
    const h = fn as unknown as EventListener;
    t.addEventListener(type, h, opts);
    this.offs.push(() => t.removeEventListener(type, h, opts));
  }

  every(ms: number, fn: () => void) { const id = window.setInterval(fn, ms); this.offs.push(() => window.clearInterval(id)); return id; }
  after(ms: number, fn: () => void) {
    const id = window.setTimeout(() => { this.timeouts.delete(id); if (this.alive) fn(); }, ms);
    this.timeouts.add(id);
    return id;
  }
  clear(id: number) { window.clearTimeout(id); this.timeouts.delete(id); }
  private timeouts = new Set<number>();

  /** requestAnimationFrame that stops once the view is closed. */
  frame(fn: FrameRequestCallback) {
    const id = window.requestAnimationFrame((t) => { this.frames.delete(id); if (this.alive) fn(t); });
    this.frames.add(id);
  }
  private frames = new Set<number>();

  /** Timeouts made with after() are tracked until they fire or the view closes. */
  dispose() {
    this.alive = false;
    this.frames.forEach((id) => window.cancelAnimationFrame(id));
    this.frames.clear();
    this.timeouts.forEach((id) => window.clearTimeout(id));
    this.timeouts.clear();
    this.offs.splice(0).forEach((f) => f());
  }
}

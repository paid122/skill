/** Development only: the few Obsidian DOM helpers the command center uses, so it can run in a plain browser page. */
type Info = { cls?: string; text?: string; value?: string; attr?: Record<string, string> };
const P = HTMLElement.prototype as unknown as Record<string, unknown>;
P.empty = function (this: HTMLElement) { while (this.firstChild) this.removeChild(this.firstChild); };
P.addClass = function (this: HTMLElement, ...c: string[]) { this.classList.add(...c.join(" ").split(" ").filter(Boolean)); };
P.removeClass = function (this: HTMLElement, ...c: string[]) { this.classList.remove(...c.join(" ").split(" ").filter(Boolean)); };
P.setText = function (this: HTMLElement, t: string) { this.textContent = t; };
P.setCssStyles = function (this: HTMLElement, s: Record<string, string>) { Object.assign(this.style, s); };
P.createEl = function (this: HTMLElement, tag: string, o: Info = {}) {
  const e = document.createElement(tag);
  if (o.cls) e.className = o.cls;
  if (o.text !== undefined) e.textContent = o.text;
  if (o.value !== undefined) (e as HTMLInputElement).value = o.value;
  for (const [k, v] of Object.entries(o.attr ?? {})) e.setAttribute(k, v);
  this.appendChild(e);
  return e;
};
P.createDiv = function (this: HTMLElement, o: Info = {}) { return (this as unknown as { createEl(t: string, o: Info): HTMLElement }).createEl("div", o); };
P.createSpan = function (this: HTMLElement, o: Info = {}) { return (this as unknown as { createEl(t: string, o: Info): HTMLElement }).createEl("span", o); };

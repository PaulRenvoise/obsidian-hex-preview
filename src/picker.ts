import { clamp, formatHex, hexToRGB, hsvToRGB, rgbToHSV } from './color';
import { isHex } from './hex';

export interface ColorTarget {
  anchor: HTMLElement;
  hex: string;
  apply?: (hex: string) => void | Promise<void>;
  readOnlyReason?: string;
}

/** One self-contained popover per window; all listeners are removed on close. */
export class ColorPicker {
  private closeCurrent?: () => void;
  close(): void { this.closeCurrent?.(); }

  open(target: ColorTarget): void {
    this.close();
    const { anchor, hex } = target;
    const doc = anchor.ownerDocument, win = doc.defaultView!;
    let rgb = hexToRGB(hex), hsv = rgbToHSV(rgb);
    let alpha = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) : 255;
    let busy = false, closed = false;
    let formatReference = hex;
    let invalidInput: HTMLInputElement | null = null;
    const listeners: (() => void)[] = [];
    const listen = (el: EventTarget, event: string, handler: EventListener, capture = false) => {
      el.addEventListener(event, handler, capture);
      listeners.push(() => el.removeEventListener(event, handler, capture));
    };
    const popover = doc.createElement('div');
    popover.className = 'hex-preview-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Edit hex color');
    const dismiss = popover.appendChild(doc.createElement('button'));
    dismiss.type = 'button'; dismiss.className = 'hex-preview-picker-close';
    dismiss.textContent = '×';
    dismiss.setAttribute('aria-label', 'Close color picker');
    dismiss.title = 'Close';
    const value = popover.appendChild(doc.createElement('output'));
    value.className = 'hex-preview-picker-value';
    value.setAttribute('aria-live', 'polite');
    const wheel = popover.appendChild(doc.createElement('div'));
    wheel.className = 'hex-preview-wheel';
    const hue = wheel.appendChild(doc.createElement('div'));
    hue.className = 'hex-preview-hue-ring';
    hue.tabIndex = 0;
    hue.setAttribute('role', 'slider');
    hue.setAttribute('aria-label', 'Hue');
    hue.setAttribute('aria-valuemin', '0'); hue.setAttribute('aria-valuemax', '359');
    const hueMarker = wheel.appendChild(doc.createElement('div'));
    hueMarker.className = 'hex-preview-hue-marker';
    const square = wheel.appendChild(doc.createElement('div'));
    square.className = 'hex-preview-sv-square';
    square.tabIndex = 0;
    square.setAttribute('role', 'slider');
    square.setAttribute('aria-label', 'Saturation and value. Left and right change saturation; up and down change value.');
    square.setAttribute('aria-valuemin', '0'); square.setAttribute('aria-valuemax', '100');
    const squareMarker = square.appendChild(doc.createElement('div'));
    squareMarker.className = 'hex-preview-sv-marker';
    const controls = popover.appendChild(doc.createElement('fieldset'));
    controls.className = 'hex-preview-picker-controls';
    const syncHSV = () => {
      const next = rgbToHSV(rgb);
      // Gray and black have no defined hue; keep the user's selected hue.
      hsv = { ...next, h: next.s ? next.h : hsv.h };
    };
    const validate = (input: HTMLInputElement, valid: boolean) => {
      if (invalidInput && invalidInput !== input) invalidInput.removeAttribute('aria-invalid');
      invalidInput = valid ? null : input;
      if (valid) input.removeAttribute('aria-invalid');
      else input.setAttribute('aria-invalid', 'true');
      apply.disabled = busy || !target.apply || !valid;
    };
    const opacityRow = controls.appendChild(doc.createElement('label'));
    opacityRow.className = 'hex-preview-picker-row';
    const opacityLabel = opacityRow.appendChild(doc.createElement('span'));
    opacityLabel.textContent = 'Opacity';
    const opacity = opacityRow.appendChild(doc.createElement('input'));
    opacity.type = 'range'; opacity.min = '0'; opacity.max = '255'; opacity.step = '1';
    opacity.setAttribute('aria-label', 'Opacity');
    listen(opacity, 'input', () => { alpha = Number(opacity.value); render(); });
    const rgbRow = controls.appendChild(doc.createElement('div'));
    rgbRow.className = 'hex-preview-picker-row';
    rgbRow.setAttribute('role', 'group'); rgbRow.setAttribute('aria-label', 'RGB');
    const rgbLabel = rgbRow.appendChild(doc.createElement('span'));
    rgbLabel.textContent = 'RGB';
    const channels = rgbRow.appendChild(doc.createElement('div'));
    channels.className = 'hex-preview-rgb';
    const inputs = (['r', 'g', 'b'] as const).map(channel => {
      const input = channels.appendChild(doc.createElement('input'));
      input.type = 'number'; input.min = '0'; input.max = '255'; input.step = '1';
      const name = ({ r: 'Red', g: 'Green', b: 'Blue' })[channel];
      input.setAttribute('aria-label', name); input.title = name;
      listen(input, 'input', () => {
        const value = input.valueAsNumber;
        const valid = input.value !== '' && Number.isInteger(value) && value >= 0 && value <= 255;
        validate(input, valid);
        if (!valid) return;
        rgb[channel] = value;
        syncHSV(); render(input);
      });
      listen(input, 'blur', () => { if (invalidInput !== input) render(); });
      return input;
    });
    const hexRow = controls.appendChild(doc.createElement('label'));
    hexRow.className = 'hex-preview-picker-row';
    const hexLabel = hexRow.appendChild(doc.createElement('span'));
    hexLabel.textContent = 'Hexa';
    const hexInput = hexRow.appendChild(doc.createElement('input'));
    hexInput.className = 'hex-preview-hex-input';
    hexInput.type = 'text'; hexInput.spellcheck = false;
    hexInput.setAttribute('autocapitalize', 'off');
    hexInput.setAttribute('aria-label', 'Hexa');
    hexInput.setAttribute('aria-description', 'Six or eight hexadecimal digits, with an optional number sign.');
    listen(hexInput, 'input', () => {
      const text = hexInput.value.trim();
      const next = text.startsWith('#') ? text : `#${text}`;
      const valid = isHex(next);
      validate(hexInput, valid);
      if (!valid) return;
      rgb = hexToRGB(next);
      if (next.length === 9) {
        alpha = parseInt(next.slice(7, 9), 16);
        if (formatReference.length === 7) formatReference += 'FF';
      }
      syncHSV(); render(hexInput);
    });
    listen(hexInput, 'blur', () => { if (invalidInput !== hexInput) render(); });
    const status = popover.appendChild(doc.createElement('div'));
    status.className = 'hex-preview-picker-status';
    status.setAttribute('role', 'status');
    status.textContent = target.readOnlyReason ?? '';
    const actions = popover.appendChild(doc.createElement('div'));
    actions.className = 'hex-preview-picker-actions';
    const apply = actions.appendChild(doc.createElement('button'));
    apply.type = 'button'; apply.className = 'mod-cta'; apply.textContent = 'Apply';
    const close = (restoreFocus = true) => {
      if (closed) return;
      closed = true;
      listeners.forEach(remove => remove());
      popover.remove();
      if (restoreFocus && anchor.isConnected) anchor.focus({ preventScroll: true });
      this.closeCurrent = undefined;
    };
    this.closeCurrent = close;
    function render(origin?: HTMLInputElement) {
      if (invalidInput && invalidInput !== origin) {
        invalidInput.removeAttribute('aria-invalid'); invalidInput = null;
      }
      const next = formatHex(rgb, alpha, formatReference);
      value.textContent = next;
      if (origin !== hexInput) hexInput.value = next;
      const radians = hsv.h * Math.PI / 180;
      hueMarker.style.left = `${50 + Math.cos(radians) * 44.5}%`;
      hueMarker.style.top = `${50 - Math.sin(radians) * 44.5}%`;
      square.style.setProperty('--hex-preview-hue', `hsl(${hsv.h}, 100%, 50%)`);
      squareMarker.style.left = `${hsv.s * 100}%`;
      squareMarker.style.top = `${(1 - hsv.v) * 100}%`;
      hue.setAttribute('aria-valuenow', String(Math.round(hsv.h) % 360));
      hue.setAttribute('aria-valuetext', `${Math.round(hsv.h)} degrees`);
      square.setAttribute('aria-valuenow', String(Math.round(hsv.s * 100)));
      square.setAttribute('aria-valuetext', `Saturation ${Math.round(hsv.s * 100)} percent, value ${Math.round(hsv.v * 100)} percent`);
      opacity.value = String(alpha);
      opacity.setAttribute('aria-valuetext', `${Math.round(alpha / 255 * 100)} percent`);
      inputs.forEach((input, i) => { if (input !== origin) input.value = String([rgb.r, rgb.g, rgb.b][i]); });
      apply.disabled = busy || !target.apply || invalidInput !== null;
    }
    const updateColor = () => { rgb = hsvToRGB(hsv); render(); };
    const chooseHue = (event: PointerEvent) => {
      const rect = hue.getBoundingClientRect();
      hsv.h = (Math.atan2(rect.top + rect.height / 2 - event.clientY, event.clientX - rect.left - rect.width / 2) * 180 / Math.PI + 360) % 360;
      updateColor();
    };
    const chooseSquare = (event: PointerEvent) => {
      const rect = square.getBoundingClientRect();
      hsv.s = clamp((event.clientX - rect.left) / rect.width);
      hsv.v = 1 - clamp((event.clientY - rect.top) / rect.height);
      updateColor();
    };
    const drag = (el: HTMLElement, choose: (event: PointerEvent) => void, hit?: (event: PointerEvent) => boolean) => {
      let pointer: number | null = null;
      listen(el, 'pointerdown', event => {
        const e = event as PointerEvent;
        if (e.button !== 0 || busy || (hit && !hit(e))) return;
        e.preventDefault(); el.focus(); pointer = e.pointerId;
        el.setPointerCapture?.(pointer); choose(e);
      });
      listen(el, 'pointermove', event => { if (!busy && (event as PointerEvent).pointerId === pointer) choose(event as PointerEvent); });
      listen(el, 'pointerup', () => { pointer = null; });
      listen(el, 'pointercancel', () => { pointer = null; });
      listen(el, 'lostpointercapture', () => { pointer = null; });
    };
    drag(hue, chooseHue, event => {
      const rect = hue.getBoundingClientRect();
      const radius = Math.hypot((event.clientX - rect.left - rect.width / 2) / (rect.width / 2), (event.clientY - rect.top - rect.height / 2) / (rect.height / 2));
      return radius >= 0.78 && radius <= 1;
    });
    drag(square, chooseSquare);
    const keyboard = (el: HTMLElement, update: (key: string, step: number) => void) => {
      listen(el, 'keydown', event => {
        const e = event as KeyboardEvent;
        if (busy || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault(); e.stopPropagation();
        update(e.key, e.shiftKey ? 10 : 1); updateColor();
      });
    };
    keyboard(hue, (key, step) => { hsv.h = (hsv.h + (key === 'ArrowLeft' || key === 'ArrowDown' ? -step : step) + 360) % 360; });
    keyboard(square, (key, step) => {
      if (key === 'ArrowLeft') hsv.s = clamp(hsv.s - step / 100);
      if (key === 'ArrowRight') hsv.s = clamp(hsv.s + step / 100);
      if (key === 'ArrowUp') hsv.v = clamp(hsv.v + step / 100);
      if (key === 'ArrowDown') hsv.v = clamp(hsv.v - step / 100);
    });
    listen(dismiss, 'click', () => { if (!busy) close(); });
    listen(apply, 'click', async () => {
      if (busy || apply.disabled || !target.apply) return;
      busy = true; controls.disabled = true; dismiss.disabled = true; render();
      try {
        const next = formatHex(rgb, alpha, formatReference);
        if (next.toLowerCase() !== hex.toLowerCase()) await target.apply(next);
        close();
      } catch (error) {
        if (closed) return;
        status.textContent = error instanceof Error ? error.message : 'Could not update this color.';
        busy = false; controls.disabled = false; dismiss.disabled = false; render();
      }
    });
    listen(doc, 'pointerdown', event => {
      if (!busy && !popover.contains(event.target as Node) && !anchor.contains(event.target as Node)) close(false);
    }, true);
    listen(doc, 'keydown', event => {
      const e = event as KeyboardEvent;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!busy) close(); }
      if (e.key === 'Tab') {
        const items = Array.from(popover.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'));
        const index = items.indexOf(doc.activeElement as HTMLElement);
        if (e.shiftKey && index <= 0) { e.preventDefault(); items.at(-1)?.focus(); }
        else if (!e.shiftKey && index === items.length - 1) { e.preventDefault(); items[0]?.focus(); }
      }
    }, true);
    const position = () => {
      if (!anchor.isConnected) { close(false); return; }
      const rect = anchor.getBoundingClientRect(), gap = 8;
      const width = popover.offsetWidth, height = popover.offsetHeight;
      const left = clamp(rect.left, gap, Math.max(gap, win.innerWidth - width - gap));
      const top = rect.bottom + gap + height <= win.innerHeight ? rect.bottom + gap : Math.max(gap, rect.top - height - gap);
      popover.style.left = `${left}px`; popover.style.top = `${top}px`;
    };
    listen(win, 'resize', position);
    listen(doc, 'scroll', position, true);
    const observer = new win.MutationObserver(() => { if (!anchor.isConnected) close(false); });
    observer.observe(doc.body, { childList: true, subtree: true });
    listeners.push(() => observer.disconnect());
    doc.body.append(popover);
    render(); position(); hue.focus({ preventScroll: true });
  }
}

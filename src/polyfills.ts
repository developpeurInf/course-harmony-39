// Polyfills for iOS 12 / Safari 12 compatibility
import { ResizeObserver } from '@juggle/resize-observer';

if (typeof window !== 'undefined') {
  // 1. globalThis
  if (typeof (window as any).globalThis === 'undefined') {
    (window as any).globalThis = window;
  }

  // 2. ResizeObserver
  if (typeof (window as any).ResizeObserver === 'undefined') {
    (window as any).ResizeObserver = ResizeObserver;
  }

  // 3. queueMicrotask
  if (typeof (window as any).queueMicrotask === 'undefined') {
    (window as any).queueMicrotask = function (fn: () => void) {
      Promise.resolve().then(fn);
    };
  }

  // 4. crypto.randomUUID
  if (typeof window.crypto !== 'undefined' && !window.crypto.randomUUID) {
    window.crypto.randomUUID = function () {
      return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) =>
        (c ^ (window.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
      ) as `${string}-${string}-${string}-${string}-${string}`;
    };
  }

  // 5. MediaQueryList addEventListener/removeEventListener for Safari 12/13
  try {
    if (window.matchMedia) {
      const proto = (window.MediaQueryList && window.MediaQueryList.prototype) || Object.getPrototypeOf(window.matchMedia('all'));
      if (proto && !proto.addEventListener) {
        proto.addEventListener = function (type: string, listener: any) {
          if (type === 'change') {
            this.addListener(listener);
          }
        };
        proto.removeEventListener = function (type: string, listener: any) {
          if (type === 'change') {
            this.removeListener(listener);
          }
        };
      }
    }
  } catch (e) {}
}

// 5. Object.fromEntries
if (!Object.fromEntries) {
  Object.fromEntries = function (entries: any) {
    if (!entries) return {};
    const obj: Record<string, any> = {};
    for (const [key, val] of entries) {
      obj[key] = val;
    }
    return obj;
  };
}

// 6. Promise.allSettled
if (!Promise.allSettled) {
  Promise.allSettled = function <T>(promises: Iterable<Promise<T>>) {
    return Promise.all(
      Array.from(promises).map((p) =>
        Promise.resolve(p).then(
          (value) => ({ status: 'fulfilled' as const, value }),
          (reason) => ({ status: 'rejected' as const, reason })
        )
      )
    );
  };
}

// 7. String.prototype.replaceAll
if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function (this: string, str: any, newStr: any) {
    if (Object.prototype.toString.call(str).toLowerCase() === '[object regexp]') {
      return this.replace(str, newStr);
    }
    return this.split(str).join(newStr);
  };
}

// 8. Blob.prototype.arrayBuffer & text polyfills for Safari < 14 (iOS 12)
if (typeof Blob !== 'undefined') {
  if (!(Blob.prototype as any).arrayBuffer) {
    (Blob.prototype as any).arrayBuffer = function () {
      const blob = this;
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
      });
    };
  }
  if (!(Blob.prototype as any).text) {
    (Blob.prototype as any).text = function () {
      const blob = this;
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });
    };
  }
}

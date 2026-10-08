// Polyfills for iOS 12 / Safari 12 compatibility
import { ResizeObserver } from '@juggle/resize-observer';
import { installPointerEventsPolyfill } from './lib/pointer-events-polyfill';

// 0. Pointer Events (absents sur iOS 12) : nécessaires aux menus / fenêtres Radix UI
try {
  installPointerEventsPolyfill();
} catch (e) {
  /* ne doit jamais bloquer le démarrage */
}

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

// 9. HTMLAnchorElement download property polyfill so SheetJS and other libs do not throw on iOS 12
if (typeof HTMLAnchorElement !== 'undefined' && !('download' in HTMLAnchorElement.prototype)) {
  Object.defineProperty(HTMLAnchorElement.prototype, 'download', {
    value: '',
    writable: true,
    enumerable: true,
    configurable: true
  });
}

// 10. Intl.RelativeTimeFormat (Safari < 14 / iOS 12) — utilisé par le tableau de bord
//     et le suivi des élèves ("il y a 5 minutes"). Sans ce polyfill : écran blanc
//     "undefined is not a constructor" sur iPad iOS 12.
if (typeof Intl !== 'undefined' && typeof (Intl as any).RelativeTimeFormat === 'undefined') {
  type Unit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  const WORDS: Record<string, Record<Unit, [string, string]>> = {
    fr: { second: ['seconde', 'secondes'], minute: ['minute', 'minutes'], hour: ['heure', 'heures'], day: ['jour', 'jours'], week: ['semaine', 'semaines'], month: ['mois', 'mois'], year: ['an', 'ans'] },
    en: { second: ['second', 'seconds'], minute: ['minute', 'minutes'], hour: ['hour', 'hours'], day: ['day', 'days'], week: ['week', 'weeks'], month: ['month', 'months'], year: ['year', 'years'] },
    ar: { second: ['ثانية', 'ثوانٍ'], minute: ['دقيقة', 'دقائق'], hour: ['ساعة', 'ساعات'], day: ['يوم', 'أيام'], week: ['أسبوع', 'أسابيع'], month: ['شهر', 'أشهر'], year: ['سنة', 'سنوات'] },
  };
  const AUTO: Record<string, Partial<Record<Unit, Record<string, string>>>> = {
    fr: { day: { '-1': 'hier', '0': "aujourd’hui", '1': 'demain' }, minute: { '0': 'cette minute-ci' }, hour: { '0': 'cette heure-ci' } },
    en: { day: { '-1': 'yesterday', '0': 'today', '1': 'tomorrow' }, minute: { '0': 'this minute' }, hour: { '0': 'this hour' } },
    ar: { day: { '-1': 'أمس', '0': 'اليوم', '1': 'غدًا' }, minute: { '0': 'هذه الدقيقة' }, hour: { '0': 'الساعة الحالية' } },
  };
  class RelativeTimeFormatPolyfill {
    private lang: string;
    private numeric: string;
    constructor(locale?: string | string[], options?: { numeric?: string }) {
      const l = String((Array.isArray(locale) ? locale[0] : locale) || 'fr').toLowerCase().slice(0, 2);
      this.lang = WORDS[l] ? l : 'fr';
      this.numeric = (options && options.numeric) || 'always';
    }
    format(value: number, unitIn: string): string {
      const unit = String(unitIn).replace(/s$/, '') as Unit;
      const v = Number(value);
      const n = Math.abs(v);
      if (this.numeric === 'auto') {
        const special = AUTO[this.lang][unit];
        if (special && special[String(v)]) return special[String(v)];
      }
      const words = WORDS[this.lang][unit] || WORDS[this.lang].day;
      const isPast = v < 0 || (v === 0 && 1 / v < 0);
      if (this.lang === 'ar') {
        const w = n === 1 ? words[0] : words[1];
        return isPast ? 'قبل ' + n + ' ' + w : 'خلال ' + n + ' ' + w;
      }
      const w = n < 2 && this.lang === 'fr' ? words[0] : n === 1 ? words[0] : words[1];
      if (this.lang === 'fr') return isPast ? 'il y a ' + n + ' ' + w : 'dans ' + n + ' ' + w;
      return isPast ? n + ' ' + w + ' ago' : 'in ' + n + ' ' + w;
    }
    resolvedOptions() {
      return { locale: this.lang, numeric: this.numeric, style: 'long', numberingSystem: 'latn' };
    }
  }
  try {
    (Intl as any).RelativeTimeFormat = RelativeTimeFormatPolyfill;
  } catch (e) { /* ignore */ }
}


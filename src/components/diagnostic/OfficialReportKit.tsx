/**
 * Éléments communs aux modèles 3 et 4 du rapport diagnostique : page A4 à cadre double,
 * en-tête officiel en trois cases, signatures et pagination mesurée (comme le modèle 2).
 * Même id racine et mêmes classes de page que les modèles 1 et 2 : l'export PDF
 * (diagnosticPdfExporter) et l'impression fonctionnent sans changement.
 */
import React from "react";
import type { DiagnosticConfig } from "@/lib/diagnosticStorage";
import type { DiagLang } from "@/lib/diagnosticTranslations";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { getReportBranding, reportImgCrossOrigin } from "@/lib/reportBranding";

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

const HEAD = {
  ar: { season: "الموسم الدراسي", institution: "المؤسسة", teacher: "الأستاذ(ة)", subject: "المادة", sigTeacher: "توقيع الأستاذ(ة)", sigDirector: "توقيع السيد المدير", sigInspector: "توقيع السيد المفتش" },
  fr: { season: "Année scolaire", institution: "Établissement", teacher: "Enseignant(e)", subject: "Matière", sigTeacher: "Signature de l'enseignant(e)", sigDirector: "Signature du directeur", sigInspector: "Signature de l'inspecteur" },
  en: { season: "School year", institution: "School", teacher: "Teacher", subject: "Subject", sigTeacher: "Teacher's signature", sigDirector: "Principal's signature", sigInspector: "Inspector's signature" },
};

export function OfficialHeader({ config, lang, title, subtitle }: { config: DiagnosticConfig; lang: DiagLang; title: string; subtitle?: string }) {
  const t = HEAD[lang] || HEAD.fr;
  const { settings } = useAppSettings();
  const b = getReportBranding(lang, settings);
  return (
    <div className="or-header">
      <div className="or-cell or-ministry">
        {b.logoUrl && (
          <img
            key={b.logoUrl}
            src={b.logoUrl}
            crossOrigin={reportImgCrossOrigin(b.logoUrl)}
            alt=""
            className="or-logo"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
        {b.headerTitle && <div className="or-small">{b.headerTitle}</div>}
        {b.headerSubtitle && <div className="or-small" style={{ fontWeight: "normal" }}>{b.headerSubtitle}</div>}
        <div className="or-small">{config.academie}</div>
        <div className="or-small">{config.direction}</div>
      </div>
      <div className="or-cell or-title-cell">
        <div className="or-title">{title}</div>
        {subtitle && <div className="or-subtitle">{subtitle}</div>}
        <div className="or-season"><b>{t.season} :</b> {config.annee_scolaire}</div>
      </div>
      <div className="or-cell or-info">
        <div><b className="or-u">{t.institution} :</b> {config.lycee || b.schoolName}</div>
        <div><b className="or-u">{t.teacher} :</b> {config.nom_enseignant}</div>
        <div><b className="or-u">{t.subject} :</b> {config.matiere}</div>
      </div>
    </div>
  );
}

export function OfficialSignatures({ config, lang }: { config: DiagnosticConfig; lang: DiagLang }) {
  const t = HEAD[lang] || HEAD.fr;
  return (
    <table className="or-table or-sign">
      <thead><tr><th>{t.sigTeacher}</th><th>{t.sigDirector}</th><th>{t.sigInspector}</th></tr></thead>
      <tbody><tr><td className="or-sign-cell"><b>{config.nom_enseignant}</b></td><td className="or-sign-cell" /><td className="or-sign-cell" /></tr></tbody>
    </table>
  );
}

export function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return <div className="or-section"><span className="or-roman">{ROMAN[n]}.</span> <u>{children}</u></div>;
}

/**
 * Pagination mesurée : chaque bloc est rendu hors écran à la largeur réelle de la page,
 * puis les blocs sont répartis sur des pages A4. keepWithNext(i) garde un titre avec le bloc suivant.
 */
export function OfficialPages<B>({
  lang, blocks, renderBlock, contentKey, keepWithNext, footerText,
}: {
  lang: DiagLang;
  blocks: B[];
  renderBlock: (b: B, key: number) => React.ReactNode;
  contentKey: string;
  keepWithNext?: (i: number) => boolean;
  footerText?: string;
}) {
  const isRtl = lang === "ar";
  const measureRef = React.useRef<HTMLDivElement>(null);
  const [pages, setPages] = React.useState<B[][] | null>(null);
  const [fontsTick, setFontsTick] = React.useState(0);
  React.useEffect(() => {
    const fonts = (document as any).fonts;
    if (fonts && fonts.ready && typeof fonts.ready.then === "function") {
      fonts.ready.then(() => setFontsTick((n) => n + 1)).catch(() => undefined);
    }
  }, []);

  React.useLayoutEffect(() => {
    const frame = measureRef.current?.querySelector(".or-frame") as HTMLElement | null;
    if (!frame) return;
    const MM = 96 / 25.4;
    const available = 297 * MM - 20 * MM - 10 * MM - 8 - (footerText ? 5 * MM : 0);
    const els = Array.from(frame.children) as HTMLElement[];
    const heights = els.map((el) => {
      const cs = window.getComputedStyle(el);
      return el.offsetHeight + parseFloat(cs.marginTop || "0") + parseFloat(cs.marginBottom || "0");
    });
    const out: B[][] = [[]];
    let used = 0;
    blocks.forEach((b, i) => {
      const h = heights[i] || 0;
      const need = keepWithNext && keepWithNext(i) ? h + (heights[i + 1] || 0) : h;
      if (used + need > available && out[out.length - 1].length > 0) {
        out.push([]);
        used = 0;
      }
      out[out.length - 1].push(b);
      used += h;
    });
    setPages(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, fontsTick]);

  return (
    <div
      id="diagnostic-official-report"
      className="diagnostic-print-root text-black bg-slate-100 dark:bg-slate-900 py-6 print:py-0 print:bg-white flex flex-col items-center"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <style>{officialCss(isRtl)}</style>
      <div ref={measureRef} aria-hidden="true" className="no-print" style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", left: -10000, top: 0 }}>
        <div className="diag-a4-page" style={{ height: "auto", maxHeight: "none", minHeight: 0 }}>
          <div className="or-frame" style={{ height: "auto" }}>{blocks.map((b, i) => renderBlock(b, i))}</div>
        </div>
      </div>
      {(pages || [blocks]).map((pageBlocks, pi) => (
        <div key={pi} className="diag-a4-page">
          <div className="or-frame">{pageBlocks.map((b, i) => renderBlock(b, pi * 1000 + i))}</div>
          {footerText && <div className="or-page-footer">{footerText}</div>}
        </div>
      ))}
    </div>
  );
}

/** Pied de page personnalisé (Personnalisation → Rapports) */
export function useReportFooter(lang: DiagLang) {
  const { settings } = useAppSettings();
  return getReportBranding(lang, settings).footerText;
}

function officialCss(isRtl: boolean) {
  const start = isRtl ? "right" : "left";
  return `
    @page { size: A4 portrait; margin: 0; }
    @media print {
      nav, header, aside, .no-print, [data-no-print], button { display: none !important; }
      body, html { margin: 0 !important; padding: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .diag-a4-page { box-shadow: none !important; margin: 0 !important; height: 297mm !important; page-break-after: always !important; break-after: page !important; }
      .diag-a4-page:last-child { page-break-after: auto !important; break-after: auto !important; }
    }
    .pdf-export-mode { padding: 0 !important; margin: 0 !important; background: #fff !important; }
    .pdf-export-mode .diag-a4-page { margin: 0 !important; box-shadow: none !important; height: 296.5mm !important; min-height: 296.5mm !important; max-height: 296.5mm !important; page-break-after: always !important; break-after: page !important; }
    .pdf-export-mode .diag-a4-page:last-child { page-break-after: auto !important; break-after: auto !important; }
    .diag-a4-page {
      width: 210mm; height: 297mm; min-height: 297mm; max-height: 297mm;
      padding: 10mm 12mm; margin: 0 auto 30px auto; background: #fff; box-sizing: border-box;
      font-family: 'Times New Roman', 'Amiri', serif; color: #000; overflow: hidden;
      box-shadow: 0 4px 18px rgba(0,0,0,0.18); position: relative;
    }
    .or-frame { border: 2.5px double #000; height: 100%; box-sizing: border-box; padding: 5mm 6mm; overflow: hidden; }
    .or-header { display: -webkit-box; display: flex; border: 1.5px solid #000; margin-bottom: 3mm; }
    .or-cell { padding: 2mm 3mm; box-sizing: border-box; }
    .or-ministry { width: 31%; text-align: center; }
    .or-title-cell { width: 38%; text-align: center; border-left: 1.5px solid #000; border-right: 1.5px solid #000; display: -webkit-box; display: flex; -webkit-box-orient: vertical; flex-direction: column; justify-content: center; }
    .or-info { width: 31%; font-size: 10pt; line-height: 1.45; display: -webkit-box; display: flex; -webkit-box-orient: vertical; flex-direction: column; justify-content: center; }
    .or-logo { width: 100%; height: auto; max-height: 15mm; object-fit: contain; display: block; margin: 0 auto 1mm auto; }
    .or-small { font-size: 7.5pt; font-weight: bold; line-height: 1.25; }
    .or-title { font-size: 13.5pt; font-weight: bold; text-decoration: underline; text-underline-offset: 3px; line-height: 1.3; }
    .or-subtitle { font-size: 10pt; font-weight: bold; margin-top: 1mm; }
    .or-season { font-size: 10pt; margin-top: 1.2mm; white-space: nowrap; }
    .or-u { text-decoration: underline; }
    .or-block { margin-bottom: 2mm; }
    .or-para { font-size: 10.5pt; line-height: 1.45; margin: 0 0 1.5mm 0; text-align: justify; }
    .or-section { font-size: 12.5pt; font-weight: bold; margin: 2mm 0 1.2mm 0; }
    .or-roman { display: inline-block; min-width: 8mm; }
    .or-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; table-layout: fixed; }
    .or-table th, .or-table td { border: 1px solid #000; padding: 0.8mm 1.5mm; text-align: center; vertical-align: middle; line-height: 1.3; word-wrap: break-word; overflow-wrap: break-word; }
    .or-table th { font-weight: bold; background: #e7e6e6; }
    .or-start { text-align: ${start} !important; }
    .or-top { vertical-align: top !important; }
    .or-bold { font-weight: bold; }
    .or-muted { color: #555; font-style: italic; }
    .or-t1 { background: #f79646; } .or-t2 { background: #ffc000; } .or-t3 { background: #c5e0b3; } .or-t4 { background: #92d050; }
    .or-ok { background: #c6efce; } .or-mid { background: #ffeb9c; } .or-ko { background: #ffc7ce; }
    .or-bar { height: 2.2mm; background: #ddd; border: 0.6px solid #555; margin-top: 0.6mm; }
    .or-bar > div { height: 100%; background: #1f4e79; }
    .or-list { margin: 0; padding-${start}: 5mm; font-size: 10pt; line-height: 1.4; }
    .or-list li { margin: 0.3mm 0; }
    .or-highlight { border: 1.2px solid #000; background: #deeaf6; padding: 1.5mm 3mm; font-size: 10.5pt; margin-bottom: 2mm; }
    .or-sign { margin-top: 4mm; }
    .or-sign-cell { height: 24mm; vertical-align: top !important; padding-top: 2mm !important; }
    .or-class-title { font-size: 11pt; font-weight: bold; text-decoration: underline; margin: 1mm 0 1mm 0; }
    .or-names { font-size: 8.8pt; }
    .or-names td { text-align: ${start}; vertical-align: top; padding: 0.4mm 1.2mm; }
    .or-page-footer { position: absolute; left: 12mm; right: 12mm; bottom: 2.5mm; font-size: 7.5pt; line-height: 1.2; text-align: center; color: #555; white-space: pre-line; overflow: hidden; max-height: 6.5mm; }
  `;
}

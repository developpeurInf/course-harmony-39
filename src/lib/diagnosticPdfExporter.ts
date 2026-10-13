import { downloadBlob } from "@/lib/download";
/**
 * Chargeur dynamique ultra-léger pour html2pdf.js côté client.
 * Évite d'alourdir le bundle et de saturer Terser lors du build.
 */
function loadHtml2PdfScript(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).html2pdf) {
      return resolve((window as any).html2pdf);
    }

    const existingScript = document.getElementById("html2pdf-cdn-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve((window as any).html2pdf));
      existingScript.addEventListener("error", (e) => reject(e));
      return;
    }

    const script = document.createElement("script");
    script.id = "html2pdf-cdn-script";
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.async = true;
    script.onload = () => {
      if ((window as any).html2pdf) {
        resolve((window as any).html2pdf);
      } else {
        reject(new Error("html2pdf non disponible"));
      }
    };
    script.onerror = () => reject(new Error("Impossible de charger html2pdf"));
    document.head.appendChild(script);
  });
}

/**
 * html2canvas dessine mal les <svg> inline (taille intrinsèque ignorée → graphiques
 * agrandis/coupés ou vides dans le PDF téléchargé, alors que l'aperçu est correct).
 * Solution : juste avant la capture, chaque SVG est converti en image PNG haute
 * résolution de la même taille, puis le SVG d'origine est remis après l'export.
 */
async function rasterizeSvgs(root: HTMLElement, scale = 3): Promise<() => void> {
  const swaps: Array<{ svg: SVGSVGElement; img: HTMLImageElement }> = [];
  const svgs = Array.from(root.querySelectorAll("svg")) as SVGSVGElement[];

  await Promise.all(
    svgs.map(async (svg) => {
      const rect = svg.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;

      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", String(rect.width));
      clone.setAttribute("height", String(rect.height));
      clone.removeAttribute("style");
      clone.removeAttribute("class");
      // Police identique à l'aperçu (l'image SVG n'hérite pas du CSS de la page)
      const computed = window.getComputedStyle(svg);
      clone.setAttribute("font-family", computed.fontFamily || "Times New Roman, serif");
      if (!clone.getAttribute("viewBox")) {
        clone.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
      }

      const svgText = new XMLSerializer().serializeToString(clone);
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);

      const pngUrl = await new Promise<string | null>((resolve) => {
        const image = new Image();
        image.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(rect.width * scale);
            canvas.height = Math.round(rect.height * scale);
            const ctx = canvas.getContext("2d");
            if (!ctx) return resolve(null);
            ctx.scale(scale, scale);
            ctx.drawImage(image, 0, 0, rect.width, rect.height);
            resolve(canvas.toDataURL("image/png"));
          } catch {
            resolve(null);
          }
        };
        image.onerror = () => resolve(null);
        image.src = url;
      });
      if (!pngUrl) return;

      const img = document.createElement("img");
      img.src = pngUrl;
      img.alt = "";
      img.style.width = `${rect.width}px`;
      img.style.height = `${rect.height}px`;
      img.style.display = computed.display === "inline" ? "inline-block" : computed.display || "block";
      img.style.flexShrink = "0";
      img.style.maxWidth = "none";
      swaps.push({ svg, img });
    })
  );

  // Remplacement synchrone, une fois toutes les images prêtes
  swaps.forEach(({ svg, img }) => svg.replaceWith(img));
  await Promise.all(
    swaps.map(({ img }) => (img.decode ? img.decode().catch(() => undefined) : Promise.resolve()))
  );

  return () => {
    swaps.forEach(({ svg, img }) => {
      if (img.parentNode) img.replaceWith(svg);
    });
  };
}

function loadScript(id: string, src: string, globalName: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const get = () => globalName.split(".").reduce((o: any, k) => (o ? o[k] : undefined), window as any);
    if (get()) return resolve(get());
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => (get() ? resolve(get()) : reject(new Error(globalName + " indisponible"))));
    script.addEventListener("error", () => reject(new Error("Impossible de charger " + src)));
  });
}

/**
 * html2canvas mesure la ligne de base des polices avec une petite image placée dans un
 * <div> directement sous <body>. Le CSS de base de Tailwind met toutes les images en
 * « display:block », ce qui fausse cette mesure : le texte était dessiné trop bas
 * (traversé par les bordures des tableaux). On rétablit « inline » le temps de l'export.
 */
function installBaselineFix(): () => void {
  const style = document.createElement("style");
  style.setAttribute("data-pdf-export", "baseline-fix");
  style.textContent = "body > div > img { display: inline !important; }";
  document.head.appendChild(style);
  return () => style.remove();
}

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Export PDF page par page.
 * Le rapport est d'abord copié hors de la mise en page de l'application (dont la hauteur
 * est limitée à l'écran : html2canvas ne voyait alors que la première page), puis chaque
 * page A4 (.diag-a4-page) est photographiée séparément et ajoutée au PDF.
 * Avantages : rapport complet, aucune page coupée en deux, mémoire maîtrisée sur iPad.
 */
async function exportPageByPage(element: HTMLElement, filename: string): Promise<void> {
  const [html2canvas, jspdf] = await Promise.all([
    loadScript("html2canvas-cdn-script", "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", "html2canvas"),
    loadScript("jspdf-cdn-script", "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "jspdf"),
  ]);
  const JsPDF = jspdf.jsPDF || jspdf.default || jspdf;

  // Copie du rapport (graphiques déjà convertis en images) dans un conteneur libre
  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText =
    "position:absolute;left:0;top:0;width:210mm;background:#ffffff;z-index:-1;pointer-events:none;direction:ltr;";
  const clone = element.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.classList.add("pdf-export-mode");
  holder.appendChild(clone);
  document.body.appendChild(holder);

  const prevHtmlH = document.documentElement.style.height;
  const prevBodyH = document.body.style.height;
  const prevBodyOverflow = document.body.style.overflow;
  document.documentElement.style.height = "auto";
  document.body.style.height = "auto";
  document.body.style.overflow = "visible";

  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const imgs = Array.from(holder.querySelectorAll("img"));
    await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = () => r(null); }))));

    // Zones de mesure invisibles (pagination du modèle 2) : jamais dans le PDF
    Array.from(clone.querySelectorAll(".no-print")).forEach((n) => n.remove());
    let pages = Array.from(clone.querySelectorAll(".diag-a4-page")) as HTMLElement[];
    if (pages.length === 0) pages = [clone];

    const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const scale = isIOS() ? 1.5 : 2;
    const totalH = holder.scrollHeight + 200;
    let first = true;

    for (const page of pages) {
      const canvas: HTMLCanvasElement = await html2canvas(page, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        windowWidth: Math.max(1024, Math.ceil(holder.scrollWidth)),
        windowHeight: totalH,
        // même correctif dans la copie de page utilisée par html2canvas
        onclone: (doc: Document) => {
          const st = doc.createElement("style");
          st.textContent = "body > div > img { display: inline !important; }";
          doc.head.appendChild(st);
        },
      });
      // Une page plus haute que l'A4 (cas rare) est découpée en plusieurs pages
      const sliceH = Math.floor((canvas.width * 297) / 210);
      for (let y = 0; y < canvas.height; y += sliceH) {
        const h = Math.min(sliceH, canvas.height - y);
        if (h < 8) break; // reste de quelques pixels : ignoré
        let source: HTMLCanvasElement = canvas;
        if (y > 0 || h < canvas.height) {
          source = document.createElement("canvas");
          source.width = canvas.width;
          source.height = h;
          const ctx = source.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, source.width, h);
            ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
          }
        }
        if (!first) pdf.addPage("a4", "portrait");
        first = false;
        pdf.addImage(source.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, (h * 210) / canvas.width, undefined, "FAST");
      }
      // libère la mémoire du canvas (iPad)
      canvas.width = 0;
      canvas.height = 0;
    }

    const blob: Blob = pdf.output("blob");
    await downloadBlob(blob, filename);
  } finally {
    document.documentElement.style.height = prevHtmlH;
    document.body.style.height = prevBodyH;
    document.body.style.overflow = prevBodyOverflow;
    holder.remove();
  }
}

export async function exportDiagnosticReportToPdf(elementId: string, filename: string): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error("Élément introuvable pour l'export PDF:", elementId);
    return false;
  }

  const cleanFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  const prevScrollX = window.scrollX || window.pageXOffset || 0;
  const prevScrollY = window.scrollY || window.pageYOffset || 0;
  window.scrollTo(0, 0);

  // Mode export : pages A4 sans marges ni ombres (mesures exactes des graphiques)
  element.classList.add("pdf-export-mode");
  let restoreSvgs: () => void = () => {};
  const removeBaselineFix = installBaselineFix();

  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    restoreSvgs = await rasterizeSvgs(element);
    try {
      await exportPageByPage(element, cleanFilename);
      return true;
    } catch (err) {
      console.warn("Export page par page impossible, essai avec html2pdf :", err);
    }

    const html2pdf = await loadHtml2PdfScript();
    const opt = {
      margin: 0,
      filename: cleanFilename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: isIOS() ? 1.5 : 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        letterRendering: true,
        scrollY: 0,
        windowHeight: element.scrollHeight + 200,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
      pagebreak: { mode: ["css", "legacy"] },
    };
    await html2pdf().set(opt).from(element).save();
    return true;
  } catch (err) {
    console.warn("Échec génération PDF, déclenchement impression directe:", err);
    const prevTitle = document.title;
    document.title = cleanFilename.replace(".pdf", "");
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 1500);
    return true;
  } finally {
    removeBaselineFix();
    restoreSvgs();
    element.classList.remove("pdf-export-mode");
    window.scrollTo(prevScrollX, prevScrollY);
  }
}

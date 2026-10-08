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

export async function exportDiagnosticReportToPdf(elementId: string, filename: string): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error("Élément introuvable pour l'export PDF:", elementId);
    return false;
  }

  const cleanFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;

  // Sauvegarder la position de défilement actuelle
  const prevScrollX = window.scrollX || window.pageXOffset || 0;
  const prevScrollY = window.scrollY || window.pageYOffset || 0;

  // Remonter en haut de page pour que html2canvas capture exactement les coordonnées (0, 0)
  window.scrollTo(0, 0);

  // Activer le mode export strict : supprime les paddings d'aperçu web, marges et ombres
  element.classList.add("pdf-export-mode");

  let restoreSvgs: () => void = () => {};

  try {
    const html2pdf = await loadHtml2PdfScript();

    // Laisser le navigateur appliquer le mode export avant de mesurer les graphiques
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    restoreSvgs = await rasterizeSvgs(element);

    const opt = {
      margin: 0,
      filename: cleanFilename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        // iPad iOS 12 (1 Go de RAM) : un canvas trop grand donne un PDF blanc ou fait planter l'onglet
        scale: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? 1.5 : 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        letterRendering: true
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        compress: true
      },
      pagebreak: {
        mode: ["css", "legacy"]
      }
    };

    await html2pdf().set(opt).from(element).save();
    return true;
  } catch (err) {
    console.warn("Échec génération html2pdf, déclenchement impression directe:", err);
    const prevTitle = document.title;
    document.title = cleanFilename.replace(".pdf", "");
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 1500);
    return true;
  } finally {
    // Restaurer les graphiques SVG, le mode aperçu et la position de défilement
    restoreSvgs();
    element.classList.remove("pdf-export-mode");
    window.scrollTo(prevScrollX, prevScrollY);
  }
}

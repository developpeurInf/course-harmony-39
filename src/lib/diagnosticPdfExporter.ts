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

  try {
    const html2pdf = await loadHtml2PdfScript();

    const opt = {
      margin: 0,
      filename: cleanFilename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
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
    // Restaurer le mode aperçu et la position de défilement
    element.classList.remove("pdf-export-mode");
    window.scrollTo(prevScrollX, prevScrollY);
  }
}

"use client";

import PdfEditor from "@/views/PdfEditor";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  return <RequireFeature feature="pdfEditor"><PdfEditor /></RequireFeature>;
}

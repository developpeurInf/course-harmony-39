"use client";

import PdfEditor from "@/views/PdfEditor";
import { RequireFeature } from "@/components/access/RequireFeature";
import { RequirePermission } from "@/components/access/AccessUi";

export default function Page() {
  return <RequireFeature feature="pdfEditor"><RequirePermission perm="pdf.use"><PdfEditor /></RequirePermission></RequireFeature>;
}

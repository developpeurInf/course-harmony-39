"use client";

import dynamic from "next/dynamic";
import { RequireFeature } from "@/components/access/RequireFeature";
import { OfficeLoading } from "@/components/office/shared/OfficeLoading";

// L'éditeur (lourd) n'est téléchargé qu'à l'ouverture de cette page
const Editor = dynamic(() => import("@/components/office/ppt/PptEditor"), { ssr: false, loading: () => <OfficeLoading app="ppt" /> });

export default function Page() {
  return <RequireFeature feature="office"><Editor /></RequireFeature>;
}

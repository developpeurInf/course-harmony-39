"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Navigate } from "@/lib/router";
import { RequireFeature } from "@/components/access/RequireFeature";
import { ggbApp, type GgbAppId } from "@/components/geogebra/ggbApps";

// GeoGebra n'est chargé qu'à l'ouverture de cette page
const Workspace = dynamic(() => import("@/components/geogebra/GeoGebraWorkspace"), { ssr: false });

export default function Page() {
  const params = useParams<{ app: string }>();
  const app = ggbApp(params?.app);
  if (!app) return <Navigate to="/geogebra" />;
  return (
    <RequireFeature feature="geogebra">
      <Workspace appId={app.id as GgbAppId} />
    </RequireFeature>
  );
}

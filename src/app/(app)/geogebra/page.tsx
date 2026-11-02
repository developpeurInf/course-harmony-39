"use client";

import GeoGebraHub from "@/views/geogebra/GeoGebraHub";
import { RequireFeature } from "@/components/access/RequireFeature";

export default function Page() {
  return <RequireFeature feature="geogebra"><GeoGebraHub /></RequireFeature>;
}

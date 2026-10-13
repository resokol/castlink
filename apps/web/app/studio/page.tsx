import { hostedAccessEnabled } from "@/lib/hosted-access";
import StudioPageClient from "@/components/StudioPageClient";
import HomeEntry from "@/components/HomeEntry";
export const dynamic = "force-dynamic";
export default function StudioPage() {
  return hostedAccessEnabled() ? <HomeEntry hosted /> : <StudioPageClient />;
}

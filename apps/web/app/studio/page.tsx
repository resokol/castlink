import { hostedAccessEnabled } from "@/lib/hosted-access";
import StudioPageClient from "@/components/StudioPageClient";
import HomeEntry from "@/components/HomeEntry";
import { roomCreationEnabled } from "@/lib/room-creation-access";
export const dynamic = "force-dynamic";
export default function StudioPage() {
  return hostedAccessEnabled() ? <HomeEntry hosted roomCreationEnabled={roomCreationEnabled()} /> : <StudioPageClient />;
}

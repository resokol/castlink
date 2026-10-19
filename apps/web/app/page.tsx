import { hostedAccessEnabled } from "@/lib/hosted-access";
import HomeEntry from "@/components/HomeEntry";
import { roomCreationEnabled } from "@/lib/room-creation-access";
export const dynamic = "force-dynamic";
export default function HomePage() { return <HomeEntry hosted={hostedAccessEnabled()} roomCreationEnabled={roomCreationEnabled()} />; }

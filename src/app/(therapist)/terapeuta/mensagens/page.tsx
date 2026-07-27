import { getMessageCenterPage, MessageCenterPage } from "@/features/message-center";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

export default async function TherapistMessagesPage() {
  const session = await requireTherapistSession(therapistRoutePolicies.messages);
  const data = await getMessageCenterPage({
    accessToken: session.accessToken,
    actorRole: "therapist",
    profileId: session.userId,
    therapistProfileId: session.profileId,
  });

  return <MessageCenterPage data={data} />;
}

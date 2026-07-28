import { getMessageCenterPage, MessageCenterPage } from "@/features/message-center";
import { requirePatientSession } from "@/lib/auth/patient-session";

export default async function PatientMessagesPage() {
  const session = await requirePatientSession();
  const data = await getMessageCenterPage({
    accessToken: session.accessToken,
    actorRole: "patient",
    profileId: session.profileId,
  });

  return <MessageCenterPage data={data} />;
}

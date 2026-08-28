import {
  getMessageCenterPage,
  MessageCenterPage,
  parseMessageCenterPageQuery,
} from "@/features/message-center";
import { requirePatientSession } from "@/lib/auth/patient-session";

export default async function PatientMessagesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePatientSession();
  const pagination = parseMessageCenterPageQuery(await searchParams);
  const data = await getMessageCenterPage({
    ...pagination,
    accessToken: session.accessToken,
    actorRole: "patient",
    profileId: session.profileId,
  });

  return <MessageCenterPage data={data} />;
}

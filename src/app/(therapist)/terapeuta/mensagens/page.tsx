import {
  getMessageCenterPage,
  MessageCenterPage,
  parseMessageCenterPageQuery,
} from "@/features/message-center";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

export default async function TherapistMessagesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireTherapistSession(
    therapistRoutePolicies.messages,
  );
  const pagination = parseMessageCenterPageQuery(await searchParams);
  const data = await getMessageCenterPage({
    ...pagination,
    accessToken: session.accessToken,
    actorRole: "therapist",
    profileId: session.userId,
    therapistProfileId: session.profileId,
  });

  return <MessageCenterPage data={data} />;
}

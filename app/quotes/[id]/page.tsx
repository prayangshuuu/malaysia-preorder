import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PublicQuoteRedirect({ params }: PageProps) {
  const session = await getCurrentSession();
  const { id } = await params;

  if (!session) {
    redirect(`/login?callbackUrl=/account/quotes/${id}`);
  }

  redirect(`/account/quotes/${id}`);
}

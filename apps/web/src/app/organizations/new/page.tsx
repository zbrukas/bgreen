import { CreateOrganizationForm } from "@/app/_components/CreateOrganizationForm/CreateOrganizationForm";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewOrganizationPage() {
  const auth = await withAuth();
  if (!auth.user) {
    redirect("/");
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <p>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
      </p>
      <CreateOrganizationForm />
    </main>
  );
}

import { CreateOrganizationForm } from "@/app/_components/CreateOrganizationForm";
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
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
      <p style={{ marginBottom: "1.5rem" }}>
        <Link href="/">← Voltar</Link>
      </p>
      <CreateOrganizationForm />
    </main>
  );
}

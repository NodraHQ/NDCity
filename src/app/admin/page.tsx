import AdminPanel from "@/components/admin/AdminPanel";
import LoginForm from "@/components/admin/LoginForm";
import { adminConfigured, isAdmin } from "@/lib/admin-auth";
import { getStore } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · NDCity", robots: { index: false } };

export default async function AdminPage() {
  if (!adminConfigured()) {
    return (
      <main className="admin">
        <h1>Admin</h1>
        <p>Falta configurar a senha: crie a variável <code>ADMIN_PASSWORD</code> na Vercel e faça um novo deploy.</p>
      </main>
    );
  }
  if (!(await isAdmin())) return <LoginForm />;
  return <AdminPanel storeKind={getStore().kind} />;
}

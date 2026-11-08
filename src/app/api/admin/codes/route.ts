import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { generateCode } from "@/lib/codes";
import { getStore } from "@/lib/db";
import { isValidHandle, normalizeHandle } from "@/lib/handle";

const denied = () => NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });

export async function GET() {
  if (!(await isAdmin())) return denied();
  return NextResponse.json({ ok: true, codes: await getStore().listCodes() });
}

/** Gera um código novo para um @. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return denied();
  const body = await req.json().catch(() => null);
  const handle = normalizeHandle(String(body?.handle ?? ""));
  if (!isValidHandle(handle))
    return NextResponse.json({ ok: false, message: "Esse @ não parece válido." }, { status: 400 });

  const store = getStore();
  const house = await store.findClaimByHandle(handle);
  if (house)
    return NextResponse.json({ ok: false, message: `@${handle} já tem uma casinha.` }, { status: 409 });

  for (let i = 0; i < 5; i++) {
    try {
      const code = await store.createCode(generateCode(), handle);
      return NextResponse.json({ ok: true, code });
    } catch {
      // código repetido (muito raro): tenta outro
    }
  }
  return NextResponse.json({ ok: false, message: "Não consegui gerar o código. Tente de novo." }, { status: 500 });
}

/** Apaga um código ainda não usado. */
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return denied();
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ ok: false }, { status: 400 });
  await getStore().deleteCode(code);
  return NextResponse.json({ ok: true });
}

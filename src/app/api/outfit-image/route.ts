import { authenticateRequest } from "@/lib/auth/request";
import { ownsImagePath } from "@/lib/auth/session";
import { WARDROBE_BUCKET } from "@/lib/utils";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const path = new URL(request.url).searchParams.get("path");
  if (!path || path.length > 1024 || !ownsImagePath(path, auth.user.id)) return Response.json({ success: false, error: "Invalid image owner" }, { status: 400 });
  const signed = await auth.supabase.storage.from(WARDROBE_BUCKET).createSignedUrl(path, 3600);
  if (signed.error || !signed.data?.signedUrl) return Response.json({ success: false, error: "Preview unavailable. Please retry." }, { status: 503 });
  return Response.json({ success: true, storagePath: path, signedUrl: signed.data.signedUrl }, { headers: { "Cache-Control": "no-store" } });
}

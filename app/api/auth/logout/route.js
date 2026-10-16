const { deleteSession } = require("../../../../lib/db");

function getCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  const match = raw.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
}

export async function POST(request) {
  const sid = getCookie(request, "sid");
  if (sid) await deleteSession(sid);
  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", "sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return res;
}

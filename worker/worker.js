const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

const norm = n => (n || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim()
  .replace(/\s+/g, " ");

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/account") {
      const k = norm(url.searchParams.get("name"));
      if (!k) return new Response(JSON.stringify({ account: null }), { headers: CORS });
      const row = await env.DB.prepare("SELECT data FROM accounts WHERE id = ?").bind(k).first();
      return new Response(
        JSON.stringify({ account: row ? JSON.parse(row.data) : null }),
        { headers: CORS }
      );
    }

    if (req.method === "PUT" && url.pathname === "/account") {
      const body = await req.json();
      const k = norm(body.name);
      if (!k || !body.data) {
        return new Response(JSON.stringify({ ok: false }), { status: 400, headers: CORS });
      }
      const existing = await env.DB.prepare("SELECT data, updated FROM accounts WHERE id = ?").bind(k).first();
      const incomingUpdated = +(body.data.updated || Date.now());
      if (existing && (existing.updated || 0) > incomingUpdated) {
        return new Response(
          JSON.stringify({ ok: true, account: JSON.parse(existing.data) }),
          { headers: CORS }
        );
      }
      await env.DB.prepare(
        "INSERT INTO accounts (id, display, data, pct, updated) VALUES (?, ?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET display=excluded.display, data=excluded.data, pct=excluded.pct, updated=excluded.updated"
      )
        .bind(k, body.name.trim(), JSON.stringify(body.data), +(body.pct || 0), incomingUpdated)
        .run();
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    if (req.method === "GET" && url.pathname === "/ranking") {
      const { results } = await env.DB.prepare(
        "SELECT display, pct, updated FROM accounts ORDER BY pct DESC LIMIT 100"
      ).all();
      return new Response(JSON.stringify({ ranking: results || [] }), { headers: CORS });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: CORS });
  }
};

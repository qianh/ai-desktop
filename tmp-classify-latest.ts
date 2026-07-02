import fs from "node:fs";
import path from "node:path";
import { classifyInterceptForStorage, urlPath } from "./src/lib/conversationFilter";

const dir = `${process.env.HOME}/Library/Application Support/AppScope/proxy-events`;
const files = fs
  .readdirSync(dir)
  .filter((name) => name.endsWith(".jsonl"))
  .map((name) => {
    const file = path.join(dir, name);
    return { name, file, mtime: fs.statSync(file).mtimeMs };
  })
  .sort((a, b) => b.mtime - a.mtime)
  .slice(0, 5);

function fromFlow(raw: any) {
  return {
    id: raw.id ?? "unknown",
    timestamp: raw.timestamp_ms ?? Date.now(),
    url: raw.url,
    method: raw.method,
    req_headers: {},
    req_body: raw.req_body_preview ?? null,
    status: raw.status_code ?? 0,
    resp_headers: {},
    resp_body: raw.resp_body_preview ?? null,
    duration_ms: raw.duration_ms ?? 0,
    error: raw.error ?? undefined,
  };
}

for (const { name, file } of files) {
  const rows: any[] = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\n/).filter(Boolean)) {
    const raw = JSON.parse(line);
    if (raw._type === "js_intercept") {
      for (const item of JSON.parse(raw.items_json || "[]")) rows.push(item);
    } else if (raw.url) {
      rows.push(fromFlow(raw));
    }
  }

  const classified = rows.map((item) => ({ item, meta: classifyInterceptForStorage(item) }));
  const uploadable = classified.filter((x) => x.meta.isConversation);
  console.log(`${name}: total=${rows.length} uploadable=${uploadable.length}`);
  for (const x of uploadable.slice(0, 10)) {
    console.log(`  ${x.item.method} ${urlPath(x.item.url)} conversation_id=${x.meta.conversationId ?? ""}`);
  }
}

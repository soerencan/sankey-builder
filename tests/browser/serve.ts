import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../dist/", import.meta.url));
const prefix = "/sankey-builder/";
const contentTypes: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
};

await stat(resolve(root, "index.html"));

createServer(async (request, response) => {
	try {
		const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
		if (!pathname.startsWith(prefix)) {
			response.writeHead(404).end();
			return;
		}
		const path = resolve(root, pathname.slice(prefix.length) || "index.html");
		if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) {
			response.writeHead(404).end();
			return;
		}
		const body = await readFile(path);
		response.writeHead(200, {
			"Content-Type": contentTypes[extname(path)] ?? "application/octet-stream",
		});
		response.end(body);
	} catch {
		response.writeHead(404).end();
	}
}).listen(4173, "127.0.0.1");

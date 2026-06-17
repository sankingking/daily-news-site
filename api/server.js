const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const newsHandler = require("./api/news");
const articleHandler = require("./api/article");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/news") {
      await handleVercelStyleApi(req, res, newsHandler);
      return;
    }

    if (url.pathname === "/api/article") {
      await handleVercelStyleApi(req, res, articleHandler);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    sendText(res, 500, "服务器错误");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`每日重大新闻网站已启动：http://${HOST}:${PORT}`);
});

async function handleVercelStyleApi(req, res, handler) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  res.json = (data) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data));
  };

  await handler(req, res);
}

async function serveStatic(pathname, res) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path
    .normalize(decodeURIComponent(requestedPath))
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    sendText(res, 403, "禁止访问");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const contentType = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": contentType.includes("html") ? "no-cache" : "public, max-age=3600",
    });
    res.end(data);
  } catch (error) {
    sendText(res, 404, "未找到页面");
  }
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end(message);
}

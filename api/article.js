const FETCH_TIMEOUT = 8000;
const MAX_PARAGRAPHS = 6;
const MAX_TOTAL_CHARS = 900;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const articleUrl = requestUrl.searchParams.get("url");

    if (!articleUrl || !/^https?:\/\//i.test(articleUrl)) {
      res.status(400).json({ error: "新闻链接无效" });
      return;
    }

    const html = await fetchText(articleUrl);
    const title = cleanText(
      getMeta(html, ["og:title", "twitter:title"]) || getTag(html, "title") || getHeading(html),
    );
    const description = cleanText(getMeta(html, ["og:description", "description", "twitter:description"]));
    const image = pickImage([...getMetaImages(html), ...getHtmlImages(html)], articleUrl);
    const paragraphs = extractParagraphs(html);

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
    res.status(200).json({
      title,
      description,
      image,
      paragraphs,
      originalUrl: articleUrl,
      notice: "本站展示新闻导读和正文摘录，完整内容请查看原文。",
    });
  } catch (error) {
    res.status(500).json({ error: "新闻详情提取失败" });
  }
};

async function fetchText(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 NewsBoard/1.0",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractParagraphs(html) {
  const cleanHtml = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ");

  const paragraphs = [...cleanHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1]))
    .filter((text) => text.length >= 28 && !isBoilerplate(text));

  const result = [];
  let total = 0;

  for (const paragraph of paragraphs) {
    if (result.length >= MAX_PARAGRAPHS || total >= MAX_TOTAL_CHARS) break;
    const clipped = paragraph.length > 220 ? `${paragraph.slice(0, 220)}...` : paragraph;
    result.push(clipped);
    total += clipped.length;
  }

  return result;
}

function isBoilerplate(text) {
  return /版权|免责声明|关注我们|客户端下载|扫一扫|微信|微博|登录|注册|广告|subscribe|copyright|newsletter/i.test(text);
}

function getMeta(html, names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta\\b[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta\\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return decodeEntities(match[1]);
    }
  }

  return "";
}

function getMetaImages(html) {
  return [
    getMeta(html, ["og:image", "twitter:image", "twitter:image:src"]),
  ].filter(Boolean);
}

function getHtmlImages(html) {
  return [...html.matchAll(/<img\b[^>]+src=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
}

function getTag(html, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

function getHeading(html) {
  return getTag(html, "h1");
}

function pickImage(candidates, baseUrl) {
  return candidates
    .map((url) => normalizeUrl(decodeEntities(url), baseUrl))
    .find((url) => isUsableImage(url)) || "";
}

function normalizeUrl(url, baseUrl) {
  try {
    return new URL(url, baseUrl).href;
  } catch (error) {
    return "";
  }
}

function isUsableImage(url) {
  return /^https?:\/\//i.test(url)
    && !/(\.gif|\.svg)(\?|$)/i.test(url)
    && !/(logo|avatar|icon|sprite|placeholder|default)/i.test(url);
}

function cleanText(value) {
  return decodeEntities(String(value || ""))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

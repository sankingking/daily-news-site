const RSS_SOURCES = {
  domestic: [
    {
      name: "中国新闻网",
      url: "https://www.chinanews.com.cn/rss/scroll-news.xml",
    },
    {
      name: "澎湃新闻",
      url: "https://rsshub.app/thepaper/featured",
    },
    {
      name: "央视新闻",
      url: "https://rsshub.app/cctv/china",
    },
  ],
};

const FETCH_TIMEOUT = 6500;
const MAX_ITEMS_PER_SOURCE = 10;
const MAX_STORIES_PER_MODULE = 12;

const DEFAULT_IMAGES = {
  domestic:
    "https://images.unsplash.com/photo-1522083165195-3424ed129620?auto=format&fit=crop&w=900&q=80",
};

const CATEGORY_RULES = [
  {
    id: "society",
    strong: ["社会", "民生", "法治", "法院", "警方", "事故", "灾害", "救援", "安全", "案件", "犯罪", "火灾", "地震", "洪水", "伤亡", "失踪", "公共安全", "交通事故", "crime", "court", "police"],
    weak: ["社区", "公共", "居民", "调查", "纠纷"],
  },
  {
    id: "politics",
    strong: ["政治", "政策", "政府", "外交", "会议", "总统", "总理", "选举", "国会", "议会", "部长", "白宫", "内阁", "联合国", "制裁", "policy", "election", "government"],
    weak: ["声明", "访问", "会见", "谈判", "协议"],
  },
  {
    id: "finance",
    strong: ["金融", "财经", "证券", "基金", "银行", "央行", "汇率", "债券", "股市", "股票", "A股", "港股", "美股", "通胀", "降息", "加息", "finance", "stock", "bond", "bank", "inflation"],
    weak: ["经济", "市场", "投资", "贸易", "关税", "企业", "财报"],
  },
  {
    id: "tech",
    strong: ["人工智能", "AI", "芯片", "半导体", "量子", "机器人", "航天", "卫星", "5G", "6G", "算力", "大模型", "算法", "ChatGPT", "OpenAI", "英伟达", "Nvidia", "tech", "technology", "chip", "robot"],
    weak: ["科技", "技术", "互联网", "数据", "数字化", "软件", "硬件", "智能"],
  },
  {
    id: "life",
    strong: ["生活", "健康", "医疗", "教育", "旅游", "天气", "住房", "养老", "就业", "美食", "health", "travel", "education"],
    weak: ["消费", "出行", "学校", "医院", "家庭", "服务"],
  },
  {
    id: "culture",
    strong: ["文化", "体育", "电影", "音乐", "赛事", "比赛", "演出", "艺术", "博物馆", "文旅", "sports", "film", "music"],
    weak: ["球队", "冠军", "展览", "票房", "剧集"],
  },
];

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const [domestic] = await Promise.all([
      fetchModule("domestic"),
    ]);

    const stories = normalizeAndSort(domestic);

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    res.status(200).json({
      updatedAt: new Date().toISOString(),
      source: "vercel-api",
      stories,
    });
  } catch (error) {
    res.status(500).json({
      updatedAt: new Date().toISOString(),
      source: "vercel-api",
      stories: [],
      error: "新闻抓取失败",
    });
  }
};

async function fetchModule(module) {
  const results = await Promise.allSettled(
    RSS_SOURCES[module].map((source) => fetchSource(source, module)),
  );

  return results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .slice(0, MAX_STORIES_PER_MODULE);
}

async function fetchSource(source, module) {
  const xml = await fetchText(source.url);
  const items = parseFeedItems(xml).slice(0, MAX_ITEMS_PER_SOURCE);
  const parsed = items.map((item) => parseFeedItem(item, source, module));

  return Promise.all(
    parsed.map(async (story) => ({
      ...story,
      image: story.image || (await fetchArticleImage(story.link)),
    })),
  );
}

function parseFeedItems(xml) {
  const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const entries = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  return [...items, ...entries];
}

function parseFeedItem(item, source, module) {
  const summaryHtml = getTag(item, ["description", "summary", "content:encoded", "content"]);
  const link = getLink(item);

  return {
    module,
    source: source.name,
    title: cleanText(getTag(item, ["title"])),
    summary: cleanText(summaryHtml) || "暂无摘要",
    link,
    publishedAt: getTag(item, ["pubDate", "published", "updated"]) || new Date().toISOString(),
    image: getItemImage(item, summaryHtml, link),
    category: "",
  };
}

function getTag(xml, names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = xml.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
    if (match) return decodeEntities(stripCdata(match[1]).trim());
  }
  return "";
}

function getLink(item) {
  const href = getAttribute(item, "link", "href");
  const text = getTag(item, ["link"]);
  return href || text || "#";
}

function getItemImage(item, html, articleUrl) {
  const candidates = [
    ...getTagImageAttributes(item),
    ...getHtmlImages(html),
  ];

  return pickImage(candidates, articleUrl);
}

function getTagImageAttributes(xml) {
  const matches = [
    ...xml.matchAll(/<(?:media:content|media:thumbnail|enclosure|content)\b[^>]*(?:url|href)=["']([^"']+)["'][^>]*>/gi),
  ];

  return matches.map((match) => match[1]);
}

async function fetchArticleImage(articleUrl) {
  if (!/^https?:\/\//i.test(articleUrl)) return "";

  try {
    const html = await fetchText(articleUrl);
    const candidates = [
      ...getMetaImages(html),
      ...getHtmlImages(html),
    ];
    return pickImage(candidates, articleUrl);
  } catch (error) {
    return "";
  }
}

function getMetaImages(html) {
  const candidates = [];
  const metaPattern = /<meta\b[^>]*(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]*content=["']([^"']+)["'][^>]*>/gi;
  const reversedMetaPattern = /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]*>/gi;
  const linkPattern = /<link\b[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["'][^>]*>/gi;

  for (const match of html.matchAll(metaPattern)) candidates.push(match[1]);
  for (const match of html.matchAll(reversedMetaPattern)) candidates.push(match[1]);
  for (const match of html.matchAll(linkPattern)) candidates.push(match[1]);

  return candidates;
}

function getHtmlImages(html) {
  return [...html.matchAll(/<img\b[^>]+src=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
}

function getAttribute(xml, tag, attribute) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(new RegExp(`<${escaped}\\b[^>]*${attribute}=["']([^"']+)["'][^>]*>`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 NewsBoard/1.0",
        Accept: "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeAndSort(stories) {
  const seen = new Set();

  return stories
    .map((story) => ({
      ...story,
      title: cleanText(story.title),
      summary: cleanText(story.summary),
      publishedAt: validDate(story.publishedAt),
      image: story.image || DEFAULT_IMAGES[story.module],
      category: story.category || inferCategory(story),
    }))
    .filter((story) => {
      const key = story.title || story.link;
      if (!story.title || !isMostlyChinese(story.title, story.summary) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function inferCategory(story) {
  const text = `${story.title || ""} ${story.summary || ""} ${story.source || ""}`;
  const lowerText = text.toLowerCase();
  const scores = CATEGORY_RULES.map((rule) => {
    const strongHits = countKeywordHits(lowerText, rule.strong);
    const weakHits = countKeywordHits(lowerText, rule.weak);
    return {
      id: rule.id,
      score: strongHits * 3 + weakHits,
      strongHits,
    };
  }).sort((a, b) => b.score - a.score);

  const best = scores[0];
  if (!best || best.score < 3 || best.strongHits === 0) return "general";
  return best.id;
}

function countKeywordHits(text, keywords = []) {
  return keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length;
}

function isMostlyChinese(title, summary = "") {
  const text = `${title || ""}${summary || ""}`.replace(/\s+/g, "");
  if (!text) return false;
  const chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  return chineseCount >= 8 || chineseCount / text.length >= 0.28;
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

function stripCdata(value) {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function cleanText(value) {
  return decodeEntities(String(value || ""))
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
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

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

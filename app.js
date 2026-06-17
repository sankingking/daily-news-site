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

const FALLBACK_STORIES = [
  {
    module: "domestic",
    source: "演示数据",
    title: "宏观政策、民生服务与区域发展成为今日国内关注焦点",
    summary: "页面会优先抓取公开 RSS 源；网络或跨域受限时显示这组演示数据，方便保持版面可用。",
    link: "#",
    publishedAt: new Date().toISOString(),
    image: "",
  },
  {
    module: "domestic",
    source: "演示数据",
    title: "多地发布产业、交通与公共服务新动态",
    summary: "国内模块用于聚合来自中国新闻源的当天重点消息，并按发布时间排序。",
    link: "#",
    publishedAt: new Date(Date.now() - 36e5).toISOString(),
    image: "",
  },
  {
    module: "domestic",
    source: "演示数据",
    title: "城市更新、教育医疗与消费场景持续受到关注",
    summary: "搜索框会同时匹配标题、来源和摘要，便于快速筛选重点内容。",
    link: "#",
    publishedAt: new Date(Date.now() - 72e5).toISOString(),
    image: "",
  },
];

const FETCH_TIMEOUT = 4000;

const DEFAULT_IMAGES = {
  domestic:
    "https://images.unsplash.com/photo-1522083165195-3424ed129620?auto=format&fit=crop&w=900&q=80",
};

const CATEGORY_LABELS = {
  all: "全部",
  general: "综合",
  finance: "金融",
  tech: "科技",
  life: "生活",
  politics: "政治",
  society: "社会",
  culture: "文体",
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

const state = {
  stories: [],
  query: "",
  activeCategory: "all",
  isLoading: false,
  activeArticle: null,
};

const els = {
  todayLabel: document.querySelector("#todayLabel"),
  refreshBtn: document.querySelector("#refreshBtn"),
  searchInput: document.querySelector("#searchInput"),
  statusDot: document.querySelector("#statusDot"),
  statusText: document.querySelector("#statusText"),
  updatedAt: document.querySelector("#updatedAt"),
  newsBoard: document.querySelector("#newsBoard"),
  visibleCount: document.querySelector("#visibleCount"),
  sectionKicker: document.querySelector("#sectionKicker"),
  sectionTitle: document.querySelector("#sectionTitle"),
  totalCount: document.querySelector("#totalCount"),
  currentCount: document.querySelector("#currentCount"),
  domesticOverview: document.querySelector("#domesticOverview"),
  categoryOverview: document.querySelector("#categoryOverview"),
  categoryTabs: document.querySelectorAll(".category-chip"),
  categoryCounts: document.querySelectorAll("[data-category-count]"),
  template: document.querySelector("#storyTemplate"),
  articleDrawer: document.querySelector("#articleDrawer"),
  articleSource: document.querySelector("#articleSource"),
  articleTitle: document.querySelector("#articleTitle"),
  articleSummary: document.querySelector("#articleSummary"),
  articleParagraphs: document.querySelector("#articleParagraphs"),
  articleNotice: document.querySelector("#articleNotice"),
  articleOriginal: document.querySelector("#articleOriginal"),
  articleCloseTargets: document.querySelectorAll("[data-close-article]"),
};

const formatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});

els.todayLabel.textContent = formatter.format(new Date());

els.refreshBtn.addEventListener("click", () => loadNews({ manual: true }));
els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  render();
});

els.categoryTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.activeCategory = tab.dataset.category;
    els.categoryTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    render();
  });
});

els.articleCloseTargets.forEach((target) => {
  target.addEventListener("click", closeArticle);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeArticle();
});

loadNews({ reason: "initial" });

async function loadNews(options = {}) {
  if (state.isLoading) return;
  state.isLoading = true;
  setStatus("loading", "正在连接新闻源");
  els.refreshBtn.classList.add("is-loading");

  try {
    const { stories, source } = await fetchNews();

    const normalizedStories = normalizeAndSort(stories);
    const hasLiveStories = normalizedStories.length > 0;
    state.stories = hasLiveStories ? normalizedStories : normalizeAndSort(FALLBACK_STORIES);

    if (hasLiveStories) {
      const sourceLabel = source === "cloud" ? "云端接口" : "浏览器";
      setStatus("online", `${sourceLabel}已获取 ${normalizedStories.length} 条国内新闻`);
    } else {
      setStatus("offline", "新闻源暂不可用，正在显示默认内容");
    }
  } catch (error) {
    state.stories = normalizeAndSort(FALLBACK_STORIES);
    setStatus("offline", "新闻源暂不可用，可稍后点击刷新重试");
  } finally {
    els.updatedAt.textContent = `更新于 ${formatClock(new Date())}`;
    els.refreshBtn.classList.remove("is-loading");
    state.isLoading = false;
    render();
  }
}

async function fetchNews() {
  const cloudStories = await fetchCloudNews();
  if (cloudStories.length) {
    return {
      source: "cloud",
      stories: cloudStories,
    };
  }

  return {
    source: "browser",
    stories: await fetchBrowserNews(),
  };
}

async function fetchCloudNews() {
  try {
    const response = await fetchWithTimeout(`/api/news?t=${Date.now()}`);
    if (!response.ok) return [];

    const payload = await response.json();
    return Array.isArray(payload.stories) ? payload.stories : [];
  } catch (error) {
    return [];
  }
}

async function fetchBrowserNews() {
  const results = await Promise.allSettled([
    fetchModule("domestic"),
  ]);

  return results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .filter(Boolean);
}

async function fetchModule(module) {
  const sourceResults = await Promise.allSettled(
    RSS_SOURCES[module].map((source) => fetchSource(source, module)),
  );

  return sourceResults
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .slice(0, 18);
}

async function fetchSource(source, module) {
  const xmlText = await fetchText(source.url);
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const items = [...doc.querySelectorAll("item, entry")];

  return items.map((item) => {
    const link = getLink(item);

    return {
      module,
      source: source.name,
      title: getText(item, "title"),
      summary: cleanText(getText(item, "description, summary, content")),
      link,
      publishedAt: getText(item, "pubDate, published, updated") || new Date().toISOString(),
      image: getImage(item, link),
    };
  });
}

async function fetchText(url) {
  const candidates = [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];

  let lastError;
  for (const candidate of candidates) {
    try {
      const response = await fetchWithTimeout(candidate);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text.includes("<rss") || text.includes("<feed") || text.includes("<item")) {
        return text;
      }
      throw new Error("不是有效 RSS 内容");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
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
      summary: cleanText(story.summary) || "暂无摘要",
      publishedAt: validDate(story.publishedAt),
      image: story.image || DEFAULT_IMAGES[story.module],
      category: story.category || inferCategory(story),
    }))
    .filter((story) => story.title && !seen.has(story.title) && seen.add(story.title))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function render() {
  const baseFiltered = state.stories.filter((story) => {
    const haystack = `${story.title} ${story.source} ${story.summary} ${getCategoryLabel(story.category)}`.toLowerCase();
    return !state.query || haystack.includes(state.query);
  });

  const filtered = baseFiltered.filter((story) => {
    return state.activeCategory === "all" || story.category === state.activeCategory;
  });

  renderOverview(baseFiltered, filtered);
  renderNewsBoard(filtered);
  renderSectionHeader(filtered.length);
}

function renderSectionHeader(count) {
  const categoryLabel = state.activeCategory === "all" ? "全部类型" : getCategoryLabel(state.activeCategory);
  els.sectionTitle.textContent = "国内新闻";
  els.sectionKicker.textContent = categoryLabel;
  els.visibleCount.textContent = `${count} 条`;
}

function renderOverview(baseStories, filteredStories) {
  const visibleDomestic = filteredStories.filter((story) => story.module === "domestic").length;
  const visibleCategories = new Set(filteredStories.map((story) => story.category)).size;

  els.totalCount.textContent = state.stories.length;
  els.currentCount.textContent = filteredStories.length;
  els.domesticOverview.textContent = visibleDomestic;
  els.categoryOverview.textContent = visibleCategories;

  els.categoryCounts.forEach((node) => {
    const category = node.dataset.categoryCount;
    const count = category === "all"
      ? baseStories.length
      : baseStories.filter((story) => story.category === category).length;
    node.textContent = count;
  });
}

function renderNewsBoard(stories) {
  els.newsBoard.innerHTML = "";
  if (!stories.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.query ? "没有匹配的新闻。" : "暂无可显示新闻。";
    els.newsBoard.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  stories.slice(0, 20).forEach((story, index) => {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.classList.add(getCardSizeClass(index));
    node.href = story.link || "#";
    node.addEventListener("click", (event) => {
      event.preventDefault();
      openArticle(story);
    });
    node.querySelector(".source").textContent = story.source;
    node.querySelector(".category").textContent = getCategoryLabel(story.category);
    node.querySelector(".time").textContent = formatRelative(story.publishedAt);
    node.querySelector("h3").textContent = story.title;
    node.querySelector("p").textContent = story.summary;
    fragment.appendChild(node);
  });
  els.newsBoard.appendChild(fragment);
}

function getCardSizeClass(index) {
  const pattern = [
    "is-hero",
    "is-tall",
    "is-wide",
    "is-compact",
    "is-compact",
    "is-wide",
    "is-tall",
    "is-compact",
    "is-compact",
    "is-wide",
  ];
  return pattern[index % pattern.length];
}

async function openArticle(story) {
  state.activeArticle = story;
  renderArticleShell(story);
  els.articleDrawer.classList.add("is-open");
  els.articleDrawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("article-open");

  if (!story.link || story.link === "#") {
    renderArticleContent(story, null);
    return;
  }

  try {
    const response = await fetchWithTimeout(`/api/article?url=${encodeURIComponent(story.link)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const article = await response.json();
    if (state.activeArticle !== story) return;
    renderArticleContent(story, article);
  } catch (error) {
    renderArticleContent(story, null);
  }
}

function renderArticleShell(story) {
  els.articleSource.textContent = `${story.source} · ${getCategoryLabel(story.category)} · ${formatRelative(story.publishedAt)}`;
  els.articleTitle.textContent = story.title;
  els.articleSummary.textContent = story.summary;
  els.articleParagraphs.innerHTML = `<p class="article-loading">正在提取新闻导读...</p>`;
  els.articleNotice.textContent = "本站展示新闻导读和正文摘录，完整内容请查看原文。";
  els.articleOriginal.href = story.link || "#";
}

function renderArticleContent(story, article) {
  const title = article?.title || story.title;
  const summary = article?.description || story.summary;
  const paragraphs = Array.isArray(article?.paragraphs) && article.paragraphs.length
    ? article.paragraphs
    : [story.summary];

  els.articleTitle.textContent = title;
  els.articleSummary.textContent = summary;
  els.articleParagraphs.innerHTML = "";

  paragraphs.forEach((paragraph) => {
    const node = document.createElement("p");
    node.textContent = paragraph;
    els.articleParagraphs.appendChild(node);
  });

  els.articleNotice.textContent = article?.notice || "当前显示新闻摘要和正文摘录，完整内容请查看原文。";
  els.articleOriginal.href = article?.originalUrl || story.link || "#";
}

function closeArticle() {
  if (!els.articleDrawer.classList.contains("is-open")) return;
  state.activeArticle = null;
  els.articleDrawer.classList.remove("is-open");
  els.articleDrawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("article-open");
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

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || "综合";
}

function getText(item, selector) {
  const match = item.querySelector(selector);
  return match ? match.textContent.trim() : "";
}

function getLink(item) {
  const linkText = getText(item, "link");
  const linkHref = item.querySelector("link[href]")?.getAttribute("href");
  return linkHref || linkText || "#";
}

function getImage(item, articleUrl) {
  const candidates = [
    ...getMediaImages(item),
    ...getHtmlImages(getText(item, "description, summary, content")),
  ];

  return candidates
    .map((url) => normalizeImageUrl(url, articleUrl))
    .find((url) => isImageUrl(url)) || "";
}

function getMediaImages(item) {
  return [...item.querySelectorAll("enclosure[url], media\\:content[url], media\\:thumbnail[url], content[url], image url")]
    .map((node) => node.getAttribute("url") || node.textContent)
    .filter(Boolean);
}

function getHtmlImages(html) {
  return [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter(Boolean);
}

function normalizeImageUrl(url, articleUrl) {
  try {
    return new URL(url, articleUrl).href;
  } catch (error) {
    return "";
  }
}

function isImageUrl(url) {
  return /^https?:\/\//i.test(url) && !/(\.gif)(\?|$)/i.test(url);
}

function cleanText(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value || "";
  return textarea.value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function formatClock(date) {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(value) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function setStatus(type, text) {
  els.statusDot.className = `status-dot ${type === "loading" ? "" : type}`;
  els.statusText.textContent = text;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value).replaceAll("`", "&#096;");
}

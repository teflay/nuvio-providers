"use strict";
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// ============================================
// CONFIGURACIÓN
// ============================================
var BASE_URL = "https://4khdhub.one";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ============================================
// FUNCIONES DE RESOLUCIÓN DE HUBCLOUD/HUBDRIVE
// ============================================
function resolveHubCloud(driveUrl) {
    return __async(this, null, function* () {
        try {
            const driveHtml = yield fetchText(driveUrl);
            if (!driveHtml) return null;
            
            const downloadMatch = driveHtml.match(/<a\s+id=["']download["'][^>]*href=["']([^"']+)["']/i);
            if (!downloadMatch) return null;
            
            const resolverUrl = downloadMatch[1];
            if (!resolverUrl.startsWith("https://")) return null;
            
            const resolverHtml = yield fetchText(resolverUrl);
            if (!resolverHtml) return null;
            
            // Buscar enlaces de PixelDrain
            const pixelDrainMatches = resolverHtml.match(/https:\/\/pixeldrain\.(?:com|dev)\/(?:u|api\/file)\/[a-zA-Z0-9_-]+/g);
            if (pixelDrainMatches) {
                for (const match of pixelDrainMatches) {
                    const apiUrl = match.replace(/\/u\//, "/api/file/") + "?download";
                    const testResult = yield testUrl(apiUrl);
                    if (testResult) return apiUrl;
                }
            }
            
            // Buscar otros enlaces de descarga
            const linkMatches = resolverHtml.match(/<a[^>]+href=["']([^"']+)["']/g);
            if (linkMatches) {
                for (const link of linkMatches) {
                    const hrefMatch = link.match(/href=["']([^"']+)["']/);
                    if (!hrefMatch) continue;
                    let url = hrefMatch[1];
                    if (!url.startsWith("https://")) continue;
                    
                    const testResult = yield testUrl(url);
                    if (testResult) return url;
                }
            }
            
            return null;
        } catch (e) {
            console.log(`[4KHDHub] HubCloud resolution error: ${e.message}`);
            return null;
        }
    });
}

function resolveHubDrive(driveUrl) {
    return __async(this, null, function* () {
        try {
            const html = yield fetchText(driveUrl);
            if (!html) return null;
            
            const hubCloudMatch = html.match(/<a[^>]+href=["'](https?:\/\/[^"']*hubcloud\.[^"']*drive[^"']*)["']/i);
            if (!hubCloudMatch) return null;
            
            return yield resolveHubCloud(hubCloudMatch[1]);
        } catch (e) {
            console.log(`[4KHDHub] HubDrive resolution error: ${e.message}`);
            return null;
        }
    });
}

function testUrl(url) {
    return __async(this, null, function* () {
        try {
            const response = yield fetch(url, { 
                method: "HEAD",
                headers: {
                    "User-Agent": USER_AGENT,
                    "Referer": "https://4khdhub.one/"
                }
            });
            
            if (!response.ok) return false;
            
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("video/") || 
                contentType.includes("application/vnd.apple.mpegurl") ||
                url.includes(".mp4") || url.includes(".mkv") || url.includes(".m3u8")) {
                return true;
            }
            
            return false;
        } catch (e) {
            return false;
        }
    });
}

// ============================================
// FUNCIONES DE DOMINIO Y FETCH
// ============================================
function fetchLatestDomain() {
  return __async(this, null, function* () {
    return BASE_URL;
  });
}

function fetchText(url, options = {}) {
  return __async(this, arguments, function* (url, options = {}) {
    const retries = options.retries !== void 0 ? options.retries : 2;
    const delay = options.delay !== void 0 ? options.delay : 1e3;
    for (let i = 0; i <= retries; i++) {
      try {
        const response = yield fetch(url, {
          headers: __spreadValues({
            "User-Agent": USER_AGENT
          }, options.headers)
        });
        return yield response.text();
      } catch (err) {
        console.log(`[4KHDHub] Request failed for ${url}: ${err.message}${i < retries ? `, retrying (${i + 1}/${retries})...` : ""}`);
      }
      if (i < retries) {
        yield new Promise((r) => setTimeout(r, delay * Math.pow(2, i)));
      }
    }
    return null;
  });
}

// ============================================
// FUNCIONES DE TMDB
// ============================================
function getTmdbDetails(tmdbId, type) {
  return __async(this, null, function* () {
    const isSeries = type === "series" || type === "tv";
    const endpoint = isSeries ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    console.log(`[4KHDHub] Fetching TMDB details from: ${url}`);
    try {
      const response = yield fetch(url);
      const data = yield response.json();
      if (isSeries) {
        return {
          title: data.name,
          year: data.first_air_date ? parseInt(data.first_air_date.split("-")[0]) : 0
        };
      } else {
        return {
          title: data.title,
          year: data.release_date ? parseInt(data.release_date.split("-")[0]) : 0
        };
      }
    } catch (error) {
      console.log(`[4KHDHub] TMDB request failed: ${error.message}`);
      return null;
    }
  });
}

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================
function atob(input) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let str = String(input).replace(/=+$/, "");
  if (str.length % 4 === 1) {
    throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
  }
  let output = "";
  for (let bc = 0, bs, buffer, i = 0; buffer = str.charAt(i++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

function rot13Cipher(str) {
  return str.replace(/[a-zA-Z]/g, function(c) {
    return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
  });
}

function levenshteinDistance(s, t) {
  if (s === t) return 0;
  const n = s.length;
  const m = t.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const d = [];
  for (let i = 0; i <= n; i++) {
    d[i] = [];
    d[i][0] = i;
  }
  for (let j = 0; j <= m; j++) {
    d[0][j] = j;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = s.charAt(i - 1) === t.charAt(j - 1) ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[n][m];
}

function parseBytes(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const match = val.match(/^([0-9.]+)\s*([a-zA-Z]+)$/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  let multiplier = 1;
  if (unit.indexOf("k") === 0) multiplier = 1024;
  else if (unit.indexOf("m") === 0) multiplier = 1024 * 1024;
  else if (unit.indexOf("g") === 0) multiplier = 1024 * 1024 * 1024;
  else if (unit.indexOf("t") === 0) multiplier = 1024 * 1024 * 1024 * 1024;
  return num * multiplier;
}

function formatBytes(val) {
  if (val === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  let i = Math.floor(Math.log(val) / Math.log(k));
  if (i < 0) i = 0;
  return parseFloat((val / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// ============================================
// FUNCIÓN DE BÚSQUEDA DE PÁGINA
// ============================================
var cheerio = require("cheerio-without-node-native");

function fetchPageUrl(name, year, isSeries) {
  return __async(this, null, function* () {
    const domain = yield fetchLatestDomain();
    const searchUrl = `${domain}/?s=${encodeURIComponent(name + " " + year)}`;
    console.log(`[4KHDHub] Search Request URL: ${searchUrl}`);
    const html = yield fetchText(searchUrl);
    if (!html) {
      console.log("[4KHDHub] Search failed: No HTML response");
      return null;
    }
    const $ = cheerio.load(html);
    const targetType = isSeries ? "Series" : "Movies";
    console.log(`[4KHDHub] Parsing search results for type: ${targetType}`);
    
    const matchingCards = $(".movie-card").filter((_, el) => {
      const link = $(el).find("a").attr("href") || "";
      const yearMatch = link.includes(String(year)) || 
                        $(el).text().includes(String(year));
      const isSeriesMatch = link.includes("/category/series/") || 
                            link.includes("tv") ||
                            $(el).text().toLowerCase().includes("series");
      const isMovieMatch = link.includes("/category/movies/") || 
                           link.includes("movie") ||
                           $(el).text().toLowerCase().includes("movie");
      const typeMatch = isSeries ? isSeriesMatch : isMovieMatch;
      return yearMatch && typeMatch;
    }).map((_, el) => {
      let href = $(el).find("a").attr("href");
      if (!href) {
        href = $(el).attr("href") || $(el).find("a").first().attr("href");
      }
      if (href && !href.startsWith("http")) {
        href = domain + (href.startsWith("/") ? "" : "/") + href;
      }
      return href;
    }).get();
    
    console.log(`[4KHDHub] Found ${matchingCards.length} matching cards`);
    return matchingCards.length > 0 ? matchingCards[0] : null;
  });
}

// ============================================
// FUNCIÓN DE EXTRACCIÓN DE FUENTES
// ============================================
function extractSourceResults($, el) {
  return __async(this, null, function* () {
    const localHtml = $(el).html();
    const sizeMatch = localHtml.match(/([\d.]+ ?[GM]B)/);
    const heightMatch = localHtml.match(/\d{3,}p/);
    const title = $(el).find(".file-title, .episode-file-title").text().trim();
    
    let height = heightMatch ? parseInt(heightMatch[0]) : 0;
    if (height === 0 && (title.includes("4K") || title.includes("4k") || localHtml.includes("4K") || localHtml.includes("4k"))) {
      height = 2160;
    }
    
    const meta = {
      bytes: sizeMatch ? parseBytes(sizeMatch[1]) : 0,
      height,
      title
    };
    
    const links = $(el).find("a").map((_, a) => {
      const href = $(a).attr("href");
      const text = $(a).text();
      return { href, text };
    }).get();
    
    const relevantLinks = links.filter(link => {
      const href = link.href || "";
      const text = link.text || "";
      return href.includes("hubcloud.") || 
             href.includes("hubdrive.") ||
             href.includes("pixeldrain") ||
             href.includes(".mp4") ||
             href.includes(".mkv") ||
             href.includes(".m3u8") ||
             text.includes("HubCloud") ||
             text.includes("HubDrive") ||
             text.includes("PixelDrain") ||
             text.includes("10Gbps") ||
             text.includes("Direct");
    });
    
    if (relevantLinks.length === 0) return null;
    
    const primaryLink = relevantLinks[0];
    let url = primaryLink.href;
    
    if (url.includes("hubcloud.")) {
      const resolved = yield resolveHubCloud(url);
      if (resolved) return { url: resolved, meta };
    } else if (url.includes("hubdrive.")) {
      const resolved = yield resolveHubDrive(url);
      if (resolved) return { url: resolved, meta };
    }
    
    if (url.includes(".mp4") || url.includes(".mkv") || url.includes(".m3u8") || url.includes("pixeldrain")) {
      const valid = yield testUrl(url);
      if (valid) return { url, meta };
    }
    
    return null;
  });
}

// ============================================
// FUNCIÓN PRINCIPAL getStreams
// ============================================
var cheerio3 = require("cheerio-without-node-native");

function getStreams(tmdbId, type, season, episode) {
  return __async(this, null, function* () {
    const tmdbDetails = yield getTmdbDetails(tmdbId, type);
    if (!tmdbDetails) return [];
    const { title, year } = tmdbDetails;
    console.log(`[4KHDHub] Search: ${title} (${year})`);
    const isSeries = type === "series" || type === "tv";
    const pageUrl = yield fetchPageUrl(title, year, isSeries);
    if (!pageUrl) {
      console.log("[4KHDHub] Page not found");
      return [];
    }
    console.log(`[4KHDHub] Found page: ${pageUrl}`);
    const html = yield fetchText(pageUrl);
    if (!html) return [];
    const $ = cheerio3.load(html);
    const itemsToProcess = [];
    if (isSeries && season && episode) {
      const seasonStr = "S" + String(season).padStart(2, "0");
      const episodeStr = "Episode-" + String(episode).padStart(2, "0");
      $(".episode-item").each((_, el) => {
        if ($(".episode-title", el).text().includes(seasonStr)) {
          const downloadItems = $(".episode-download-item", el).filter((_2, item) => $(item).text().includes(episodeStr));
          downloadItems.each((_2, item) => {
            itemsToProcess.push(item);
          });
        }
      });
    } else {
      $(".download-item").each((_, el) => {
        itemsToProcess.push(el);
      });
    }
    console.log(`[4KHDHub] Processing ${itemsToProcess.length} items`);
    const streamPromises = itemsToProcess.map((item) => __async(this, null, function* () {
      try {
        const sourceResult = yield extractSourceResults($, item);
        if (sourceResult && sourceResult.url) {
          console.log(`[4KHDHub] Extracted URL: ${sourceResult.url}`);
          const stream = {
            name: `4KHDHub - ${sourceResult.meta.height ? `${sourceResult.meta.height}p` : "Unknown"}`,
            title: sourceResult.meta.title || "4KHDHub Stream",
            url: sourceResult.url,
            quality: sourceResult.meta.height ? `${sourceResult.meta.height}p` : undefined,
            behaviorHints: {
              bingeGroup: "4khdhub",
              proxyHeaders: false,
              notWebVideo: false,
            }
          };
          return [stream];
        }
        return [];
      } catch (err) {
        console.log(`[4KHDHub] Item processing error: ${err.message}`);
        return [];
      }
    }));
    const results = yield Promise.all(streamPromises);
    return results.reduce((acc, val) => acc.concat(val), []);
  });
}

module.exports = { getStreams };

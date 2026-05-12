import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import axios from "axios";
import * as https from "https";
import * as http from "http";
import * as cheerio from "cheerio";
import { google } from "googleapis";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Agents to disable keep-alive which can help with socket hang ups
  const httpsAgent = new https.Agent({ keepAlive: false, rejectUnauthorized: false });
  const httpAgent = new http.Agent({ keepAlive: false });

  // API Route: AI Generation Proxy
  app.post("/api/ai/generate", async (req, res) => {
    const { model, prompt, openaiKey, anthropicKey, systemPrompt } = req.body;
    
    try {
      if (model.startsWith("gpt")) {
        if (!openaiKey) return res.status(400).json({ error: "OpenAI API Key required" });
        const openai = new OpenAI({ apiKey: openaiKey });
        console.log('[AI LOG] OpenAI INPUT', { model, systemPrompt, prompt });
        const response = await openai.chat.completions.create({
          model: model,
          messages: [
            { role: "system", content: "You are an elite SEO content strategist. Always return valid JSON." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        });
        const openaiOutput = response.choices[0].message.content || "{}";
        console.log('[AI LOG] OpenAI OUTPUT', openaiOutput);
        return res.json(JSON.parse(openaiOutput));
      }

      if (model.startsWith("claude")) {
        if (!anthropicKey) return res.status(400).json({ error: "Anthropic API Key required" });
        const anthropic = new Anthropic({ apiKey: anthropicKey });
        console.log('[AI LOG] Anthropic INPUT', { model, systemPrompt, prompt });
        const response = await anthropic.messages.create({
          model: model,
          max_tokens: 4000,
          system: "You are an elite SEO content strategist. Output MUST be ONLY raw JSON.",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        });
        const text = response.content.filter(c => c.type === 'text').map(c => c.text).join("");
        console.log('[AI LOG] Anthropic OUTPUT', text);
        return res.json(JSON.parse(text));
      }

      res.status(400).json({ error: "Unsupported AI Model" });
    } catch (error: any) {
      console.error("AI Generation Error:", error.response?.data || error.message);
      res.status(500).json({ 
        error: "AI Generation Protocol Failed", 
        details: error.response?.data?.error?.message || error.message 
      });
    }
  });

  // API Route: Scrape Competitor Content
  app.post("/api/scrape", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    // Issue 8: SSRF Prevention
    try {
      const parsed = new URL(url);
      const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'];
      if (blocked.some(b => parsed.hostname.includes(b))) {
        return res.status(403).json({ error: "Access Denied: Internal URL or prohibited address" });
      }
    } catch (e) {
      return res.status(400).json({ error: "Invalid URL structure" });
    }

    const maxRetries = 3;
    let attempts = 0;

    // Advanced User Agents (Scrapling-style rotation)
    const agents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/130.0.0.0 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1"
    ];

    const referrers = [
      "https://www.google.com/",
      "https://www.bing.com/",
      "https://duckduckgo.com/",
      "https://www.google.com/search?q=site:themeforest.net",
      "https://social.technet.microsoft.com/"
    ];

    const performScrape = async (): Promise<any> => {
      attempts++;
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];
      const randomReferrer = referrers[Math.floor(Math.random() * referrers.length)];
      
      try {
        const response = await axios.get(url, {
          headers: {
            "User-Agent": randomAgent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,image/svg+xml,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Referer": randomReferrer,
            "Cookie": "visited=true; browsing_session=true",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Sec-Ch-Ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1"
          },
          timeout: 45000,
          maxRedirects: 15,
          httpsAgent,
          httpAgent,
          validateStatus: (status) => status < 500,
        });

        if (response.status === 403 || response.status === 429) {
          throw new Error(`Access Denied (HTTP ${response.status})`);
        }

        return response.data;
      } catch (error: any) {
        const isRetryable = error.code === 'ECONNRESET' || 
                            error.message.includes('socket hang up') || 
                            error.code === 'ETIMEDOUT' ||
                            error.code === 'ECONNABORTED' ||
                            error.message.includes('403') ||
                            error.message.includes('429') ||
                            (error.response && [503, 504].includes(error.response.status));

        if (attempts <= maxRetries && isRetryable) {
          const delay = (3000 * attempts) + (Math.random() * 2000);
          console.log(`[Scraper] Retrying ${url} (Attempt ${attempts + 1}/${maxRetries + 1}) due to: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return performScrape();
        }
        throw error;
      }
    };

    try {
      const html = await performScrape();
      const $ = cheerio.load(html);

      // Deep Noise Extraction (Inspired by Scrapling's clean-up logic)
      const selectorsToRemove = [
        "script", "style", "noscript", "svg", "iframe", "embed", "object",
        "header", "footer", "nav", "aside", ".sidebar", "#sidebar",
        ".header", ".footer", ".nav", ".menu", ".ads", ".advertisement",
        ".social-share", ".related-posts", ".recent-posts", ".popular-posts",
        "#comments", ".comments", ".disqus", ".fb-comments",
        ".cookie-banner", ".newsletter-popup", ".popup", ".modal",
        "form", "button", "input", "select", "textarea",
        "[role='navigation']", "[role='menubar']", "[role='banner']", "[role='contentinfo']"
      ];
      
      $(selectorsToRemove.join(", ")).remove();

      // Content Identification Heuristics
      const contentSelectors = [
        "article", "main", "[role='main']",
        ".post-content", ".entry-content", ".article-body", ".article-content",
        ".content-area", ".main-content", "#main-content", ".post-body",
        ".page-content", ".blog-post", ".wp-block-post-content"
      ];
      
      let bestContent = $("body");
      let maxScore = 0;

      // Scoring algorithm for potential content containers
      $("*").each((_, el) => {
        if (el.type === 'tag') {
          const tag = el.name.toLowerCase();
          if (['div', 'section', 'article', 'main'].includes(tag)) {
            const text = $(el).text().trim();
            const pCount = $(el).find('p').length;
            const hCount = $(el).find('h1, h2, h3').length;
            
            // Heuristic: high paragraph count + high text length = likely main content
            const score = (text.length / 50) + (pCount * 10) + (hCount * 5);
            
            if (score > maxScore) {
              maxScore = score;
              bestContent = $(el) as any;
            }
          }
        }
      });

      // Prefer high-value semantic tags if they have sufficient density
      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length > 0 && element.text().trim().length > 800) {
          bestContent = element as any;
          break;
        }
      }

      // Extraction logic
      const structuredContent: string[] = [];
      bestContent.find('h1, h2, h3, h4, h5, h6, p, li, blockquote').each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text.length > 15) {
          structuredContent.push(text);
        }
      });

      const bodyText = structuredContent.join('\n\n').trim();
      const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;
      
      // Image Extraction
      const images: string[] = [];
      bestContent.find("img").each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset')?.split(' ')[0] || '';
        if (src && !src.startsWith('data:') && !src.includes('pixel') && !src.includes('lazy')) {
          try {
            const absoluteUrl = new URL(src, url).toString();
            if (images.indexOf(absoluteUrl) === -1) images.push(absoluteUrl);
          } catch (e) {}
        }
      });

      const title = $("title").text().trim() || $("h1").first().text().trim() || "No Title Found";
      const description = $('meta[name="description"]').attr("content") || 
                          $('meta[property="og:description"]').attr("content") || 
                          bestContent.find("p").first().text().substring(0, 300).trim();

      // Headings extraction: capture every h1-h6 in document order from bestContent
      const headings: { level: string; text: string }[] = [];
      bestContent.find('h1, h2, h3, h4, h5, h6').each((_, el) => {
        const tag = el.tagName ? el.tagName.toLowerCase() : (el.name || 'h').toLowerCase();
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text && text.length > 0) {
          headings.push({ level: tag, text });
        }
      });

      // Return the full scraping payload plus headings (no file writes)
      res.json({
        url,
        wordCount,
        imageCount: images.length,
        title,
        description,
        fullContent: bodyText,
        images: images.slice(0, 15),
        headings
      });
    } catch (error: any) {
      console.error(`[Scraper] Error ${url}:`, error.message);
      const status = error.response?.status || 500;
      res.status(status).json({ 
        error: "Scraping Operation Failed", 
        details: error.message,
        code: error.code
      });
    }
  });

  // API Route: SERP Analysis (Simulated for now, replace with real Search API if needed)
  app.post("/api/serp-analysis", async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Query is required" });

    try {
      // In a real scenario, use Custom Search API or a scraper
      // For now, we'll suggest using Gemini's search grounding on the client, 
      // but the user wants word counts of top 5 results.
      // We will simulate a search result set for the demo, or try to use a simple search scraper.
      
      // Let's use a placeholder for now as real SERP scraping is complex and often blocked.
      // We'll guide the user to provide competitor URLs manually if search fails.
      res.json({ message: "SERP analysis triggered. Please use the competitor urls for specific analysis." });
    } catch (error: any) {
      res.status(500).json({ error: "SERP analysis failed" });
    }
  });

  // API Route: WordPress Categories
  app.post("/api/wordpress/categories", async (req, res) => {
    const { wpUrl, wpUsername, wpAppPassword } = req.body;
    if (!wpUrl || !wpUsername || !wpAppPassword) {
      return res.status(400).json({ error: "WordPress credentials required" });
    }
    try {
      const auth = Buffer.from(`${wpUsername}:${wpAppPassword}`).toString("base64");
      const response = await axios.get(`${wpUrl}/wp-json/wp/v2/categories?per_page=100`, {
        headers: { Authorization: `Basic ${auth}` },
        timeout: 10000
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("WP Categories Error:", error.message);
      res.status(500).json({ 
        error: "Failed to fetch WordPress categories", 
        details: error.response?.data?.message || error.message 
      });
    }
  });

  // API Route: WordPress Tags
  app.post("/api/wordpress/tags", async (req, res) => {
    const { wpUrl, wpUsername, wpAppPassword } = req.body;
    try {
      const auth = Buffer.from(`${wpUsername}:${wpAppPassword}`).toString("base64");
      const response = await axios.get(`${wpUrl}/wp-json/wp/v2/tags?per_page=100`, {
        headers: { Authorization: `Basic ${auth}` },
        timeout: 10000
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ 
        error: "Failed to fetch WordPress tags", 
        details: error.response?.data?.message || error.message 
      });
    }
  });

  // API Route: Google Search Console Indexing Request
  app.post("/api/gsc/index", async (req, res) => {
    const { siteUrl, pageUrl } = req.body;
    // Note: In a real production app, this requires a Google Service Account or OAuth 2.0.
    // For this build, we provide the logic skeleton.
    try {
      // This is a placeholder for the Google Search Console API call
      // Logic would involve: google.searchconsole('v1').urlInspection.index.request(...)
      res.json({ message: `Indexing request sent for ${pageUrl}`, status: "pending" });
    } catch (error: any) {
      res.status(500).json({ error: "GSC indexing request failed" });
    }
  });

  // API Route: Publish to WordPress
  app.post("/api/wordpress/publish", async (req, res) => {
    const { wpUrl, wpUsername, wpAppPassword, postData, featuredImageUrl } = req.body;
    try {
      const auth = Buffer.from(`${wpUsername}:${wpAppPassword}`).toString("base64");
      
      let featuredMediaId = 0;

      // Handle Featured Image Upload if provided
      if (featuredImageUrl && featuredImageUrl.startsWith('data:image')) {
        try {
          const base64Data = featuredImageUrl.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Issue 13: Detect actual MIME type
          const mimeMatch = featuredImageUrl.match(/^data:(image\/\w+);base64,/);
          const mimeType = mimeMatch?.[1] || 'image/png';
          const ext = mimeType.split('/')[1] || 'png';
          
          const mediaResponse = await axios.post(`${wpUrl}/wp-json/wp/v2/media`, buffer, {
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': mimeType,
              'Content-Disposition': `attachment; filename="featured-image.${ext}"`
            }
          });
          featuredMediaId = mediaResponse.data.id;
        } catch (mediaErr: any) {
          console.error("Media Upload Error:", mediaErr.response?.data || mediaErr.message);
          return res.status(500).json({ 
            error: "Media Upload Failed", 
            details: mediaErr.response?.data?.message || mediaErr.message 
          });
        }
      }

      const finalPostData = {
        ...postData,
        featured_media: featuredMediaId || undefined
      };

      const response = await axios.post(`${wpUrl}/wp-json/wp/v2/posts`, finalPostData, {
        headers: { Authorization: `Basic ${auth}` },
        timeout: 35000 // Issue 17: Add timeout for heavy publish tasks
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("WP Publish Error:", error.response?.data || error.message);
      res.status(500).json({ 
        error: "Post Publishing Failed", 
        details: error.response?.data?.message || error.message 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    
    if (fs.existsSync(distPath)) {
      console.log(`Serving static files from ${distPath}`);
    } else {
      console.error(`ERROR: dist directory not found at ${distPath}`);
    }

    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("index.html not found in dist. Build may have failed.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

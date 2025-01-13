import axios from 'axios';
import { parse } from 'node-html-parser';
import fs from 'fs/promises';
import path from 'path';

// Define base URLs and their documentation paths
const DOCS_SOURCES = [
  {
    base: 'https://segment.com',
    paths: [
      '/docs/connections/',
      '/docs/connections/sources/',
      '/docs/connections/destinations/',
      '/docs/protocols/',
    ]
  },
  {
    base: 'https://docs.mparticle.com',
    paths: [
      '/developers/',
      '/guides/',
      '/integrations/',
    ]
  }
];

async function scrapeUrl(baseUrl, path) {
  try {
    const url = baseUrl + path;
    console.log(`Scraping ${url}...`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    
    const root = parse(response.data);
    
    // Remove unwanted elements
    const elementsToRemove = [
      'script', 'style', 'nav', 'header', 'footer',
      '.navigation', '.sidebar', '.menu', '.footer',
      '#navigation', '#sidebar', '#menu', '#footer'
    ];
    
    elementsToRemove.forEach(selector => {
      root.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    // Extract main content more effectively
    const mainContent = root.querySelector('main, article, .content, .documentation, #content, #main, .main-content');
    let content = '';
    
    if (mainContent) {
      content = mainContent.textContent;
    } else {
      // Fallback to getting content from specific elements
      const contentElements = root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, div.content');
      content = contentElements.map(el => el.textContent).join(' ');
    }
    
    // Clean up the content
    const cleanContent = content
      .replace(/\\s+/g, ' ')
      .replace(/\\n+/g, ' ')
      .trim();
    
    // Get title from meta tags first, then h1, then fallback to URL
    const metaTitle = root.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                     root.querySelector('meta[name="title"]')?.getAttribute('content');
    const h1Title = root.querySelector('h1')?.textContent;
    const title = metaTitle || h1Title || path.split('/').pop() || 'Untitled';

    return {
      url,
      title: title.trim(),
      content: cleanContent,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error scraping ${baseUrl}${path}:`, error.message);
    return null;
  }
}

async function recursiveScrape(baseUrl, path, visited = new Set(), maxDepth = 3) {
  const url = baseUrl + path;
  if (visited.has(url) || visited.size >= 50 || maxDepth <= 0) return [];
  visited.add(url);

  const data = await scrapeUrl(baseUrl, path);
  if (!data) return [];

  const results = [data];

  try {
    const root = parse(data.content);
    const links = root.querySelectorAll('a')
      .map(a => a.getAttribute('href'))
      .filter(href => href && href.startsWith('/docs/'))
      .filter(href => !visited.has(baseUrl + href));

    for (const link of links.slice(0, 5)) { // Limit to 5 links per page
      const subResults = await recursiveScrape(baseUrl, link, visited, maxDepth - 1);
      results.push(...subResults);
    }
  } catch (error) {
    console.error(`Error parsing links from ${url}:`, error.message);
  }

  return results;
}

async function main() {
  try {
    await fs.mkdir('data').catch(() => {});
    
    for (const source of DOCS_SOURCES) {
      console.log(`\nStarting to scrape ${source.base}...`);
      const results = [];
      
      for (const path of source.paths) {
        const pageResults = await recursiveScrape(source.base, path);
        results.push(...pageResults);
      }
      
      if (results.length > 0) {
        const filename = `data/${new URL(source.base).hostname}.json`;
        await fs.writeFile(filename, JSON.stringify(results, null, 2));
        console.log(`Saved ${results.length} pages to ${filename}`);
      }
    }
    
    console.log('\nScraping completed!');
  } catch (error) {
    console.error('Scraping failed:', error);
    process.exit(1);
  }
}

main();
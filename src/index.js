import express from 'express';
import fs from 'fs/promises';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

let docsIndex = [];

async function loadDocs() {
  try {
    const dataDir = await fs.readdir('data');
    for (const file of dataDir) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(`data/${file}`, 'utf-8');
        const docs = JSON.parse(content);
        if (Array.isArray(docs)) {
          docsIndex = docsIndex.concat(docs.map(doc => ({
            ...doc,
            content: doc.content || '',
            title: doc.title || 'Untitled',
            url: doc.url || '#',
            source: file.replace('.json', '')
          })));
        }
      }
    }
    console.log('Documentation loaded:', docsIndex.length, 'documents');
  } catch (error) {
    console.error('Error loading docs:', error);
  }
}

// Improved relevance scoring with semantic matching
function findRelevantDocs(query) {
  if (!query || !docsIndex.length) return [];
  
  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
  const queryWords = new Set(searchTerms);
  
  return docsIndex
    .map(doc => {
      const content = doc.content.toLowerCase();
      const title = doc.title.toLowerCase();
      const words = new Set(content.split(/\W+/));
      
      // Calculate semantic relevance score
      let score = 0;
      
      // Title matches (highest weight)
      searchTerms.forEach(term => {
        if (title.includes(term)) score += 10;
      });
      
      // Exact phrase matches in content
      if (content.includes(query.toLowerCase())) {
        score += 8;
      }
      
      // Word proximity score
      let lastIndex = -1;
      let proximityScore = 0;
      searchTerms.forEach(term => {
        const index = content.indexOf(term);
        if (index !== -1) {
          if (lastIndex !== -1 && index - lastIndex < 50) {
            proximityScore += 5;
          }
          lastIndex = index;
        }
      });
      score += proximityScore;
      
      // Individual word matches
      const matchedWords = [...words].filter(word => queryWords.has(word));
      score += matchedWords.length * 2;
      
      return { ...doc, score };
    })
    .filter(doc => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // Reduce to top 3 most relevant docs
}

async function searchDocs(query) {
  try {
    if (!query) {
      return [{
        title: 'Invalid Query',
        content: 'Please provide a search query.',
        url: '#'
      }];
    }

    const relevantDocs = findRelevantDocs(query);

    if (relevantDocs.length === 0) {
      return [{
        title: 'No Results Found',
        content: 'No documentation matches your query. Please try a different search term.',
        url: '#'
      }];
    }

    // Enhanced context preparation with document structure
    const context = relevantDocs
      .map(doc => {
        const sections = doc.content
          .split(/(?=[A-Z][a-z]+:)/)
          .filter(section => section.trim().length > 0);
        
        return `Source: ${doc.source}
Title: ${doc.title}
URL: ${doc.url}
Content Sections:
${sections.map(section => `- ${section.trim()}`).join('\n')}`;
      })
      .join('\n\n---\n\n');

    try {
      const response = await axios.post('https://api.perplexity.ai/chat/completions', {
        model: 'mixtral-8x7b-instruct',
        messages: [
          {
            role: "system",
            content: "You are a CDP documentation expert. Your task is to provide precise, relevant answers based on the provided documentation context. Follow these rules:\n1. Only answer what's directly supported by the documentation\n2. If the exact answer isn't in the docs, say so clearly\n3. Include specific references to relevant documentation sections\n4. Keep answers focused and concise\n5. If multiple docs are relevant, synthesize the information clearly"
          },
          {
            role: "user",
            content: `Documentation Context:\n\n${context}\n\nQuestion: ${query}\n\nProvide a specific answer based only on the documentation above. If the exact answer isn't in the docs, say so clearly.`
          }
        ]
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      return [
        {
          title: 'AI-Generated Answer',
          content: response.data.choices[0].message.content,
          url: relevantDocs[0].url
        },
        ...relevantDocs.map(doc => ({
          title: doc.title,
          content: doc.content.substring(0, 200) + '...',
          url: doc.url,
          source: doc.source
        }))
      ];
    } catch (perplexityError) {
      console.error('Perplexity API error:', perplexityError);
      return relevantDocs.map(doc => ({
        title: doc.title,
        content: doc.content.substring(0, 200) + '...',
        url: doc.url
      }));
    }
  } catch (error) {
    console.error('Search error:', error);
    return [{
      title: 'Error',
      content: 'An error occurred while searching the documentation. Please try again.',
      url: '#'
    }];
  }
}

app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Query parameter required' });
  }
  
  const results = await searchDocs(q);
  res.json(results);
});

loadDocs().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    if (!process.env.PERPLEXITY_API_KEY) {
      console.log('Warning: Perplexity API key not found. Running in basic search mode only.');
    } else {
      console.log('AI-enhanced search enabled with Perplexity');
    }
  });
});
const express = require('express');
const { getHandler } = require('./handlers');
const { fetchPage, closeBrowser } = require('./browser');

const app = express();
const PORT = 3003;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (Object.keys(req.body).length > 0) {
    console.log('Payload:', JSON.stringify(req.body, null, 2));
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/scrape', async (req, res) => {
  const { url, handler, metadata } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const html = await fetchPage(url);

    const priceHandler = getHandler(url, handler);
    const result = await priceHandler.extractPrice(html, url);

    if (result) {
      res.json({
        success: true,
        url,
        ...result,
        metadata,
      });
    } else {
      res.json({
        success: false,
        url,
        error: 'Could not extract price',
        metadata,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      url,
      error: error.message,
      metadata,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

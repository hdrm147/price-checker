async function extractPrice(html, url) {
  // Extract item ID from URL: https://miswag.com/products/1756119588 or https://miswag.com/en/products/1756119588
  const match = url.match(/\/products\/(\d+)/);
  if (!match) {
    console.log('Miswag: Could not extract item ID from URL');
    return null;
  }

  const itemId = match[1];
  const apiUrl = `https://ganesh-lama.miswag.com/content/v1/public/meta/items/${itemId}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'ar',
        'Client-Id': '4',
      },
    });

    if (!response.ok) {
      console.log(`Miswag API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Price is in data.data.info.price (in IQD, already as integer)
    const info = data?.data?.info;
    const price = info?.price || info?.original_price;

    if (price) {
      console.log(`Miswag API price: ${price} IQD`);
      return { price: String(price), currency: 'IQD', raw: `${price} IQD` };
    }

    console.log('Miswag: No price in API response');
    return null;
  } catch (error) {
    console.log(`Miswag API fetch error: ${error.message}`);
    return null;
  }
}

module.exports = { extractPrice };

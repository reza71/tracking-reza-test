export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { order_number } = req.body;
    
    if (!order_number) {
      return res.status(400).json({ error: 'order_number is required' });
    }

    const shop = process.env.SHOPIFY_SHOP;
    const token = process.env.SHOPIFY_ADMIN_API_TOKEN;
    
    // Check if environment variables are set
    if (!shop || !token) {
      console.error('Missing environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error: Missing Shopify credentials' 
      });
    }

    // 1. Search for order by name
    const searchUrl = `https://${shop}/admin/api/2024-01/orders.json?name=${encodeURIComponent('#' + order_number)}`;
    console.log('Searching for order:', searchUrl);
    
    const searchRes = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    if (!searchRes.ok) {
      console.error('Shopify API error:', searchRes.status, searchRes.statusText);
      return res.status(searchRes.status).json({ 
        error: `Failed to search order: ${searchRes.statusText}` 
      });
    }

    const searchData = await searchRes.json();
    
    if (!searchData.orders || searchData.orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = searchData.orders[0];
    const orderId = order.id;

    // 2. Get existing tags
    let tags = order.tags ? order.tags.split(',').map(t => t.trim()) : [];

    // 3. Add Delivered tag if not already present
    if (!tags.includes('Delivered')) {
      tags.push('Delivered');
    }

    // 4. Update order with new tags
    const updateUrl = `https://${shop}/admin/api/2024-01/orders/${orderId}.json`;
    console.log('Updating order:', updateUrl);
    
    const updateRes = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order: {
          id: orderId,
          tags: tags.join(', '),
        },
      }),
    });

    if (!updateRes.ok) {
      console.error('Shopify update error:', updateRes.status, updateRes.statusText);
      const errorData = await updateRes.text();
      return res.status(updateRes.status).json({
        error: 'Failed to update order',
        details: errorData.substring(0, 200) + '...',
      });
    }

    const updateData = await updateRes.json();

    return res.status(200).json({
      success: true,
      message: `Order #${order_number} updated with Delivered tag`,
      order: updateData.order,
    });
    
  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      details: err.message 
    });
  }
}

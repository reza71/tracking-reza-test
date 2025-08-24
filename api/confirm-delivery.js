// pages/api/confirm-delivery.js
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
    let { order_number } = req.body;
    
    if (!order_number) {
      return res.status(400).json({ error: 'order_number is required' });
    }

    // Remove any existing # symbol to avoid double ##
    order_number = order_number.replace(/^#/, '');
    console.log('Processing order number:', order_number);

    // Use consistent environment variable names
    const shop = process.env.SHOPIFY_SHOP || process.env.SHOPIFY_STORE_DOMAIN;
    const token = process.env.SHOPIFY_ADMIN_API_TOKEN || process.env.SHOPIFY_ADMIN_API_KEY;
    
    // Check if environment variables are set
    if (!shop || !token) {
      console.error('Missing environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error: Missing Shopify credentials',
        details: `SHOPIFY_SHOP: ${shop ? 'Set' : 'Missing'}, SHOPIFY_ADMIN_API_TOKEN: ${token ? 'Set' : 'Missing'}`
      });
    }

    // Use consistent API version
    const apiVersion = '2024-01';
    
    // Try searching with both formats (# prefix and without)
    let searchData;
    let order = null;
    
    // Try with # prefix first (this is how Shopify stores it)
    let searchUrl = `https://${shop}/admin/api/${apiVersion}/orders.json?name=${encodeURIComponent('#' + order_number)}`;
    console.log('Searching for order with #:', searchUrl);
    
    let searchRes = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    if (searchRes.ok) {
      searchData = await searchRes.json();
      console.log('Search response:', JSON.stringify(searchData, null, 2));
      
      if (searchData.orders && searchData.orders.length > 0) {
        order = searchData.orders[0];
        console.log('Found order with #:', order.name);
      }
    }

    // If not found with #, try without #
    if (!order) {
      searchUrl = `https://${shop}/admin/api/${apiVersion}/orders.json?name=${encodeURIComponent(order_number)}`;
      console.log('Searching for order without #:', searchUrl);
      
      searchRes = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json',
        },
      });

      if (searchRes.ok) {
        searchData = await searchRes.json();
        console.log('Search response:', JSON.stringify(searchData, null, 2));
        
        if (searchData.orders && searchData.orders.length > 0) {
          order = searchData.orders[0];
          console.log('Found order without #:', order.name);
        }
      }
    }

    // If still not found, try using the Orders API with status=any
    if (!order) {
      searchUrl = `https://${shop}/admin/api/${apiVersion}/orders.json?status=any`;
      console.log('Searching all orders:', searchUrl);
      
      searchRes = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json',
        },
      });

      if (searchRes.ok) {
        searchData = await searchRes.json();
        console.log('All orders response:', searchData.orders ? searchData.orders.length : 0, 'orders found');
        
        // Manual search through all orders
        if (searchData.orders && searchData.orders.length > 0) {
          order = searchData.orders.find(o => 
            o.name === `#${order_number}` || 
            o.name === order_number ||
            o.order_number === parseInt(order_number)
          );
          
          if (order) {
            console.log('Found order in all orders:', order.name);
          }
        }
      }
    }

    // If still not found, return error
    if (!order) {
      console.error('Order not found with any format');
      return res.status(404).json({ 
        error: 'Order not found',
        details: `Searched for orders with name: #${order_number} and ${order_number}. Check if the order exists in Shopify.`
      });
    }

    const orderId = order.id;
    console.log('Found order:', orderId, order.name);

    // 2. Get existing tags
    let tags = order.tags ? order.tags.split(',').map(t => t.trim()) : [];

    // 3. Add Delivered tag if not already present
    if (!tags.includes('Delivered')) {
      tags.push('Delivered');
      console.log('Adding Delivered tag to order');
    } else {
      console.log('Order already has Delivered tag');
    }

    // 4. Update order with new tags
    const updateUrl = `https://${shop}/admin/api/${apiVersion}/orders/${orderId}.json`;
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
    console.log('Order updated successfully:', updateData.order.name);

    return res.status(200).json({
      success: true,
      message: `Order ${updateData.order.name} updated with Delivered tag`,
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

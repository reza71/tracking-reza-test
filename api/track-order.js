// api/track-order.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orderNumber } = req.body;

  if (!orderNumber) {
    return res.status(400).json({ error: 'Order number is required' });
  }

  try {
    // Konfigurasi dari environment variables
    const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN;
    const adminApiKey = process.env.SHOPIFY_ADMIN_API_KEY;
    const apiVersion = process.env.SHOPIFY_API_VERSION;

    if (!shopifyDomain || !adminApiKey || !apiVersion) {
      console.error('Missing environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Bersihkan nomor order (hilangkan # jika ada)
    const cleanOrderNumber = orderNumber.replace('#', '');

    // Gunakan REST API untuk mendapatkan order berdasarkan nama/nomor
    const response = await fetch(
      `https://${shopifyDomain}/admin/api/${apiVersion}/orders.json?name=${cleanOrderNumber}`,
      {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': adminApiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: `Error dari Shopify API: ${response.status}` 
      });
    }

    const data = await response.json();

    // Debug: Log respons untuk memeriksa struktur
    console.log('Shopify API response:', JSON.stringify(data, null, 2));

    // Cek jika order tidak ditemukan
    if (!data.orders || data.orders.length === 0) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    const order = data.orders[0];
    
    // Ekstrak informasi yang diperlukan
    const result = {
      orderNumber: order.name,
      customerName: order.customer ? 
        `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : 
        'Tidak tersedia',
      status: order.fulfillment_status || 'unknown',
      trackingInfo: []
    };

    // Ambil informasi tracking dari fulfillments
    if (order.fulfillments && order.fulfillments.length > 0) {
      order.fulfillments.forEach(fulfillment => {
        if (fulfillment.tracking_number) {
          result.trackingInfo.push({
            company: fulfillment.tracking_company || 'Other',
            number: fulfillment.tracking_number
          });
        }
      });
    }

    // Jika tidak ada fulfillment, cek di line items
    if (result.trackingInfo.length === 0 && order.line_items) {
      order.line_items.forEach(item => {
        if (item.fulfillment_status === 'fulfilled' && item.fulfillment_service) {
          result.trackingInfo.push({
            company: item.fulfillment_service,
            number: 'Tidak tersedia'
          });
        }
      });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data order' });
  }
}

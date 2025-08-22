// api/track-order-rest.js (alternatif)
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

    // Menggunakan REST API sebagai alternatif
    const response = await fetch(
      `https://${shopifyDomain}/admin/api/${apiVersion}/orders.json?name=${orderNumber}`,
      {
        headers: {
          'X-Shopify-Access-Token': adminApiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const data = await response.json();

    // Cek jika order tidak ditemukan
    if (!data.orders || data.orders.length === 0) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    const order = data.orders[0];
    
    // Ekstrak informasi yang diperlukan
    const result = {
      orderNumber: order.name,
      customerName: order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : 'Tidak tersedia',
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

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data order' });
  }
}

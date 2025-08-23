// api/track-order.js
export default async function handler(req, res) {
  // Set CORS headers untuk allow requests dari Shopify store
  res.setHeader('Access-Control-Allow-Origin', 'https://49r1z3-hn.myshopify.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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

    // Query GraphQL tanpa field customer (karena tidak ada akses)
    const query = `
      query GetOrder($query: String!) {
        orders(first: 1, query: $query) {
          edges {
            node {
              id
              name
              createdAt
              displayFulfillmentStatus
              fulfillments(first: 5) {
                trackingInfo {
                  company
                  number
                }
                status
              }
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      query: `name:${cleanOrderNumber}`
    };

    // Request ke Shopify Admin API
    const response = await fetch(`https://${shopifyDomain}/admin/api/${apiVersion}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': adminApiKey
      },
      body: JSON.stringify({ query, variables })
    });

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

    // Cek jika ada error dari GraphQL
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      
      // Filter out ACCESS_DENIED errors untuk customer field
      const nonAccessErrors = data.errors.filter(error => 
        !error.message.includes('Customer object')
      );
      
      if (nonAccessErrors.length > 0) {
        return res.status(400).json({ error: 'Query error: ' + nonAccessErrors[0].message });
      }
      
      // Jika hanya error akses customer, kita masih bisa proses data ordernya
      console.log('Ignoring customer access errors, proceeding with order data');
    }

    // Cek jika order tidak ditemukan
    if (!data.data || !data.data.orders || !data.data.orders.edges.length) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    const order = data.data.orders.edges[0].node;
    
    // Ekstrak informasi yang diperlukan
    const result = {
      orderNumber: order.name,
      customerName: 'Informasi pelanggan tidak tersedia', // Default value
      status: order.displayFulfillmentStatus || 'UNKNOWN',
      trackingInfo: [],
      orderDate: order.createdAt,
      totalAmount: order.totalPriceSet?.shopMoney?.amount || '0',
      currency: order.totalPriceSet?.shopMoney?.currencyCode || 'USD'
    };

    // Ambil informasi tracking dari fulfillments
    if (order.fulfillments && order.fulfillments.length > 0) {
      order.fulfillments.forEach(fulfillment => {
        if (fulfillment.trackingInfo && fulfillment.trackingInfo.length > 0) {
          fulfillment.trackingInfo.forEach(tracking => {
            result.trackingInfo.push({
              company: tracking.company,
              number: tracking.number
            });
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


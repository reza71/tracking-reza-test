export default async function handler(req, res) {
  // Set CORS headers untuk allow requests dari domain Vercel
  res.setHeader('Access-Control-Allow-Origin', 'https://mtj-tracking-orders.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderNumber, customerEmail } = req.body;

    if (!orderNumber) {
      return res.status(400).json({ error: 'Order number is required' });
    }

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

    // Query GraphQL untuk dapatkan data order
    const query = `
      query GetOrder($query: String!) {
        orders(first: 1, query: $query) {
          edges {
            node {
              id
              name
              email
              createdAt
              displayFulfillmentStatus
              fulfillments(first: 5) {
              createdAt
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
        error: `Error from Shopify API: ${response.status}` 
      });
    }

    const data = await response.json();

    // Cek jika ada error dari GraphQL
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      
      // Filter out ACCESS_DENIED errors
      const nonAccessErrors = data.errors.filter(error => 
        !error.message.includes('Customer object')
      );
      
      if (nonAccessErrors.length > 0) {
        return res.status(400).json({ error: 'Query error: ' + nonAccessErrors[0].message });
      }
    }

    // Cek jika order tidak ditemukan
    if (!data.data || !data.data.orders || !data.data.orders.edges.length) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = data.data.orders.edges[0].node;
    
    // Verifikasi email customer jika provided
    if (customerEmail && order.email) {
      const providedEmail = customerEmail.toLowerCase().trim();
      const orderEmail = order.email.toLowerCase().trim();
      
      // Basic email validation - bisa juga validasi nomor telepon di sini
      if (!providedEmail.includes('@')) {
        // Mungkin ini nomor telepon, skip validation untuk sekarang
        console.log('Phone number provided instead of email, skipping email validation');
      } else if (orderEmail !== providedEmail) {
        return res.status(403).json({ error: 'Email does not match order records' });
      }
    }
    
    // Ekstrak informasi yang diperlukan
    const result = {
      orderNumber: order.name,
      status: order.fulfillment_status || order.financial_status,
    tags: order.tags,
      customerName: order.email || 'Customer information not available',
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
              company: "JNE", // Always set to JNE
              number: tracking.number
            });
          });
        }
      });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'An error occurred while retrieving order data' });
  }
}
// Check if status is delivered based on time OR if order has "Delivered" tag
const hasDeliveredTag = data.tags && data.tags.includes('Delivered');
const isDelivered = data.status === 'DELIVERED' || 
                  (fulfillmentDate && checkIfDelivered(fulfillmentDate)) ||
                  hasDeliveredTag;

// If delivered, update status
if (isDelivered && data.status !== 'DELIVERED') {
    data.status = 'DELIVERED';
    addDebugInfo(`Order marked as delivered based on shipping date or Delivered tag`);
}



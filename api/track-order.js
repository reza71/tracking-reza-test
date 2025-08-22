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

    // GraphQL query untuk mendapatkan data order
    const query = `
      query GetOrder($query: String!) {
        orders(first: 1, query: $query) {
          edges {
            node {
              id
              name
              displayFulfillmentStatus
              customer {
                displayName
              }
              fulfillments(first: 10) {
                edges {
                  node {
                    id
                    status
                    trackingInfo {
                      company
                      number
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      query: `name:${orderNumber}`
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
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const data = await response.json();

    // Cek jika order tidak ditemukan
    if (!data.data.orders.edges.length) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    const order = data.data.orders.edges[0].node;
    
    // Ekstrak informasi yang diperlukan
    const result = {
      orderNumber: order.name,
      customerName: order.customer ? order.customer.displayName : 'Tidak tersedia',
      status: order.displayFulfillmentStatus,
      trackingInfo: []
    };

    // Ambil informasi tracking dari fulfillments
    if (order.fulfillments && order.fulfillments.edges.length > 0) {
      order.fulfillments.edges.forEach(fulfillmentEdge => {
        const fulfillment = fulfillmentEdge.node;
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

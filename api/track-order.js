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

    // GraphQL query yang benar sesuai dokumentasi Shopify
    // Query ini lebih sederhana dan hanya mengambil field yang benar-benar ada
    const query = `
      query GetOrder($query: String!) {
        orders(first: 1, query: $query) {
          edges {
            node {
              name
              displayFulfillmentStatus
              customer {
                displayName
              }
              fulfillments(first: 5) {
                fulfillmentLineItems(first: 5) {
                  edges {
                    node {
                      lineItem {
                        name
                      }
                    }
                  }
                }
                trackingInfo {
                  company
                  number
                }
                status
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
      // Coba query yang lebih sederhana jika query pertama error
      return await trySimpleQuery(shopifyDomain, adminApiKey, apiVersion, cleanOrderNumber, res);
    }

    // Cek jika order tidak ditemukan
    if (!data.data || !data.data.orders || !data.data.orders.edges.length) {
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

// Fungsi untuk mencoba query yang lebih sederhana jika query pertama gagal
async function trySimpleQuery(shopifyDomain, adminApiKey, apiVersion, orderNumber, res) {
  try {
    console.log('Trying simple query...');
    
    const simpleQuery = `
      query GetOrder($query: String!) {
        orders(first: 1, query: $query) {
          edges {
            node {
              name
              displayFulfillmentStatus
              customer {
                displayName
              }
            }
          }
        }
      }
    `;

    const variables = {
      query: `name:${orderNumber}`
    };

    const response = await fetch(`https://${shopifyDomain}/admin/api/${apiVersion}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': adminApiKey
      },
      body: JSON.stringify({ query: simpleQuery, variables })
    });

    if (!response.ok) {
      throw new Error(`Simple query failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(`Simple query also failed: ${data.errors[0].message}`);
    }

    // Cek jika order tidak ditemukan
    if (!data.data || !data.data.orders || !data.data.orders.edges.length) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    const order = data.data.orders.edges[0].node;
    
    // Untuk query sederhana, kita hanya bisa mendapatkan info dasar
    const result = {
      orderNumber: order.name,
      customerName: order.customer ? order.customer.displayName : 'Tidak tersedia',
      status: order.displayFulfillmentStatus,
      trackingInfo: []
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Simple query also failed:', error);
    res.status(500).json({ error: 'Tidak dapat mengambil data order. Silakan coba lagi nanti.' });
  }
}

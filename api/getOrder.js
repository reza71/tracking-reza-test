export default async function handler(req, res) {
  const { orderNumber } = req.query;

  if (!orderNumber) {
    return res.status(400).json({ error: "Order number is required" });
  }

  try {
    // Shopify GraphQL Admin API URL
    const endpoint = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/graphql.json`;

    // Query ambil fulfillment + tracking info
    const query = `
      query($query: String!) {
        orders(first: 1, query: $query) {
          edges {
            node {
              name
              fulfillmentStatus
              fulfillments(first: 5) {
                trackingInfo(first: 5) {
                  number
                  url
                  company
                }
              }
            }
          }
        }
      }
    `;

    const variables = { query: `name:${orderNumber}` };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_KEY,
      },
      body: JSON.stringify({ query, variables }),
    });

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

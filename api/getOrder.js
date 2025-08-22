export default async function handler(req, res) {
  const { orderNumber } = req.query;

  if (!orderNumber) {
    return res.status(400).json({ error: "Order number is required" });
  }

  // Convert ke format Shopify name (#xxxx)
  const orderName = `#${orderNumber}`;

  try {
    const response = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/${process.env.SHOPIFY_API_VERSION}/orders.json?name=${encodeURIComponent(orderName)}`,
      {
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!data.orders || data.orders.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = data.orders[0];
    return res.status(200).json({
      order_number: order.order_number,
      name: order.name,
      fulfillments: order.fulfillments || [],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/api/confirm-delivery.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { order_number } = req.body; // contoh: 1313 (tanpa #)
    if (!order_number) {
      return res.status(400).json({ error: "order_number is required" });
    }

    const shop = process.env.SHOPIFY_SHOP; // myshop.myshopify.com
    const token = process.env.SHOPIFY_ADMIN_API_TOKEN;

    // 1. Cari order pakai order_number
    const searchRes = await fetch(
      `https://${shop}/admin/api/2025-01/orders.json?name=${encodeURIComponent(
        "#" + order_number
      )}`,
      {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      }
    );

    const searchData = await searchRes.json();
    if (!searchData.orders || searchData.orders.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = searchData.orders[0];
    const orderId = order.id;

    // 2. Ambil existing tags
    let tags = order.tags ? order.tags.split(",").map(t => t.trim()) : [];

    // 3. Tambahkan tag Delivered kalau belum ada
    if (!tags.includes("Delivered")) {
      tags.push("Delivered");
    }

    // 4. Update order dengan tag baru
    const updateRes = await fetch(
      `https://${shop}/admin/api/2025-01/orders/${orderId}.json`,
      {
        method: "PUT",
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order: {
            id: orderId,
            tags: tags.join(", "),
          },
        }),
      }
    );

    const updateData = await updateRes.json();

    if (updateRes.ok) {
      return res.status(200).json({
        success: true,
        message: `Order #${order_number} updated with Delivered tag`,
        order: updateData.order,
      });
    } else {
      return res.status(updateRes.status).json({
        error: "Failed to update order",
        details: updateData,
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set");
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Email service not configured" }) };
  }

  let order;
  try {
    order = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  const {
    firstName, lastName, email, phone,
    deliveryMethod, address, city, postalCode,
    items = [], subtotal = 0, deliveryFee = 0, total = 0,
  } = order;

  const deliveryLabel =
    deliveryMethod === "pickup"   ? "Market Pickup (Free)" :
    deliveryMethod === "standard" ? "Standard Delivery" :
                                    "Extended Delivery";

  const addressBlock = deliveryMethod !== "pickup"
    ? `<p style="margin:4px 0;"><strong>Delivery Address:</strong><br>
       ${address}<br>${city}, Ontario&nbsp;&nbsp;${postalCode}</p>`
    : `<p style="margin:4px 0;"><strong>Delivery Method:</strong> Market Pickup (Free)</p>`;

  const itemRows = items.map(item => `
    <tr>
      <td style="padding:7px 14px;border-bottom:1px solid #eee;">${item.name}</td>
      <td style="padding:7px 14px;border-bottom:1px solid #eee;text-align:center;">×${item.qty}</td>
      <td style="padding:7px 14px;border-bottom:1px solid #eee;text-align:right;">$${(item.price * item.qty).toFixed(2)}</td>
    </tr>`).join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#2C1A0E;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1A1A1A;padding:16px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#FAF4EB;font-size:20px;margin:0;">New Order — Gmac's Fresh Meat</h1>
  </div>
  <div style="border:1px solid #D4B896;border-top:none;border-radius:0 0 8px 8px;padding:24px;">

    <h2 style="font-size:15px;color:#7A4E2D;border-bottom:1px solid #D4B896;padding-bottom:8px;margin-top:0;">Customer</h2>
    <p style="margin:4px 0;"><strong>Name:</strong> ${firstName} ${lastName}</p>
    <p style="margin:4px 0;"><strong>Email:</strong> ${email}</p>
    <p style="margin:4px 0;"><strong>Phone:</strong> ${phone}</p>
    ${addressBlock}

    <h2 style="font-size:15px;color:#7A4E2D;border-bottom:1px solid #D4B896;padding-bottom:8px;margin-top:24px;">Order</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#F5EDE0;">
          <th style="padding:7px 14px;text-align:left;">Item</th>
          <th style="padding:7px 14px;text-align:center;">Qty</th>
          <th style="padding:7px 14px;text-align:right;">Price</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:7px 14px;border-top:1px solid #D4B896;">Subtotal</td>
          <td style="padding:7px 14px;border-top:1px solid #D4B896;text-align:right;">$${Number(subtotal).toFixed(2)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:7px 14px;">${deliveryLabel}</td>
          <td style="padding:7px 14px;text-align:right;">${deliveryFee === 0 ? "Free" : "$" + Number(deliveryFee).toFixed(2)}</td>
        </tr>
        <tr style="font-weight:bold;font-size:15px;">
          <td colspan="2" style="padding:7px 14px;border-top:2px solid #7A4E2D;">Total</td>
          <td style="padding:7px 14px;border-top:2px solid #7A4E2D;text-align:right;color:#7A4E2D;">$${Number(total).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    <p style="margin-top:24px;font-size:12px;color:#999;">
      Reach out to the customer within 48 hours to confirm delivery.
    </p>
  </div>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Gmac's Fresh Meat <onboarding@resend.dev>",
        to: ["gavinrmac22@gmail.com"],
        subject: `New Order — ${firstName} ${lastName} — $${Number(total).toFixed(2)} CAD`,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(JSON.stringify(errBody));
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("Resend error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to send order email" }) };
  }
};

// netlify/functions/save-response.js
// Email-only logger using Resend (no database)

const https = require("https");

function parseUA(ua = "") {
  let device = "Unknown device";
  let os = "Unknown OS";
  let browser = "Unknown browser";

  if (ua.includes("iPhone")) device = "iPhone";
  else if (ua.includes("Android")) device = "Android";
  else if (ua.includes("Windows")) device = "Windows PC";
  else if (ua.includes("Macintosh")) device = "Mac";

  if (ua.includes("iPhone OS")) os = "iOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Mac OS X")) os = "macOS";

  if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Firefox")) browser = "Firefox";

  return { device, os, browser };
}

function sendResendEmail({ apiKey, to, subject, text }) {
  const payload = JSON.stringify({
    from: "Heart Matrix <onboarding@resend.dev>",
    to: [to],
    subject,
    text,
  });

  const options = {
    hostname: "api.resend.com",
    path: "/emails",
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          console.error("Resend error:", res.statusCode, body);
          reject(new Error(`Resend error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on("error", (err) => {
      console.error("HTTPS error:", err);
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

exports.handler = async (event) => {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const TO_EMAIL = process.env.TO_EMAIL;

  if (!RESEND_API_KEY || !TO_EMAIL) {
    console.error("Missing RESEND_API_KEY or TO_EMAIL env vars");
    return {
      statusCode: 500,
      body: "Missing email config",
    };
  }

  // GET = test email
  if (event.httpMethod === "GET") {
    try {
      await sendResendEmail({
        apiKey: RESEND_API_KEY,
        to: TO_EMAIL,
        subject: "Heart Matrix test email ✅",
        text: "If you received this, Resend + Netlify are wired correctly.",
      });
      return { statusCode: 200, body: "Test email sent" };
    } catch (err) {
      console.error("Test email failed:", err);
      return { statusCode: 500, body: "Failed to send test email" };
    }
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { session, key, value } = body;

    const ip =
      event.headers["x-nf-client-connection-ip"] ||
      event.headers["x-forwarded-for"] ||
      "Unknown IP";

    const ua = event.headers["user-agent"] || "";
    const { device, os, browser } = parseUA(ua);
    const time = new Date().toISOString();

    const text = `
New Heart Matrix event 💗

Tile: ${key}
Value: ${value}

Session: ${session}
IP: ${ip}
Device: ${device}
OS: ${os}
Browser: ${browser}
Time: ${time}
    `.trim();

    await sendResendEmail({
      apiKey: RESEND_API_KEY,
      to: TO_EMAIL,
      subject: `Heart Matrix - ${key}`,
      text,
    });

    return { statusCode: 200, body: "OK" };
  } catch (err) {
    console.error("save-response error:", err);
    return { statusCode: 500, body: "ERR" };
  }
};
// netlify/functions/save-response.js
// Email-only logger using Resend SDK (Node.js)

const { Resend } = require("resend");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL = process.env.TO_EMAIL;

const resend = new Resend(RESEND_API_KEY);

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

exports.handler = async (event) => {
  if (!RESEND_API_KEY || !TO_EMAIL) {
    console.error("Missing RESEND_API_KEY or TO_EMAIL env vars");
    return {
      statusCode: 500,
      body: "Missing email config",
    };
  }

  // 🔍 GET = simple test endpoint
  if (event.httpMethod === "GET") {
    try {
      const { data, error } = await resend.emails.send({
        from: "Heart Matrix <onboarding@resend.dev>",
        to: [TO_EMAIL],
        subject: "Heart Matrix test email ✅",
        html: "<p>If you see this, Netlify + Resend are wired correctly.</p>",
      });

      if (error) {
        console.error("Resend test error:", error);
        return {
          statusCode: 500,
          body: "Resend error: " + JSON.stringify(error),
        };
      }

      console.log("Resend test data:", data);
      return {
        statusCode: 200,
        body: "Test email sent: " + JSON.stringify(data),
      };
    } catch (err) {
      console.error("Test email failed:", err);
      return { statusCode: 500, body: "Failed: " + String(err) };
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

    const { data, error } = await resend.emails.send({
      from: "Heart Matrix <onboarding@resend.dev>",
      to: [TO_EMAIL],
      subject: `Heart Matrix - ${key}`,
      text,
    });

    if (error) {
      console.error("Resend send error:", error);
      return {
        statusCode: 500,
        body: "Resend error: " + JSON.stringify(error),
      };
    }

    console.log("Resend send data:", data);
    return { statusCode: 200, body: "OK" };
  } catch (err) {
    console.error("save-response error:", err);
    return { statusCode: 500, body: "ERR: " + String(err) };
  }
};

// Map to keep track of when a zone was last alerted (In-Memory Cooldown)
const lastSentTracker = new Map(); 
const COOLDOWN_MINUTES = 30; // ⏱️ Won't send emails to the SAME zone within 30 mins

export default {
  async fetch(request, env, ctx) {
    // 1. Only allow POST requests
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Only POST requests allowed." }), { 
        status: 405, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    try {
      // 2. Safe JSON Parsing (Prevents crash if body is empty or malformed)
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid or missing JSON body." }), { status: 400 });
      }

      const zoneName = body.area;
      const customMessage = body.message;
      const isTestMode = body.test_mode || false; // Pass "test_mode": true to test safely

      if (!zoneName) {
        return new Response(JSON.stringify({ error: "Missing 'area' (zone name) in request." }), { status: 400 });
      }

      // 3. 🚨 ANTI-SPAM SAFEGUARD: Check Cooldown Period
      const now = Date.now();
      const lastSentTime = lastSentTracker.get(zoneName);

      if (lastSentTime && (now - lastSentTime) < COOLDOWN_MINUTES * 60 * 1000) {
        const minutesLeft = Math.ceil((COOLDOWN_MINUTES * 60 * 1000 - (now - lastSentTime)) / 60000);
        return new Response(JSON.stringify({ 
          error: `SPAM PREVENTION: Outage alert for '${zoneName}' was sent recently. Please wait ${minutesLeft} more minute(s).` 
        }), { status: 429 });
      }

      // If test mode is enabled, stop here without touching Flask
      if (isTestMode) {
        return new Response(JSON.stringify({ success: true, message: `TEST MODE: Safe! Email to ${zoneName} was NOT sent.` }));
      }

      // 4. Forward to your Python Flask route safely
      const flaskResponse = await fetch("https://portal.ctl-ltd.com/send_notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `🚨 Service Outage Alert - ${zoneName}`,
          message: customMessage || `Outage reported in ${zoneName}. Engineers are investigating.`,
          status: "Active",
          area: zoneName
        })
      });

      // Update tracker ONLY if Flask responded with success
      if (flaskResponse.ok) {
        lastSentTracker.set(zoneName, now);
      }

      const result = await flaskResponse.json().catch(() => ({ status: "Sent to Flask" }));
      return new Response(JSON.stringify({ success: true, flask_response: result }), { status: 200 });

    } catch (error) {
      // Catch-all to stop Cloudflare from completely crashing
      return new Response(JSON.stringify({ error: "Worker Internal Failure", details: error.message }), { status: 500 });
    }
  }
};

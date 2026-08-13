export default {
  async fetch(request, env, ctx) {
    // Only accept POST requests
    if (request.method !== "POST") {
      return new Response("Send a POST request with zone data", { status: 400 });
    }

    try {
      // 1. Receive the zone data from whoever called this worker
      const body = await request.json();
      const zoneName = body.area; // e.g., "HarbourView"
      const customMessage = body.message;

      // 2. Forward that exact zone data to your Flask "Big Code"
      const flaskResponse = await fetch("https://portal.ctl-ltd.com/send_notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `🚨 Service Outage Alert - ${zoneName}`,
          message: customMessage || `Outage reported in ${zoneName}. Engineers are investigating.`,
          status: "Active",
          area: zoneName // This feeds directly into your Flask area matching logic!
        })
      });

      const result = await flaskResponse.json();
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }
};
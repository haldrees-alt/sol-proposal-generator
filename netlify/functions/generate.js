const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { systemPrompt, userPrompt } = JSON.parse(event.body);

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = msg.content[0].text;
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    if (s === -1 || e === -1) throw new Error("No JSON in response");
    const json = JSON.parse(raw.slice(s, e + 1));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
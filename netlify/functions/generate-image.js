exports.handler = async (event) => {
  const prompt = event.queryStringParameters?.prompt || "abstract background";
  const seed = event.queryStringParameters?.seed || Math.floor(Math.random() * 99999);

  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=768&seed=${seed}&nologo=true`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Pollinations fetch failed");

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return {
      statusCode: 200,
      headers: { "Content-Type": contentType },
      body: base64,
      isBase64Encoded: true,
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
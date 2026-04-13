export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { input } = req.body;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: "Você é um assistente psicológico direto e útil."
          },
          {
            role: "user",
            content: input
          }
        ]
      })
    });

    const data = await response.json();

    return res.status(200).json({
      output: data.choices[0].message.content
    });

  } catch (err) {
    return res.status(500).json({
      error: "Erro na IA"
    });
  }
}
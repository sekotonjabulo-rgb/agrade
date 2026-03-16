const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.status(200).send("ok");
});

app.post("/ask", async (req, res) => {
  try {
    const { base64Image, message, history = [] } = req.body;

    const systemMessage = {
      role: "system",
      content: "You are agrade, a helpful AI assistant that can see the user's screen and answer questions. Be concise and direct. When analyzing screens, focus on what's relevant to the user's question. If no question is asked, describe what you see and offer to help.",
    };

    const conversationHistory = history.map(entry => ({
      role: entry.role,
      content: entry.content,
    }));

    let userContent;

    if (base64Image && message) {
      userContent = [
        {
          type: "image_url",
          image_url: { url: `data:image/png;base64,${base64Image}` },
        },
        {
          type: "text",
          text: message,
        },
      ];
    } else if (base64Image) {
      userContent = [
        {
          type: "image_url",
          image_url: { url: `data:image/png;base64,${base64Image}` },
        },
        {
          type: "text",
          text: "Analyze this screen and provide a helpful, concise response to whatever problem or question is visible.",
        },
      ];
    } else {
      userContent = message || "Hello";
    }

    const messages = [
      systemMessage,
      ...conversationHistory,
      { role: "user", content: userContent },
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages,
        max_tokens: 512,
      }),
    });

    const data = await response.json();
    res.json({ result: data.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reach Groq" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

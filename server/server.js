const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/ask", async (req, res) => {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: req.body.prompt }],
        max_tokens: 512,
      }),
    });
    const data = await response.json();
    res.json({ result: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: "Failed to reach Groq" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

setInterval(() => {
  fetch(`https://agrade-cbwf.onrender.com/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "ping" }),
  }).catch(() => {});
}, 840000);

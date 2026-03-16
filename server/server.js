const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const supabase = createClient(
  "https://llabvdbcvilnbukroqxn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsYWJ2ZGJjdmlsbmJ1a3JvcXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2OTQzNzQsImV4cCI6MjA4OTI3MDM3NH0.WLdB5hNXMHJ63JGwgXgY8TEEGz7k5AVbsV7aVDy6xQU"
);

const FREE_DAILY_LIMIT = 5;

async function getUserFromToken(token) {
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function getSubscription(userId) {
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data;
}

async function checkAndIncrementUsage(userId) {
  const { data: usage } = await supabase
    .from("message_usage")
    .select("*")
    .eq("user_id", userId)
    .single();

  const now = new Date();

  if (!usage) {
    await supabase.from("message_usage").insert({
      user_id: userId,
      message_count: 1,
      last_reset: now.toISOString(),
    });
    return { allowed: true, remaining: FREE_DAILY_LIMIT - 1 };
  }

  const lastReset = new Date(usage.last_reset);
  const hoursSinceReset = (now - lastReset) / (1000 * 60 * 60);

  if (hoursSinceReset >= 24) {
    await supabase
      .from("message_usage")
      .update({ message_count: 1, last_reset: now.toISOString() })
      .eq("user_id", userId);
    return { allowed: true, remaining: FREE_DAILY_LIMIT - 1 };
  }

  if (usage.message_count >= FREE_DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  await supabase
    .from("message_usage")
    .update({ message_count: usage.message_count + 1 })
    .eq("user_id", userId);

  return { allowed: true, remaining: FREE_DAILY_LIMIT - usage.message_count - 1 };
}

app.get("/", (req, res) => {
  res.status(200).send("ok");
});

app.post("/ask", async (req, res) => {
  try {
    const { base64Image, message, history = [] } = req.body;
    const token = req.headers.authorization?.replace("Bearer ", "");

    const user = await getUserFromToken(token);

    if (user) {
      const subscription = await getSubscription(user.id);
      const isPro = !!subscription;

      if (!isPro) {
        const usage = await checkAndIncrementUsage(user.id);
        if (!usage.allowed) {
          return res.status(429).json({
            error: "Daily limit reached",
            message: "You've used your 5 free captures today. Upgrade to Pro for unlimited access.",
          });
        }
      }
    }

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
        { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } },
        { type: "text", text: message },
      ];
    } else if (base64Image) {
      userContent = [
        { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } },
        { type: "text", text: "Analyze this screen and provide a helpful, concise response to whatever problem or question is visible." },
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

app.get("/subscription", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const subscription = await getSubscription(user.id);
  const { data: usage } = await supabase
    .from("message_usage")
    .select("*")
    .eq("user_id", user.id)
    .single();

  res.json({
    plan: subscription ? subscription.plan : "free",
    status: subscription ? subscription.status : "inactive",
    message_count: usage?.message_count || 0,
    remaining: Math.max(0, FREE_DAILY_LIMIT - (usage?.message_count || 0)),
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

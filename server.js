const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const app = express();

// ==========================================
// MIDDLEWARE
// ==========================================

const allowedOrigins = [
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://localhost:3000",
  "https://redditfix.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    const msg = "CORS policy does not allow access from this origin.";
    return callback(new Error(msg), false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// ==========================================
// CONFIGURATION & VALIDATION
// ==========================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDkgEAJGD2GQ6SGgr0JXXRUM-4kI0AT970";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";
const DODO_API_KEY = process.env.DODO_API_KEY || "";
const DODO_MODE = process.env.DODO_MODE || "production";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
const PORT = process.env.PORT || 3000;

const { createClient } = require("@supabase/supabase-js");

// Validate Supabase credentials
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error("❌ FATAL: Supabase credentials missing!");
  console.error("   Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

// Create service role client that BYPASSES RLS
const supabase = createClient(
  process.env.SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "placeholder",
  { auth: { persistSession: false } }
);

console.log("Supabase URL configured:", !!process.env.SUPABASE_URL);
console.log("Supabase Service Key configured:", !!process.env.SUPABASE_SERVICE_KEY);

// ==========================================
// HELPER: Get Auth User from Request
// ==========================================
const getAuthUser = async (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Missing or invalid authorization header");
    }

    const token = authHeader.split(" ")[1];
    if (!token) throw new Error("No token provided");

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) throw new Error(`Auth error: ${error.message}`);
    if (!user) throw new Error("User not found in token");

    return user;
  } catch (err) {
    throw new Error(`Authentication failed: ${err.message}`);
  }
};

// ==========================================
// GEMINI API HELPER FUNCTION
// ==========================================
async function callGeminiAPI(prompt, temperature = 0.7) {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    console.log("🤖 Calling Gemini API...");
    console.log("  → Model: gemini-2.0-flash-exp");
    console.log("  → Prompt length:", prompt.length);

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 60000,
      }
    );

    const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error("Invalid response from Gemini API");
    }

    console.log("  ✅ Response received:", content.length, "chars");
    return content;

  } catch (error) {
    console.error("❌ Gemini API ERROR:", error.message);
    
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      if (status === 400) {
        throw new Error("Gemini API bad request: " + (errorData?.error?.message || "Invalid"));
      } else if (status === 403 || status === 401) {
        throw new Error("Gemini API key invalid or unauthorized");
      } else if (status === 429) {
        throw new Error("Gemini API rate limit exceeded");
      } else if (status === 500) {
        throw new Error("Gemini API server error");
      }
    }
    
    throw new Error(`Gemini API failed: ${error.message}`);
  }
}

// ==========================================
// HEALTH CHECK
// ==========================================
app.get("/api/test", (req, res) => {
  res.json({
    message: "✅ Server working!",
    mode: DODO_MODE,
    features: ["Reddit Generation", "Post Optimization", "Dodo Payments", "User Management"],
    timestamp: new Date().toISOString(),
    supabase: process.env.SUPABASE_URL ? "Connected" : "Not configured",
    gemini: GEMINI_API_KEY ? "Configured" : "Not configured"
  });
});

app.get("/", (req, res) => {
  res.json({ 
    message: "ReddiGen API Server", 
    status: "online",
    version: "2.0.0",
    ai_provider: "Google Gemini 2.0 Flash"
  });
});

// ==========================================
// USER PROFILE MANAGEMENT
// ==========================================
app.get("/api/user/data", async (req, res) => {
  try {
    console.log("\n📡 /api/user/data request");
    const user = await getAuthUser(req);
    console.log(`📊 Loading data for: ${user.email}`);

    const withTimeout = (promise, ms) => {
      return Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
        ),
      ]);
    };

    // Fetch profile
    let profile = null;
    try {
      const { data, error } = await withTimeout(
        supabase.from("user_profiles").select("*").eq("user_id", user.id).single(),
        5000
      );

      if (error && error.code === "PGRST116") {
        const { data: newProfile } = await supabase
          .from("user_profiles")
          .insert({
            user_id: user.id,
            email: user.email,
            display_name: user.email.split("@")[0],
            created_at: new Date().toISOString(),
          })
          .select()
          .single();
        profile = newProfile;
      } else if (!error) {
        profile = data;
      }
    } catch (err) {
      console.error("Profile fetch error:", err.message);
    }

    // Fetch plan
    let plan = null;
    try {
      const { data, error } = await withTimeout(
        supabase.from("user_plans").select("*").eq("user_id", user.id).single(),
        5000
      );

      if (error && error.code === "PGRST116") {
        const { data: newPlan } = await supabase
          .from("user_plans")
          .insert({
            user_id: user.id,
            plan_type: "free",
            posts_per_month: 10,
            credits_remaining: 10,
            billing_cycle: "monthly",
            status: "active",
            activated_at: new Date().toISOString(),
          })
          .select()
          .single();
        plan = newPlan;
      } else if (!error) {
        plan = data;
      }
    } catch (err) {
      console.error("Plan fetch error:", err.message);
    }

    // Fetch history
    let history = [];
    try {
      const { data } = await withTimeout(
        supabase
          .from("post_history")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        5000
      );
      history = data || [];
    } catch (err) {
      console.error("History fetch error:", err.message);
    }

    console.log("✅ User data loaded");

    res.json({
      success: true,
      profile: profile || {
        user_id: user.id,
        email: user.email,
        display_name: user.email.split("@")[0],
        created_at: new Date().toISOString(),
      },
      plan: plan || {
        user_id: user.id,
        plan_type: "free",
        credits_remaining: 10,
        posts_per_month: 10,
        billing_cycle: "monthly",
        status: "active",
      },
      history: history,
    });
  } catch (error) {
    console.error("❌ /api/user/data error:", error.message);
    res.status(401).json({ 
      success: false, 
      error: error.message
    });
  }
});

app.put("/api/user/profile", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const { displayName, bio } = req.body;

    const { data, error } = await supabase
      .from("user_profiles")
      .update({
        display_name: displayName,
        bio: bio,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, profile: data });
  } catch (error) {
    console.error("❌ Profile update error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// REDDIT RULES ENDPOINT
// ==========================================
app.get("/api/reddit-rules/:subreddit", async (req, res) => {
  const subreddit = req.params.subreddit.toLowerCase().replace(/^r\//, '');
  console.log(`\n📍 Fetching rules for: r/${subreddit}`);

  try {
    const response = await axios.get(
      `https://www.reddit.com/r/${subreddit}/about/rules.json`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        timeout: 10000,
      }
    );

    let rulesText = "";
    if (response.data.rules && Array.isArray(response.data.rules)) {
      response.data.rules.forEach((rule, index) => {
        rulesText += `**Rule ${index + 1}: ${rule.short_name}**\n${rule.description}\n\n`;
      });
    }

    console.log(`✅ Got ${response.data.rules?.length || 0} rules`);

    res.json({
      subreddit,
      rules: rulesText || "No specific rules found. Standard Reddit etiquette applies.",
      success: true,
    });
  } catch (error) {
    console.error(`❌ Error fetching r/${subreddit}:`, error.message);

    if (error.response?.status === 404) {
      return res.status(404).json({ error: "Subreddit not found", success: false });
    } else if (error.response?.status === 403) {
      return res.status(403).json({ error: "Subreddit is private", success: false });
    }

    res.status(500).json({ error: "Failed to fetch rules", success: false });
  }
});

// ==========================================
// GEMINI API PROXY
// ==========================================
app.post("/api/gemini", async (req, res) => {
  try {
    console.log("\n🤖 Gemini proxy request");
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: "Prompt required" });
    }

    const response = await callGeminiAPI(prompt);
    res.json({ success: true, content: response });
  } catch (error) {
    console.error("❌ Gemini proxy error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// AI GENERATION - GENERATE POST
// ==========================================
app.post("/api/generate-post", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const { subreddit, topic, style, rules } = req.body;

    console.log(`\n🤖 Generating post for r/${subreddit}`);

    if (!subreddit || !topic) {
      return res.status(400).json({ success: false, error: "Missing subreddit or topic" });
    }

    const { data: plan, error: planError } = await supabase
      .from("user_plans")
      .select("credits_remaining, posts_per_month, plan_type")
      .eq("user_id", user.id)
      .single();

    if (planError || !plan) {
      return res.status(500).json({ success: false, error: "Could not verify plan" });
    }

    if (plan.credits_remaining <= 0) {
      return res.status(402).json({
        success: false,
        error: "No credits remaining. Upgrade your plan.",
      });
    }

    const prompt = `You are an expert Reddit post creator. Create an engaging post for r/${subreddit}.

**Subreddit Rules:**
${rules || "Standard Reddit etiquette"}

**Topic:** ${topic}
**Style:** ${style || "casual"}

**Instructions:**
1. Create a catchy title
2. Write engaging content matching the style
3. Follow ALL subreddit rules
4. Be natural and conversational

**IMPORTANT: Respond ONLY with valid JSON, no markdown:**
{
  "title": "Your post title",
  "content": "Your post content"
}`;

    let post = { title: "Generated Post", content: "Unable to generate" };

    try {
      const generatedText = await callGeminiAPI(prompt, 0.8);
      
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        post = JSON.parse(jsonMatch[0]);
      } else {
        post = { title: "Generated Post", content: generatedText.substring(0, 2000) };
      }
    } catch (aiErr) {
      console.error("❌ AI error:", aiErr.message);
      return res.status(500).json({ success: false, error: aiErr.message });
    }

    // Deduct credit
    await supabase
      .from("user_plans")
      .update({ 
        credits_remaining: plan.credits_remaining - 1,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    // Save to history
    let historyItem = null;
    try {
      const { data } = await supabase
        .from("post_history")
        .insert({
          user_id: user.id,
          subreddit: subreddit.toLowerCase(),
          title: post.title,
          content: post.content,
          post_type: "generated",
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      historyItem = data;
    } catch (histErr) {
      console.error("History save error:", histErr);
    }

    console.log("✅ Post generated");

    res.json({
      success: true,
      post: post,
      historyItem: historyItem,
      creditsRemaining: plan.credits_remaining - 1,
    });
  } catch (error) {
    console.error("❌ Generation error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// AI GENERATION - OPTIMIZE POST
// ==========================================
app.post("/api/optimize-post", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const { subreddit, content, style, rules } = req.body;

    console.log(`\n⚡ Optimizing post for r/${subreddit}`);

    if (!subreddit || !content) {
      return res.status(400).json({ success: false, error: "Missing data" });
    }

    const { data: plan } = await supabase
      .from("user_plans")
      .select("credits_remaining")
      .eq("user_id", user.id)
      .single();

    if (plan.credits_remaining <= 0) {
      return res.status(402).json({ success: false, error: "No credits remaining" });
    }

    const prompt = `Optimize this Reddit post for r/${subreddit}.

**Rules:** ${rules || "Standard etiquette"}
**Original:** ${content}
**Style:** ${style || "improve"}

Respond with ONLY the optimized text, no explanations.`;

    const optimizedPost = await callGeminiAPI(prompt, 0.7);

    await supabase
      .from("user_plans")
      .update({ 
        credits_remaining: plan.credits_remaining - 1,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    res.json({
      success: true,
      optimizedPost: optimizedPost.trim(),
      creditsRemaining: plan.credits_remaining - 1,
    });
  } catch (error) {
    console.error("❌ Optimization error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// PAYMENT VERIFICATION (IMPROVED)
// ==========================================
// ==========================================
// PAYMENT VERIFICATION (UPDATED - NO AUTH REQUIRED)
// ==========================================
app.post("/api/payment/verify", async (req, res) => {
  try {
    console.log("\n💳 Payment verification request");
    
    const { plan, billingCycle, postsPerMonth, amount, sessionId, email, userId } = req.body;

    console.log("Payment details:", {
      userId: userId,
      email: email,
      plan,
      billingCycle,
      postsPerMonth,
      amount,
      sessionId
    });

    // CRITICAL FIX: Don't require auth, use userId from payment data
    let finalUserId = userId;
    
    // Try to get user from auth token if available
    if (req.headers.authorization) {
      try {
        const user = await getAuthUser(req);
        finalUserId = user.id;
        console.log("✅ Got user from auth token:", finalUserId);
      } catch (authError) {
        console.log("⚠️ No auth token, using userId from payment data");
      }
    }

    // If no userId at all, try to find user by email
    if (!finalUserId && email) {
      console.log("🔍 Finding user by email:", email);
      const { data: users, error } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('email', email)
        .single();
      
      if (users) {
        finalUserId = users.user_id;
        console.log("✅ Found user by email:", finalUserId);
      }
    }

    if (!finalUserId) {
      throw new Error("Cannot identify user - no userId or email provided");
    }

    // Check if already processed
    if (sessionId) {
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("*")
        .eq("transaction_id", sessionId)
        .eq("status", "completed")
        .single();

      if (existingPayment) {
        console.log("✅ Payment already processed");
        return res.json({ 
          success: true, 
          message: "Plan already activated",
          alreadyProcessed: true
        });
      }
    }

    // Activate the plan
    await activateUserPlan(
      finalUserId,
      sessionId || `manual_${Date.now()}`,
      plan,
      postsPerMonth,
      billingCycle,
      amount,
      email
    );

    console.log("✅ Payment verified and plan activated");

    res.json({ 
      success: true, 
      message: "Payment verified and plan activated successfully",
      userId: finalUserId
    });
  } catch (error) {
    console.error("❌ Payment verification error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});


// ==========================================
// CHECK PAYMENT STATUS
// ==========================================
app.get("/api/payment/status/:sessionId", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const { sessionId } = req.params;

    console.log(`\n🔍 Checking payment: ${sessionId}`);

    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("transaction_id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (!payment) {
      return res.json({
        success: false,
        status: "not_found",
      });
    }

    const { data: plan } = await supabase
      .from("user_plans")
      .select("*")
      .eq("user_id", user.id)
      .single();

    res.json({
      success: true,
      payment,
      plan,
      status: payment.status
    });

  } catch (error) {
    console.error("❌ Payment status error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// PLAN ACTIVATION HELPER (IMPROVED)
// ==========================================
async function activateUserPlan(userId, transactionId, planType, postsPerMonth, billingCycle, amount, customerEmail) {
  console.log(`\n🚀 Activating plan for ${userId}`);
  console.log(`   Plan: ${planType}, Posts: ${postsPerMonth}, Cycle: ${billingCycle}`);

  const now = new Date();
  const expiryDate = new Date();
  
  if (billingCycle === "yearly") {
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  } else {
    expiryDate.setMonth(expiryDate.getMonth() + 1);
  }

  // Update plan
  const { error: planError } = await supabase
    .from("user_plans")
    .upsert({
      user_id: userId,
      plan_type: planType,
      posts_per_month: parseInt(postsPerMonth),
      credits_remaining: parseInt(postsPerMonth),
      billing_cycle: billingCycle,
      amount: parseFloat(amount),
      status: "active",
      activated_at: now.toISOString(),
      expires_at: expiryDate.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: "user_id" })
    .select();

  if (planError) {
    throw new Error(`Plan activation failed: ${planError.message}`);
  }

  // Record payment
  const { error: paymentError } = await supabase
    .from("payments")
    .insert({
      user_id: userId,
      transaction_id: transactionId,
      customer_email: customerEmail,
      plan_type: planType,
      amount: parseFloat(amount),
      posts_per_month: parseInt(postsPerMonth),
      billing_cycle: billingCycle,
      status: "completed",
      completed_at: now.toISOString(),
      created_at: now.toISOString(),
    });

  if (paymentError && paymentError.code !== '23505') { // Ignore duplicate key errors
    console.error("Payment record error:", paymentError);
  }

  console.log(`✅ Plan activated for ${userId}`);
}

// ==========================================
// DODO WEBHOOK (IMPROVED)
// ==========================================
app.post("/api/dodo/webhook", async (req, res) => {
  const event = req.body;
  
  console.log("\n🔔 Webhook received:", event.type);
  console.log("   Data:", JSON.stringify(event, null, 2));

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "payment.succeeded" ||
      event.type === "charge.succeeded"
    ) {
      const session = event.data?.object || event;
      const metadata = session.metadata || {};

      if (!metadata.userId) {
        console.error("❌ No userId in metadata");
        return res.status(400).json({ error: "Missing userId" });
      }

      // Check if already processed
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("*")
        .eq("transaction_id", session.id)
        .eq("status", "completed")
        .single();

      if (existingPayment) {
        console.log("✅ Already processed");
        return res.json({ received: true, alreadyProcessed: true });
      }

      await activateUserPlan(
        metadata.userId,
        session.id || `webhook_${Date.now()}`,
        metadata.planType || "starter",
        parseInt(metadata.postsPerMonth) || 50,
        metadata.billingCycle || "monthly",
        (session.amount_total || session.amount || 0) / 100,
        metadata.email || session.customer_email || "unknown@email.com"
      );

      console.log("✅ Webhook processed");
    }

    res.json({ received: true });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.status(500).json({ error: "Webhook failed", message: error.message });
  }
});

// ==========================================
// AUTH ENDPOINTS
// ==========================================
app.post("/api/auth/change-password", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    const { newPassword } = req.body;
    
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: "Password too short" });
    }
    
    await supabase.auth.admin.updateUserById(user.id, { password: newPassword });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/auth/delete-account", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    
    await supabase.from("user_profiles").delete().eq("user_id", user.id);
    await supabase.from("user_plans").delete().eq("user_id", user.id);
    await supabase.from("post_history").delete().eq("user_id", user.id);
    await supabase.from("payments").delete().eq("user_id", user.id);
    await supabase.auth.admin.deleteUser(user.id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ERROR HANDLING
// ==========================================
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({ error: err.message });
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Endpoint not found" });
  }
  if (req.method === "GET") {
    return res.sendFile(path.join(__dirname, "dashboard.html"));
  }
  res.status(404).json({ error: "Not found" });
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`✅ ReddiGen Backend RUNNING!`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🤖 Gemini: ${GEMINI_API_KEY ? "✅" : "❌"}`);
  console.log(`💾 Supabase: ${process.env.SUPABASE_URL ? "✅" : "❌"}`);
  console.log(`💳 Dodo Mode: ${DODO_MODE}`);
  console.log(`${"=".repeat(80)}\n`);
});

module.exports = app;

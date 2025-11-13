# 🚀 QUICK FIX CHECKLIST - Payment Not Activating

## ⚡ 5-Minute Emergency Fixes

### Issue: Plan Not Activated After Payment

**Do This NOW:**

1. **Render Environment - CRITICAL**
   ```
   ✅ Go to Render Dashboard
   ✅ Select your service
   ✅ Click "Environment" 
   ✅ Add these 2 variables:
   
      DODO_WEBHOOK_SECRET = [Get from Dodo Webhooks]
      DODO_API_KEY = [Get from Dodo API Keys]
   
   ✅ Click "Save and Deploy"
   ✅ Wait for deployment complete
   ```

2. **Dodo Webhook - CRITICAL**
   ```
   ✅ Go to Dodo Dashboard > Webhooks
   ✅ Check webhook URL is exactly:
      https://your-render-url/api/dodo/webhook
   
   ✅ Signing Secret is set and saved
   ✅ Status shows ENABLED (green)
   ```

3. **Supabase Tables - CRITICAL**
   ```
   ✅ Go to Supabase > SQL Editor
   ✅ Paste and RUN entire supabase_setup.sql
   ✅ Go to Tables section
   ✅ Verify these 5 tables exist:
      - user_profiles
      - user_plans
      - post_history
      - payments
      - payment_records
   ```

---

## 🔍 If Still Not Working

### Test 1: Webhook Receiving
```bash
# Run in terminal/PowerShell:
curl -X POST https://your-render-url/api/dodo/webhook `
  -H "Content-Type: application/json" `
  -H "dodo-signature: test_sig" `
  -d '{
    "type": "checkout.session.completed",
    "data": {
      "object": {
        "id": "test_123",
        "amount_total": 129,
        "customer_email": "test@example.com",
        "metadata": {
          "userId": "test-user-id",
          "planType": "starter",
          "billingCycle": "monthly"
        }
      }
    }
  }'
```

### Test 2: Check Render Logs
```
✅ Render Dashboard > Your Service > Logs
✅ Look for these messages after webhook:
   
   ✅ "📥 WEBHOOK RECEIVED FROM DODO"
   ✅ "🔄 Processing event type: checkout.session.completed"
   ✅ "✅ PLAN ACTIVATED SUCCESSFULLY!"
   
   ❌ If you see:
   "❌ No userId in metadata"
   → Problem: Dodo not receiving metadata
   
   ❌ "❌ Invalid webhook signature"
   → Problem: DODO_WEBHOOK_SECRET not set or wrong
```

### Test 3: Check Supabase
```
✅ Go to Supabase > Table Editor
✅ Click "payments" table
✅ Look for your test transaction
   - status should be "completed"
   - dodo_session_id should be filled

✅ Click "user_plans" table  
✅ Find your user_id
✅ Check:
   - status = "active" ✅
   - plan_type = "starter" ✅
   - credits_remaining = 150 ✅
   - expires_at = future date ✅
```

---

## 🎯 The 3 Most Common Issues

### Issue #1: DODO_WEBHOOK_SECRET Not Set
**Symptom:** Webhook received but "Invalid signature" error

**Fix:**
1. Render Dashboard > Environment
2. Add: `DODO_WEBHOOK_SECRET` = [copy from Dodo]
3. Save and Deploy

---

### Issue #2: Metadata Not Passed to Dodo
**Symptom:** "No userId in metadata" in Render logs

**Fix:**
1. Open dashboard.js
2. Find `initiateDodoPayment` function (around line 1600)
3. Check these lines exist:
   ```javascript
   checkoutUrl.searchParams.set("metadata[userId]", currentUser.id);
   checkoutUrl.searchParams.set("metadata[planType]", planType);
   checkoutUrl.searchParams.set("metadata[billingCycle]", billingCycle);
   ```
4. If missing, they're already fixed - redeploy

---

### Issue #3: Database Tables Missing
**Symptom:** "Table 'user_plans' does not exist" error

**Fix:**
1. Supabase > SQL Editor
2. Paste entire `supabase_setup.sql`
3. Click "Run"
4. Wait for completion
5. Check Tables section - should show 5 tables

---

## 📱 Mobile Quick Test

1. **Open dashboard:** https://redrule.site
2. **Sign in with test account**
3. **Go to Pricing**
4. **Click "Upgrade"**
5. **Use test card:** `4242 4242 4242 4242`
6. **Wait for redirect** (should show "payment=success")
7. **Check profile:**
   - Plan badge should show "STARTER" or plan name
   - Credits should display
   - Current Plan card should show

---

## 🔧 Environment Variables Must Be Set

In Render, you MUST have these (copy from your credentials):

```
SUPABASE_URL = https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJhb...
GEMINI_API_KEY = AIzaSy...
DODO_API_KEY = sk_test_...
DODO_WEBHOOK_SECRET = whsec_...
FRONTEND_URL = https://redrule.site
NODE_ENV = production
```

**Missing even ONE of these = Payment fails**

---

## 📺 Logs to Check

### Render Logs (Most Important)
```
Render Dashboard 
  → Your Service 
    → Logs tab
```

Look for:
- ✅ "✅ PLAN ACTIVATED SUCCESSFULLY!" = WORKING
- ❌ "❌ No userId in metadata" = Metadata not passed
- ❌ "❌ Invalid webhook signature" = Secret wrong
- ❌ No webhook messages at all = Webhook URL wrong

### Supabase Logs
```
Supabase Dashboard
  → Logs (bottom left)
```

Look for database errors like:
- "permission denied" = RLS issue
- "table does not exist" = SQL not run

---

## ✅ Success Checklist

After fixing, you should see:

- [x] User completes payment on Dodo
- [x] Redirected back with success message
- [x] Render logs show "PLAN ACTIVATED"
- [x] Supabase shows status="active" 
- [x] Dashboard shows "Current Plan" card
- [x] Credits display correctly
- [x] User can generate posts

---

## 🆘 Still Broken?

**Minimal Test:**
```
1. Supabase SQL Editor - Run:
   SELECT * FROM user_plans LIMIT 1;
   
2. Should return 1 row with:
   - user_id: (some UUID)
   - plan_type: 'starter' or 'free'
   - status: 'active' or 'inactive'
   - credits_remaining: (number)
```

If this query fails → Database issue
If query succeeds but wrong data → Webhook not processing

---

**Last Resort:** 
1. Delete and recreate tables (drop all, rerun SQL)
2. Do test payment
3. Check Render logs in real-time while payment completes


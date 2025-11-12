# ReddiGen - Complete Payment Activation Fix Guide

## 🎯 The Problem

After a user completes payment with Dodo, the webhook is not properly activating their plan in Supabase. The plan status remains inactive even though the payment is recorded.

## 🔍 Root Causes Identified & Fixed

### 1. **Missing/Incorrect Environment Variables**
- `DODO_WEBHOOK_SECRET` was not set on Render
- Webhook signature verification was being skipped
- Invalid requests could activate plans

### 2. **Incorrect Metadata Extraction**
- Webhook was looking for metadata in wrong place
- Dodo sends: `{ data: { object: { metadata: {...} } } }`
- Code was looking for: `data.metadata` instead of `data.data.object.metadata`

### 3. **Database Issues**
- `payment_records` table had syntax error (`uuid_generate_v4()` instead of `gen_random_uuid()`)
- Missing columns: `dodo_session_id`, `metadata` on payments table
- Missing RLS policies for payment_records table

### 4. **Incomplete SQL Setup**
- Duplicate table creation statements
- Missing indexes on payment tables
- Incomplete GRANT permissions

## ✅ Fixes Applied

### Fixed Files:

#### 1. `supabase_setup.sql` - Fixed Database Schema
- ✅ Fixed `payment_records` table syntax (use `gen_random_uuid()`)
- ✅ Added `dodo_session_id`, `dodo_payment_intent`, `metadata` columns to payments table
- ✅ Added proper indexes on new columns
- ✅ Added RLS policies for `payment_records` table
- ✅ Added GRANT permissions for service_role

#### 2. `api/dodo/webhook.js` - Fixed Metadata Extraction
- ✅ Correctly extract metadata from nested structure
- ✅ Handle both string and object metadata
- ✅ Better error logging to show what data was received
- ✅ Improved signature verification error messages

#### 3. `.env.example` - Complete Setup Instructions
- ✅ All required environment variables documented
- ✅ Step-by-step setup for Supabase, Dodo, and Render
- ✅ Webhook configuration instructions
- ✅ Troubleshooting section

---

## 🚀 Complete Setup Instructions

### Step 1: Update Your Supabase Database

1. **Open Supabase SQL Editor:**
   - Go to https://supabase.com → Your Project
   - Click "SQL Editor" (left sidebar)

2. **Clear old tables (OPTIONAL - only if you have issues):**
   ```sql
   DROP TABLE IF EXISTS payment_records CASCADE;
   DROP TABLE IF EXISTS payments CASCADE;
   DROP TABLE IF EXISTS post_history CASCADE;
   DROP TABLE IF EXISTS user_plans CASCADE;
   DROP TABLE IF EXISTS user_profiles CASCADE;
   ```

3. **Paste entire `supabase_setup.sql` file:**
   - Copy everything from `supabase_setup.sql`
   - Paste into SQL Editor
   - Click "Run"

4. **Verify tables were created:**
   - Go to "Tables" section (left sidebar)
   - You should see: `user_profiles`, `user_plans`, `post_history`, `payments`, `payment_records`

### Step 2: Get Your Dodo Webhook Secret

1. **Go to Dodo Dashboard:**
   - https://dodopayments.com → Dashboard

2. **Find Webhooks:**
   - Click "Webhooks" (Settings or Integrations section)

3. **Get Your Signing Secret:**
   - Look for "Signing Secret" or "Secret Key"
   - Click "Reveal" to see it
   - Copy it (it looks like `whsec_xxxxx...`)

4. **Get Your API Key:**
   - Go to Settings > API Keys
   - Copy the API key (looks like `sk_test_xxxx` or `sk_live_xxxx`)

### Step 3: Update Render Environment Variables

1. **Go to Render Dashboard:**
   - https://render.com → Select your service

2. **Go to Environment section:**
   - Click "Environment" tab
   - You should see existing variables

3. **Add/Update these variables:**
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... (from Supabase)
   GEMINI_API_KEY=AIzaSy... (from Google)
   DODO_API_KEY=sk_test_... (from Dodo)
   DODO_WEBHOOK_SECRET=whsec_... (from Dodo)
   FRONTEND_URL=https://redrule.site
   NODE_ENV=production
   ```

4. **Save and Deploy:**
   - Click "Save Changes"
   - Render will automatically redeploy

### Step 4: Update Dodo Webhook URL

1. **In Dodo Dashboard > Webhooks:**
   - Find your webhook
   - Update the URL to: `https://your-render-url/api/dodo/webhook`
   - Make sure you copy the exact Signing Secret (from Step 2)

2. **Test the webhook (optional):**
   ```bash
   curl -X POST https://your-render-url/api/dodo/webhook \
     -H "Content-Type: application/json" \
     -H "dodo-signature: test" \
     -d '{"type":"checkout.session.completed","data":{"object":{"id":"test_session","metadata":{"userId":"test","planType":"starter"}}}}'
   ```

### Step 5: Test Payment Flow

1. **Use Test Dodo Product:**
   - In Dodo Dashboard, use TEST mode
   - Use test payment methods (card: 4242 4242 4242 4242)

2. **Complete Test Payment:**
   - Go to dashboard
   - Select a plan
   - Click "Upgrade"
   - Complete checkout
   - Should redirect back with `payment=success&session_id=...`

3. **Verify Plan Activated:**
   - After redirect, check your plan displays as "STARTER" or selected plan
   - Check Supabase:
     - Tables > user_plans > Find your user
     - Status should be "active"
     - plan_type should match what you bought

4. **Check Render Logs:**
   - Go to Render Dashboard > Your Service > Logs
   - Look for webhook messages like:
     ```
     ========== PAYMENT SUCCESS ==========
     ✅ PLAN ACTIVATED SUCCESSFULLY!
     ```

---

## 🔧 Troubleshooting

### Problem: "Webhook not received"
**Check:**
1. Render URL in Dodo matches exactly
2. Dodo webhook is enabled (green status)
3. Check Render logs for any errors
4. Render might be sleeping - make a test request to wake it up

**Fix:**
```bash
# Wake up Render service
curl https://your-render-url/api/test
# Then try Dodo webhook again
```

### Problem: "Webhook signature invalid"
**Check:**
1. DODO_WEBHOOK_SECRET is set in Render
2. Secret matches exactly in Dodo Dashboard
3. No extra spaces or characters

**Fix:**
1. Go to Dodo Dashboard > Webhooks
2. Find your webhook
3. Click "Reveal Secret"
4. Copy exact secret (including `whsec_` prefix)
5. Update DODO_WEBHOOK_SECRET in Render
6. Redeploy

### Problem: "No userId in metadata"
**Check:**
1. Check dashboard.js `initiateDodoPayment()` function
2. Verify metadata is passed to Dodo:
   ```javascript
   checkoutUrl.searchParams.set("metadata[userId]", currentUser.id);
   checkoutUrl.searchParams.set("metadata[planType]", planType);
   ```

3. Check browser console during checkout (F12)
4. Check Render logs for what metadata was received

**Fix:**
Make sure dashboard.js line 1600+ is setting metadata correctly:
```javascript
checkoutUrl.searchParams.set("metadata[userId]", currentUser.id);
checkoutUrl.searchParams.set("metadata[email]", currentUser.email);
checkoutUrl.searchParams.set("metadata[planType]", planType);
checkoutUrl.searchParams.set("metadata[billingCycle]", billingCycle);
```

### Problem: "Payment completed but plan not active"
**Check:**
1. Check Render logs for database errors
2. Verify `user_plans` table exists in Supabase
3. Check RLS policies allow service_role to INSERT/UPDATE
4. Verify SUPABASE_SERVICE_ROLE_KEY is correct

**Debug:**
Go to Supabase > SQL Editor and run:
```sql
-- Check if user_plans table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'user_plans';

-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'user_plans';

-- Check if payment was recorded
SELECT * FROM payments 
ORDER BY created_at DESC LIMIT 1;

-- Check if plan was activated
SELECT * FROM user_plans 
ORDER BY updated_at DESC LIMIT 1;
```

### Problem: "Render service is sleeping"
Render spins down free tier services. When inactive, first request takes 30+ seconds.

**Fix:**
1. Upgrade to Paid plan (minimum $7/month)
2. Or keep service awake with periodic ping:
   ```bash
   # Add to cron (every 10 minutes)
   */10 * * * * curl https://your-render-url/api/test
   ```

---

## 📋 Checklist: Complete Setup

- [ ] Supabase project created
- [ ] supabase_setup.sql run in SQL Editor
- [ ] All 5 tables visible in Tables section
- [ ] Dodo account created
- [ ] Dodo products created (Starter, Professional, Enterprise)
- [ ] Dodo API key copied
- [ ] Dodo webhook secret copied
- [ ] Dodo webhook endpoint created with correct URL
- [ ] Render environment variables updated
- [ ] Render service redeployed
- [ ] Test payment completed successfully
- [ ] Plan activated in Supabase
- [ ] Logs show "PLAN ACTIVATED SUCCESSFULLY"

---

## 📞 Support

If issues persist:

1. **Check Render Logs:**
   ```
   Render Dashboard > Your Service > Logs
   Look for lines with 🎉 or ❌
   ```

2. **Check Supabase Logs:**
   ```
   Supabase Dashboard > Logs (bottom left)
   Look for database errors
   ```

3. **Test Webhook Manually:**
   ```bash
   curl -X POST https://your-render-url/api/dodo/webhook \
     -H "Content-Type: application/json" \
     -H "dodo-signature: test_sig" \
     -d '{
       "type": "checkout.session.completed",
       "data": {
         "object": {
           "id": "test_session",
           "amount_total": 129,
           "customer_email": "test@example.com",
           "metadata": {
             "userId": "your-user-id",
             "planType": "starter",
             "billingCycle": "monthly",
             "postsPerMonth": "150"
           }
         }
       }
     }'
   ```

4. **Common Error Messages:**
   - "No session ID found" → Payment not completed
   - "Invalid signature" → DODO_WEBHOOK_SECRET wrong
   - "No userId in metadata" → Checkout URL not passing metadata
   - "Plan activation error" → Database or RLS issue

---

## 🎉 What Happens After Payment

1. **User completes Dodo checkout**
2. **Dodo sends webhook to: `/api/dodo/webhook`**
3. **Webhook verifies signature with DODO_WEBHOOK_SECRET**
4. **Extracts metadata: userId, planType, billingCycle**
5. **Inserts record into `payment_records` table**
6. **Inserts record into `payments` table**
7. **Updates `user_plans` with:**
   - `status: "active"`
   - `plan_type: "starter"` (or selected plan)
   - `credits_remaining: 150` (or plan credits)
   - `expires_at: 2026-01-12` (30 days or 1 year later)
8. **User sees "Current Plan" card with active badge**
9. **User can generate posts up to credit limit**

---

Good luck with your payments! 🚀

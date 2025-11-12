# ✅ IMPLEMENTATION CHECKLIST

## PRE-IMPLEMENTATION CHECKLIST

Gather these before starting:

### From Dodo Dashboard
- [ ] Webhook Signing Secret (Dashboard > Webhooks > [Your Webhook] > Signing Secret)
- [ ] API Key (Dashboard > Settings > API Keys)

### From Supabase
- [ ] Project URL (Settings > API > Project URL)
- [ ] Service Role Key (Settings > API > Service Role Secret)

### From Google
- [ ] Gemini API Key (makersuite.google.com/app/apikey)

### Your Domain
- [ ] Frontend URL (e.g., https://redrule.site)

---

## STEP 1: RENDER ENVIRONMENT VARIABLES (5 min)

**Go to:** Render Dashboard → Your Service → Environment

### Add/Update Variables
- [ ] `DODO_WEBHOOK_SECRET` = [from Dodo Webhooks]
- [ ] `DODO_API_KEY` = [from Dodo API Keys]
- [ ] `SUPABASE_URL` = [from Supabase Settings]
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = [from Supabase Settings]
- [ ] `GEMINI_API_KEY` = [from Google]
- [ ] `FRONTEND_URL` = https://redrule.site
- [ ] `NODE_ENV` = production

### Finalize
- [ ] Click "Save and Deploy"
- [ ] Wait for "Deploy successful" message (usually 2-3 minutes)

---

## STEP 2: SUPABASE DATABASE SETUP (5 min)

**Go to:** Supabase Dashboard → SQL Editor

### Run SQL
- [ ] Copy entire `supabase_setup.sql` file
- [ ] Paste into SQL Editor
- [ ] Click "RUN" button
- [ ] Wait for "Success" message

### Verify Tables Created
**Go to:** Supabase → Tables

Verify these 5 tables exist:
- [ ] user_profiles
- [ ] user_plans
- [ ] post_history
- [ ] payments
- [ ] payment_records

If any missing:
- [ ] Scroll down to find them (refresh page if needed)
- [ ] If still missing, run SQL again

---

## STEP 3: DODO WEBHOOK CONFIGURATION (5 min)

**Go to:** Dodo Dashboard → Webhooks

### Verify/Update Webhook
- [ ] Find your webhook endpoint
- [ ] Update URL to: `https://your-render-url/api/dodo/webhook`
  - Replace `your-render-url` with actual Render URL (e.g., reddit-posts.onrender.com)
- [ ] Verify Signing Secret is visible
- [ ] Copy Signing Secret (you already set it in Step 1)
- [ ] Click "Save"

### Verify Webhook Status
- [ ] Status shows ENABLED (green light)
- [ ] Events include: checkout.session.completed, payment.succeeded

---

## STEP 4: TEST WEBHOOK ENDPOINT (2 min)

**Optional but recommended**

### Test Webhook Reachability
Run in PowerShell or Terminal:
```powershell
curl -X POST https://your-render-url/api/dodo/webhook `
  -H "Content-Type: application/json" `
  -d '{"type":"test"}'
```

Expected response:
- [ ] HTTP 200 (or 400 with message) = ✅ Working
- [ ] Connection refused = ❌ Wrong URL

---

## STEP 5: COMPLETE TEST PAYMENT (15 min)

### Sign In to Dashboard
- [ ] Go to https://redrule.site
- [ ] Sign in with test account (or create one)
- [ ] Wait for dashboard to load

### Navigate to Pricing
- [ ] Click on "Pricing" or "Pricing Plans" section
- [ ] Should see 3 plans: Starter, Professional, Enterprise

### Select and Upgrade Plan
- [ ] Click "Upgrade" on Starter plan
- [ ] Should redirect to Dodo checkout

### Complete Payment
- [ ] Email address shown (should be yours)
- [ ] Click "Pay Now"
- [ ] When payment method form appears:
  - [ ] Card Number: `4242 4242 4242 4242`
  - [ ] Expiry: `12/25` (or any future date)
  - [ ] CVC: `123`
  - [ ] Cardholder: `Test User`
- [ ] Click "Complete Payment"

### Check Success Redirect
- [ ] Should redirect back to dashboard
- [ ] Should see message about payment success
- [ ] URL should contain `payment=success&session_id=...`

---

## STEP 6: VERIFY PLAN ACTIVATED (5 min)

### Check Dashboard
- [ ] Plan badge shows "STARTER" (not "FREE")
- [ ] "Current Plan" card appears
- [ ] Shows credits: 150 / 150
- [ ] Shows billing cycle: Monthly
- [ ] Shows expiry date

### Check Render Logs
**Go to:** Render Dashboard → Your Service → Logs

- [ ] Find "WEBHOOK RECEIVED" message (scroll down if needed)
- [ ] Look for "PAYMENT SUCCESS" section
- [ ] Verify you see: `✅ PLAN ACTIVATED SUCCESSFULLY!`

If you see error messages:
- [ ] Check troubleshooting section below

### Check Supabase
**Go to:** Supabase → Table Editor

#### Check payments table
- [ ] Click "payments"
- [ ] Look for recent row with your email
- [ ] Verify: status = "completed"

#### Check user_plans table
- [ ] Click "user_plans"
- [ ] Find your user_id
- [ ] Verify all are correct:
  - [ ] status = "active"
  - [ ] plan_type = "starter"
  - [ ] credits_remaining = 150
  - [ ] posts_per_month = 150
  - [ ] expires_at = 30 days from now

---

## TROUBLESHOOTING CHECKLIST

### If Webhook Not Received in Logs

- [ ] Check Render URL is exactly correct
- [ ] Check Dodo webhook URL matches
- [ ] Check webhook is ENABLED in Dodo
- [ ] Refresh Render logs page
- [ ] Try test payment again

**If still not working:**
- [ ] Render service might be sleeping
- [ ] Click test endpoint (Step 4) to wake it up
- [ ] Try payment again

### If Signature Invalid Error

- [ ] Go to Dodo Webhooks
- [ ] Copy exact Signing Secret (click "Reveal")
- [ ] Go to Render Environment
- [ ] Update DODO_WEBHOOK_SECRET with exact value
- [ ] Click "Save and Deploy"
- [ ] Wait for deployment
- [ ] Try payment again

### If No UserId in Metadata

This means Dodo not receiving metadata from checkout link.

- [ ] Verify dashboard.js has metadata in checkout URL
- [ ] Look for line like: `checkoutUrl.searchParams.set("metadata[userId]"...`
- [ ] If missing, it's already fixed - redeploy Render
- [ ] Try payment again

### If Plan Not Activating in Supabase

- [ ] Check user_plans table exists
- [ ] Verify RLS policies:
  - [ ] Go to Supabase → SQL Editor
  - [ ] Run: `SELECT * FROM pg_policies WHERE tablename = 'user_plans';`
  - [ ] Should show several policies
  - [ ] If empty, run supabase_setup.sql again

### If Error: "Table Does Not Exist"

- [ ] Supabase → SQL Editor
- [ ] Paste entire supabase_setup.sql again
- [ ] Click RUN
- [ ] Wait for completion
- [ ] Check Tables section again

### Last Resort: Clear and Recreate

If still stuck:
- [ ] Supabase → SQL Editor
- [ ] Run:
  ```sql
  DROP TABLE IF EXISTS payment_records CASCADE;
  DROP TABLE IF EXISTS payments CASCADE;
  DROP TABLE IF EXISTS post_history CASCADE;
  DROP TABLE IF EXISTS user_plans CASCADE;
  DROP TABLE IF EXISTS user_profiles CASCADE;
  ```
- [ ] Paste supabase_setup.sql
- [ ] Click RUN
- [ ] Try payment again

---

## FINAL VERIFICATION

Everything should work if all of these are true:

- [ ] Render environment variables are set
- [ ] Supabase tables created (5 tables visible)
- [ ] Dodo webhook URL is correct
- [ ] Dodo webhook is ENABLED
- [ ] Test payment completed without errors
- [ ] Render logs show "PLAN ACTIVATED"
- [ ] Dashboard shows plan badge
- [ ] Supabase shows status="active"

---

## SUCCESS! 🎉

If you completed all steps and verified above, your payment system is fully working!

**What happens now:**
1. Users can upgrade from dashboard
2. Payment processed by Dodo
3. Webhook activates plan automatically
4. User sees "Current Plan" card
5. User can generate posts with credits

---

## NEED HELP?

Refer to these documents:
- **Quick overview:** `FIX_AT_A_GLANCE.md`
- **Step-by-step:** `COMPLETE_FIX_GUIDE.md`
- **Detailed setup:** `PAYMENT_ACTIVATION_FIX.md`
- **Visual diagrams:** `PAYMENT_FLOW_DIAGRAM.md`
- **Variable reference:** `.env.example`

---

## 📝 Notes Section

Use space below to track your setup:

```
Render URL: ________________________
Dodo Signing Secret: ________________________
Supabase URL: ________________________
Date Started: ________________________
Date Completed: ________________________
Notes: ________________________
```

---

**Print this checklist and check off each item as you complete it!**


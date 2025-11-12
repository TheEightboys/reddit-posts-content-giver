# 🚨 URGENT: Payment Not Activating - Debugging Guide

## Your Issue
```
User: test3@gmail.com
Status: Payment verified ✅
Problem: Plan NOT activating ❌
```

---

## 🔍 IMMEDIATE DIAGNOSTIC STEPS

### Step 1: Check Your Render Logs NOW (2 minutes)
1. Go to **Render Dashboard** → Your Service
2. Click **Logs** tab
3. Look for recent errors like:
   - `❌ DODO_API_KEY not set`
   - `❌ Dodo API error`
   - `❌ Plan activation error`

**Important:** Copy any error messages you see!

### Step 2: Check Environment Variables (2 minutes)
1. Go to **Render Dashboard** → Your Service
2. Click **Environment**
3. Verify these are SET:
   - [ ] `DODO_API_KEY` - Must be set (sk_test_... or sk_live_...)
   - [ ] `SUPABASE_SERVICE_ROLE_KEY` - Must be set
   - [ ] `SUPABASE_URL` - Must be set

**If any are missing:**
1. Add them
2. Click "Save and Deploy"
3. Retry payment

### Step 3: Check Supabase Tables (2 minutes)
1. Go to **Supabase Dashboard** → **Tables**
2. Look for `payment_records` table
3. If missing: **RUN THE SQL AGAIN**
   ```
   Supabase > SQL Editor
   Paste: supabase_setup.sql
   Click: RUN
   ```

---

## 🎯 Most Likely Causes (in order)

### Cause 1: Missing DODO_API_KEY ⚠️ (40% chance)
**Check:**
- Render Environment → Look for `DODO_API_KEY`
- If empty or missing, that's the problem!

**Fix:**
1. Get your Dodo API Key:
   - Go to **Dodo Dashboard** > Settings > API Keys
   - Copy the API key (sk_test_... or sk_live_...)
2. Go to **Render Environment**
3. Paste into `DODO_API_KEY`
4. Click "Save and Deploy"
5. **Retry payment**

### Cause 2: payment_records Table Missing (30% chance)
**Check:**
- Supabase > Tables
- Should see `payment_records` table
- If missing, SQL wasn't run

**Fix:**
1. Go to **Supabase > SQL Editor**
2. Copy entire `supabase_setup.sql`
3. Paste in editor
4. Click "RUN"
5. Verify table appears
6. **Retry payment**

### Cause 3: SUPABASE_SERVICE_ROLE_KEY Wrong (20% chance)
**Check:**
- Render Environment > `SUPABASE_SERVICE_ROLE_KEY`
- Does it start with `eyJhb`?
- Is it the SERVICE ROLE key (not anon key)?

**Fix:**
1. Go to **Supabase** > Settings > API
2. Copy **Service Role Secret** (the long one)
3. Update in **Render Environment**
4. Click "Save and Deploy"
5. **Retry payment**

### Cause 4: RLS Policies Missing (10% chance)
**Check:**
- Run in **Supabase SQL Editor**:
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'user_plans';
  ```
- Should show policies
- If empty, SQL not complete

**Fix:**
1. Re-run entire `supabase_setup.sql`
2. Verify policies now exist
3. **Retry payment**

---

## 🔧 QUICK FIX (Try This First)

1. **Render Dashboard** → Environment
2. Check DODO_API_KEY is set
3. Check SUPABASE_SERVICE_ROLE_KEY is set
4. Click "Save and Deploy"
5. **Try payment again**

If still not working → Check logs for error messages

---

## 📊 Debug Checklist

- [ ] Environment variables all set (DODO_API_KEY, SUPABASE_SERVICE_ROLE_KEY)
- [ ] payment_records table exists
- [ ] user_plans table exists
- [ ] RLS policies exist
- [ ] Render service deployed
- [ ] No recent error logs

---

## 🔍 Reading the Logs

When you retry payment, look for:

✅ **You should see:**
```
✅ User authenticated: test3@gmail.com
✅ Dodo confirmed payment is paid
✅ PLAN ACTIVATED SUCCESSFULLY!
```

❌ **You might see:**
```
❌ DODO_API_KEY not set
❌ Dodo API error: 401
❌ Plan activation error
```

**Copy the error message and check the fix below!**

---

## 🚨 Common Error Messages & Fixes

### Error: "DODO_API_KEY not set"
**Problem:** Environment variable not set
**Fix:** 
1. Render > Environment > Add DODO_API_KEY
2. Get value from Dodo Dashboard > Settings > API Keys
3. Save and Deploy

### Error: "Dodo API error: 401"
**Problem:** API key is invalid
**Fix:**
1. Go to Dodo Dashboard
2. Get fresh API key
3. Update in Render
4. Deploy

### Error: "Dodo API error: 404"
**Problem:** Session ID doesn't exist on Dodo
**Fix:**
1. Check payment actually completed on Dodo side
2. Check session ID is correct in URL
3. Try payment again

### Error: "Plan activation error"
**Problem:** Can't write to Supabase
**Fix:**
1. Check SUPABASE_SERVICE_ROLE_KEY is set correctly
2. Run supabase_setup.sql again
3. Check RLS policies

### Error: "Table does not exist"
**Problem:** payment_records table missing
**Fix:**
1. Supabase > SQL Editor
2. Run supabase_setup.sql
3. Verify tables created

---

## 🧪 Manual Test

After fixing, test with:
1. Dashboard > Pricing
2. Click "Upgrade" on Starter
3. Card: `4242 4242 4242 4242`
4. Complete payment
5. **Check logs immediately** (refresh Render Logs page)
6. Look for "PLAN ACTIVATED"

---

## 📱 What's Happening

When payment goes wrong:
```
User pays → Dodo confirms → Backend calls /api/payment/verify
  ↓
Check DODO_API_KEY exists
  ↓
Query Dodo API for payment status
  ↓
Extract plan from payment metadata
  ↓
INSERT into payment_records
  ↓
UPSERT into user_plans with status="active"
  ↓
Return success to frontend
```

If ANY step fails → Plan doesn't activate

---

## 🆘 If Still Stuck

**Take these steps:**

1. **Gather information:**
   - Copy exact error from Render logs
   - Check all environment variables
   - Verify tables exist in Supabase

2. **Apply this fix:**
   - Redeploy Render (just click deploy again)
   - Re-run supabase_setup.sql
   - Try payment again

3. **Check specific issue:**
   - Look up error message above
   - Follow the fix
   - Retry

---

## ✅ Success Signs

After payment, you should see in dashboard:
- ✅ Plan badge shows "STARTER" (not "FREE")
- ✅ "Current Plan" card appears
- ✅ Credits: 150 / 150
- ✅ Expiry date shown

**If all 4 show → Success!** 🎉

---

## 🎯 Action Now

1. **Open Render Logs** - Look for error
2. **Check Environment** - Verify DODO_API_KEY
3. **Try again** - Do another test payment
4. **Let me know** - Send me the error message!

```
Go to: Render Dashboard > Your Service > Logs
Look for: Recent error messages
Copy: The error text
Tell me: What you see!
```

This will tell me exactly what's wrong and I can fix it!


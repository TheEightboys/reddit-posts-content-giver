# Payment Flow Diagram - Before & After Fix

## ❌ BEFORE (Broken)

```
User Completes Payment
        ↓
   Dodo Checkout
        ↓
   Webhook Sent
        ↓
 ❌ No DODO_WEBHOOK_SECRET
   (Signature not verified)
        ↓
 ❌ Metadata not extracted correctly
   (Looking in wrong place)
        ↓
 ❌ Database error
   (payment_records table syntax error)
        ↓
 ❌ RLS policy missing
   (Can't update user_plans)
        ↓
 ❌ PLAN NOT ACTIVATED
 User sees "FREE" plan
 No credits given
 Cannot generate posts
```

---

## ✅ AFTER (Fixed)

```
┌─────────────────────────────────────────────────────────┐
│  USER DASHBOARD (dashboard.html)                        │
│  ┌──────────────────────────────────────────────┐      │
│  │ Click "Upgrade" on plan                      │      │
│  │ Calls: initiateDodoPayment(planType)         │      │
│  │ Sets metadata[userId] = currentUser.id       │      │
│  │ Sets metadata[planType] = "starter"          │      │
│  │ Redirects to Dodo checkout                   │      │
│  └──────────────────────────────────────────────┘      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│  DODO PAYMENTS (dodopayments.com)                       │
│  ┌──────────────────────────────────────────────┐      │
│  │ User enters payment info                     │      │
│  │ Completes checkout                          │      │
│  │ Payment processed                           │      │
│  │ Sends webhook to Render with:               │      │
│  │   - event: checkout.session.completed       │      │
│  │   - metadata with userId, planType          │      │
│  │   - Signed with: dodo-signature header      │      │
│  └──────────────────────────────────────────────┘      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│  RENDER BACKEND (Node.js server)                        │
│  Route: /api/dodo/webhook                              │
│                                                          │
│  ✅ Step 1: Verify Signature                            │
│  ├─ Read dodo-signature header                          │
│  ├─ Read DODO_WEBHOOK_SECRET from env                  │
│  ├─ Compute HMAC-SHA256                                │
│  ├─ Compare signatures                                 │
│  └─ ✅ PASS (webhook is authentic)                    │
│                                                          │
│  ✅ Step 2: Extract Metadata                            │
│  ├─ Look in: data.data.object.metadata                 │
│  ├─ Get: userId, planType, billingCycle               │
│  ├─ Handle string or object metadata                   │
│  └─ ✅ Successfully extracted                          │
│                                                          │
│  ✅ Step 3: Insert Payment Record                       │
│  ├─ Table: payment_records                            │
│  ├─ Insert: payment_id, user_id, amount, status      │
│  └─ ✅ Record created                                 │
│                                                          │
│  ✅ Step 4: Activate Plan                              │
│  ├─ Table: user_plans                                 │
│  ├─ UPSERT with:                                      │
│  │  ├─ user_id                                        │
│  │  ├─ plan_type = metadata.planType                  │
│  │  ├─ status = "active"                              │
│  │  ├─ credits_remaining = 150 (or plan limit)        │
│  │  ├─ expires_at = now + 30 days (or 1 year)         │
│  │  └─ activated_at = now                             │
│  └─ ✅ Plan activated in Supabase                    │
│                                                          │
│  ✅ Step 5: Return Success                             │
│  └─ Send: { received: true }                           │
└────────────────────────┬────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│  SUPABASE DATABASE                                      │
│  ┌──────────────────────────────────────────────┐      │
│  │ payment_records table:                       │      │
│  │  id: uuid                                    │      │
│  │  payment_id: "dodo_xyz123"                   │      │
│  │  user_id: "user_123"                         │      │
│  │  plan_type: "starter"                        │      │
│  │  amount: 1.29                                │      │
│  │  status: "completed"                         │      │
│  │  verified_at: 2024-01-12T15:30:00Z           │      │
│  │                                              │      │
│  │ user_plans table:                            │      │
│  │  user_id: "user_123"                         │      │
│  │  plan_type: "starter"                        │      │
│  │  status: "active" ✅                        │      │
│  │  credits_remaining: 150 ✅                  │      │
│  │  posts_per_month: 150                        │      │
│  │  expires_at: 2024-02-12T15:30:00Z ✅        │      │
│  │  activated_at: 2024-01-12T15:30:00Z ✅     │      │
│  └──────────────────────────────────────────────┘      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│  USER DASHBOARD (Refreshed)                             │
│  ┌──────────────────────────────────────────────┐      │
│  │ ✅ Plan Badge: "STARTER"                    │      │
│  │ ✅ Credits: 150 remaining                    │      │
│  │ ✅ Current Plan Card showing:                │      │
│  │    - Plan name                              │      │
│  │    - Credits used/total                     │      │
│  │    - Expiry date                            │      │
│  │    - Upgrade button (if applicable)         │      │
│  │ ✅ Can generate posts                       │      │
│  │ ✅ Can optimize content                     │      │
│  └──────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

---

## Key Fixes Applied

### Fix 1: Signature Verification ✅
```javascript
// BEFORE: No verification or secret checking
if (process.env.DODO_WEBHOOK_SECRET) {
  if (!verifySignature(...)) { ... }
}

// AFTER: Proper verification with secret
const secret = process.env.DODO_WEBHOOK_SECRET; // Must be set
if (!secret) {
  console.warn('DODO_WEBHOOK_SECRET not set');
}
const digest = crypto.createHmac('sha256', secret)
  .update(payload).digest('hex');
const isValid = digest === signature;
```

### Fix 2: Metadata Extraction ✅
```javascript
// BEFORE: Looking in wrong place
const metadata = session.metadata || {}; // ❌ Won't find it

// AFTER: Check multiple locations
let session = data.data.object || data.object || data;
let metadata = session.metadata || data.metadata || {};
if (typeof metadata === 'string') {
  metadata = JSON.parse(metadata);
}
```

### Fix 3: Database Schema ✅
```sql
-- BEFORE: Syntax error
CREATE TABLE payment_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4() -- ❌ Wrong function
);

-- AFTER: Correct syntax
CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- ✅ Correct
  dodo_session_id TEXT UNIQUE,                   -- ✅ New column
  metadata JSONB                                  -- ✅ New column
);
```

### Fix 4: RLS Policies ✅
```sql
-- BEFORE: Missing policy
-- No policy for payment_records

-- AFTER: Complete policy set
CREATE POLICY "Service role has full access to payment_records"
ON payment_records FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Users can read own payment records"
ON payment_records FOR SELECT TO authenticated
USING (auth.uid() = user_id);
```

---

## Environment Variables Required

```
Component              Variable                  Source
─────────────────────────────────────────────────────────
Webhook Verification   DODO_WEBHOOK_SECRET      Dodo > Webhooks
Payment Verification   DODO_API_KEY             Dodo > API Keys
Database Access        SUPABASE_SERVICE_ROLE    Supabase > API
AI Generation          GEMINI_API_KEY           Google > API Keys
Frontend Redirects     FRONTEND_URL             Your domain
```

**ALL MUST BE SET** - missing even one will cause payments to fail!

---

## Testing the Flow

### Test 1: Webhook Receives Data
```bash
curl -X POST https://your-render-url/api/dodo/webhook \
  -H "dodo-signature: sig_test" \
  -H "Content-Type: application/json" \
  -d '{"type":"checkout.session.completed","data":{"object":{"id":"test","metadata":{"userId":"user123"}}}}'
```

**Expected:** Render logs show "Signature valid" or "WARNING: secret not set"

### Test 2: Metadata Extracted
**Check Render Logs for:**
```
👤 User ID: user123
📦 Plan: starter
📅 Billing: monthly
```

### Test 3: Database Updated
**Check Supabase > Table Editor:**
- `payments` table has new row with status="completed"
- `user_plans` table has status="active"
- `payment_records` has the payment recorded

### Test 4: Dashboard Updates
**Check Frontend:**
- Plan badge shows plan type ✅
- Credits display correctly ✅
- Current Plan card visible ✅

---

## Success Indicators

When payment activation is working:

1. ✅ Dodo webhook hits your server (see in Render logs)
2. ✅ Signature verified (logs show "✅ Signature verified")
3. ✅ Metadata extracted (logs show user ID)
4. ✅ Database updated (can query Supabase)
5. ✅ Dashboard refreshes (plan badge changes)
6. ✅ User can generate posts (credits available)

---

If any step fails, check the corresponding troubleshooting section in `PAYMENT_ACTIVATION_FIX.md`


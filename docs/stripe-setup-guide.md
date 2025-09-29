# Stripe Payment Setup Guide

## Prerequisites
- Stripe account (Test mode for development)
- Stripe CLI installed (optional but recommended for local testing)

## Step 1: Environment Variables

Add the following to your `.env.local` file:

```env
# Stripe API Keys (from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Webhook Secret (obtained after creating webhook)
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (obtained after creating products)
NEXT_PUBLIC_STRIPE_PRICE_FREE=price_free_xxx
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE_YEARLY=price_xxx

# Base URL for redirects
NEXT_PUBLIC_BASE_URL=https://divergeai.app
```

## Step 2: Create Products in Stripe Dashboard

1. Go to [Stripe Products](https://dashboard.stripe.com/products)
2. Create the following products:

### Free Plan
- **Name**: Free Plan
- **Description**: Get started with basic AI conversations
- **Price**: $0 or skip (no payment needed)

### Pro Plan
- **Name**: Pro Plan  
- **Description**: Perfect for professionals and power users
- **Prices**:
  - Monthly: $20.00 (recurring monthly)
  - Yearly: $200.00 (recurring yearly - 2 months free)

### Enterprise Plan
- **Name**: Enterprise Plan
- **Description**: For teams and organizations with high usage
- **Prices**:
  - Monthly: $100.00 (recurring monthly)
  - Yearly: $1000.00 (recurring yearly - 2 months free)

## Step 3: Configure Webhook Endpoint

### For Production:
1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter URL: `https://divergeai.app/api/stripe/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook signing secret (starts with `whsec_`)

### For Local Testing:
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to your Stripe account
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# The CLI will display your webhook secret
# Copy it to STRIPE_WEBHOOK_SECRET in .env.local
```

## Step 4: Update Price IDs in Code

After creating products, update the price IDs in your environment variables:

1. Go to each product in Stripe Dashboard
2. Copy the Price ID (starts with `price_`)
3. Update the corresponding environment variable

## Step 5: Test the Payment Flow

### Test Cards for Stripe
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **3D Secure**: 4000 0025 0000 3155

### Testing Steps:
1. Start your development server: `npm run dev`
2. If testing webhooks locally, run: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
3. Navigate to `/pricing` page
4. Select a plan and click "Get Started"
5. Complete checkout with test card
6. Verify:
   - Redirect to billing page with success message
   - Subscription created in database
   - User quota updated

## Step 6: Database Verification

Check if tables are created:
```sql
-- Check user subscriptions
SELECT * FROM user_subscriptions WHERE user_id = 'YOUR_USER_ID';

-- Check usage quotas
SELECT * FROM usage_quotas WHERE user_id = 'YOUR_USER_ID';
```

## Step 7: Production Deployment Checklist

- [ ] Switch to live Stripe keys (remove 'test' from keys)
- [ ] Update webhook URL to production domain
- [ ] Set production environment variables in Vercel/hosting platform
- [ ] Test with small real payment first
- [ ] Enable Stripe fraud detection rules
- [ ] Set up billing alerts and monitoring

## Troubleshooting

### Webhook not receiving events
- Check webhook secret is correct
- Verify URL is accessible (no auth blocking)
- Check Stripe webhook logs for errors

### Payment succeeds but subscription not created
- Check database migrations are run
- Verify webhook events are being processed
- Check application logs for errors

### User can't access paid features
- Verify subscription status in database
- Check usage quota is properly initialized
- Ensure model access checks are working

## Support Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Support](https://support.stripe.com/)
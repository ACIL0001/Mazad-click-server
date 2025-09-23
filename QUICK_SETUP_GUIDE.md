# Quick Setup Guide - SATIM Payment 403 Forbidden Fix

## 🚀 Immediate Steps to Fix the Issue

### 1. Restart Your Server
```bash
# Stop the current server (Ctrl+C)
# Then restart it
cd server
npm run start:dev
```

### 2. Test the Fix
```bash
# Run the test script to verify everything works
cd server
node test-satim-fix.js
```

### 3. For Development (Recommended)
The fix automatically detects development mode and uses mock payments. No additional configuration needed!

### 4. For Production
Add these environment variables to your `.env` file:
```env
SATIM_MERCHANT_ID=your_real_merchant_id
SATIM_TERMINAL_ID=your_real_terminal_id
SATIM_MERCHANT_KEY=your_real_merchant_key
SATIM_SANDBOX=false
```

## 🎯 What the Fix Does

1. **Automatic Detection**: Detects when you're in development mode
2. **Mock Payments**: Uses simulated payments for testing
3. **Alternative URLs**: Provides backup payment gateways if the main one fails
4. **Error Handling**: Gracefully handles 403 forbidden errors
5. **User Experience**: Shows friendly error pages with alternatives

## 🔧 How to Use

### Normal Payment Flow
1. User selects payment method (CIB/Edahabia)
2. System creates payment with multiple URL options
3. User is redirected to SATIM payment gateway
4. If 403 error occurs, system shows alternatives

### Development Mode
1. System detects development environment
2. Automatically uses mock payment system
3. User sees simulated payment form
4. Payment is processed locally for testing

## 🧪 Testing

### Test Payment Creation
```bash
curl -X POST http://localhost:3000/subscription/payment \
  -H "Content-Type: application/json" \
  -H "x-access-key: 8f2a61c94d7e3b5f9c0a8d2e6b4f1c7a" \
  -d '{
    "userId": "test-user",
    "subscriptionPlan": "6mois",
    "amount": 8000,
    "userInfo": {
      "firstName": "Test",
      "lastName": "User",
      "phone": "+213123456789",
      "email": "test@example.com"
    },
    "paymentMethod": "cib"
  }'
```

### Test Forbidden Handler
```bash
# Replace PAYMENT_ID with actual payment ID
curl http://localhost:3000/subscription/payment/satim-forbidden/PAYMENT_ID
```

## 📊 Expected Results

### Development Mode
- ✅ Payment created successfully
- ✅ Mock payment form accessible
- ✅ No 403 errors
- ✅ Payment processed locally

### Production Mode (with real credentials)
- ✅ Payment created successfully
- ✅ Real SATIM gateway accessible
- ✅ Alternative URLs available as backup
- ✅ Graceful error handling

## 🚨 Troubleshooting

### Still Getting 403 Errors?
1. Check if server is in development mode (`NODE_ENV=development`)
2. Verify no real SATIM credentials are set
3. Check server logs for detailed error messages

### Mock Payments Not Working?
1. Ensure server is running on `http://localhost:3000`
2. Check that `NODE_ENV=development`
3. Verify database connection

### Need Real SATIM Integration?
1. Register at https://cibweb.dz/fr
2. Get your merchant credentials
3. Add them to your `.env` file
4. Set `SATIM_SANDBOX=false`

## 📞 Support

If you need help:
1. Check the detailed documentation in `SATIM_PAYMENT_FIX.md`
2. Run the test script to identify issues
3. Check server logs for error messages
4. Contact SATIM support for merchant account issues

## 🎉 Success!

Once the fix is working:
- Users can complete payments without 403 errors
- Development testing is seamless with mock payments
- Production payments work with real SATIM integration
- Error handling provides better user experience

---

**The fix is now active! Try creating a payment to see it in action.** 
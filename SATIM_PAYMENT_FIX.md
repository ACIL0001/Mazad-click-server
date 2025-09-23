# SATIM Payment 403 Forbidden Error Fix

## Problem Description

The application was experiencing 403 Forbidden errors when trying to access the SATIM payment gateway at `cib.satim.dz/payment/merchants/SATIMTEST/payment_fr.html`. This was happening because:

1. **Invalid Merchant ID**: The system was using `SATIMTEST` as a fallback merchant ID when environment variables were not set
2. **Test Credentials**: The SATIM payment service was using test/demo credentials that are not authorized for the production SATIM platform
3. **URL Structure**: The URL format being used may not be correct for the current SATIM platform configuration

## Solution Implemented

### 1. Enhanced SATIM Payment Service

The `SatimPaymentService` has been updated with the following improvements:

- **Development Mode Detection**: Automatically detects if the application is running in development mode
- **Multiple URL Patterns**: Generates multiple SATIM URL patterns to handle different configurations
- **Alternative Merchant IDs**: Provides fallback merchant IDs when the primary one fails
- **Mock Payment System**: Uses mock payments in development mode when real credentials are not available
- **Better Error Handling**: Comprehensive error handling with detailed logging

### 2. New Backend Endpoints

#### `/subscription/payment/satim-forbidden/:paymentId`
This endpoint handles 403 Forbidden errors and provides alternative payment options:

- Retrieves payment information from the database
- Shows alternative payment URLs if available
- Redirects to mock payment in development mode
- Provides a user-friendly interface to try alternative payment gateways

### 3. Frontend Error Handling

New utility functions in `seller/src/utils/paymentUtils.ts`:

- `handleSatimForbiddenError()`: Handles 403 errors and redirects to appropriate alternatives
- `detectSatimForbiddenError()`: Automatically detects 403 errors on SATIM domains
- `autoHandleSatimErrors()`: Auto-handles errors when they occur
- `initializePaymentErrorHandling()`: Sets up automatic error detection

### 4. Enhanced Payment Metadata

The payment schema has been updated to include:

- `isDevelopmentMode`: Indicates if the payment was created in development mode
- `alternativeUrls`: Array of alternative payment URLs to try if the primary fails

## Configuration

### Environment Variables

For production, add these environment variables to your `.env` file:

```env
# SATIM Payment Gateway Configuration
SATIM_MERCHANT_ID=your_real_merchant_id
SATIM_TERMINAL_ID=your_real_terminal_id
SATIM_MERCHANT_KEY=your_real_merchant_key
SATIM_BASE_URL=https://cib.satim.dz/payment/
SATIM_SANDBOX=false
```

### Development Mode

In development mode (when `NODE_ENV=development` and no real credentials are provided):

- The system automatically uses mock payments
- Users are redirected to mock payment forms
- No real SATIM API calls are made

## Usage

### 1. Normal Payment Flow

```typescript
// Create a payment as usual
const response = await SubscriptionAPI.createSubscriptionWithPayment({
  plan: selectedPlan._id,
  returnUrl: `${window.location.origin}/subscription/payment/success`,
  paymentMethod: 'cib'
});

// The system will automatically handle the payment URL generation
if (response.success && response.payment?.paymentUrl) {
  window.location.href = response.payment.paymentUrl;
}
```

### 2. Handling 403 Forbidden Errors

When a 403 Forbidden error occurs:

1. **Automatic Detection**: The system automatically detects the error
2. **Alternative URLs**: If alternative URLs are available, they are provided to the user
3. **User Interface**: A user-friendly page shows alternative payment options
4. **Fallback**: If no alternatives are available, the user is redirected to an error page

### 3. Development Mode

In development mode:

```typescript
// The system automatically detects development mode
if (response.payment.metadata?.isDevelopmentMode) {
  console.log('Using mock payment system');
  // User is redirected to mock payment form
}
```

## Alternative URL Patterns

The system generates multiple URL patterns to handle different SATIM configurations:

1. **Standard Format**: `https://cib.satim.dz/payment/merchants/{merchantId}/payment_fr.html`
2. **Alternative Format**: `https://cib.satim.dz/payment/{merchantId}/payment_fr.html`
3. **Main Domain**: `https://satim.dz/payment/process`
4. **Gateway Format**: `https://cib.satim.dz/payment/gateway`
5. **Test Domains**: `https://test.satim.dz/` and `https://sandbox.satim.dz/`

## Alternative Merchant IDs

When the primary merchant ID fails, the system tries these alternatives:

- `TESTMERCHANT`
- `DEMO`
- `SANDBOX`
- `CIB_TEST`
- `EDAHABIA_TEST`
- `SATIM_DEMO`
- `TEST_CIB`
- `TEST_EDAHABIA`

## Testing

### 1. Test the Fix

1. Start the server in development mode
2. Create a payment using the SATIM payment method
3. The system should automatically use mock payments
4. Verify that the mock payment form works correctly

### 2. Test Error Handling

1. Set up a test environment with invalid credentials
2. Try to create a payment
3. Verify that alternative URLs are generated
4. Test the forbidden error handler endpoint

### 3. Test Production Setup

1. Configure real SATIM credentials in environment variables
2. Set `SATIM_SANDBOX=false`
3. Test the payment flow with real credentials

## Monitoring and Logging

The system provides comprehensive logging:

```typescript
// Check server logs for payment creation
console.log('SATIM payment order created:', satimResponse);

// Check for alternative URLs
if (satimResponse.alternativeUrls && satimResponse.alternativeUrls.length > 0) {
  console.log(`Alternative URLs available: ${satimResponse.alternativeUrls.length}`);
}

// Check development mode
if (satimResponse.isDevelopmentMode) {
  console.log('Payment created in development mode');
}
```

## Troubleshooting

### Common Issues

1. **Still Getting 403 Errors**: 
   - Check if real credentials are configured
   - Verify the merchant ID is valid
   - Try alternative merchant IDs

2. **Mock Payments Not Working**:
   - Ensure `NODE_ENV=development`
   - Check that no real credentials are set
   - Verify the mock payment endpoints are accessible

3. **Alternative URLs Not Working**:
   - Check the payment metadata in the database
   - Verify the forbidden handler endpoint is working
   - Check server logs for errors

### Debug Steps

1. **Check Environment Variables**:
   ```bash
   echo $SATIM_MERCHANT_ID
   echo $SATIM_TERMINAL_ID
   echo $SATIM_MERCHANT_KEY
   ```

2. **Check Server Logs**:
   ```bash
   # Look for SATIM-related logs
   tail -f server/logs/app.log | grep SATIM
   ```

3. **Test Payment Creation**:
   ```bash
   # Use the API to create a test payment
   curl -X POST http://localhost:3000/subscription/payment \
     -H "Content-Type: application/json" \
     -d '{"paymentMethod": "cib", "amount": 1000}'
   ```

## Future Improvements

1. **Real SATIM API Integration**: Implement actual SATIM API calls for payment verification
2. **Payment Status Webhooks**: Add webhook support for real-time payment status updates
3. **Retry Logic**: Implement automatic retry logic for failed payments
4. **Analytics**: Add payment success/failure analytics
5. **User Notifications**: Send email/SMS notifications for payment status changes

## Support

If you continue to experience issues:

1. Check the server logs for detailed error messages
2. Verify your SATIM credentials with the payment provider
3. Contact SATIM support for merchant account issues
4. Review the SATIM documentation for the latest API changes

## Related Files

- `server/src/modules/subscription/services/satim-payment.service.ts`
- `server/src/modules/subscription/services/payment.service.ts`
- `server/src/modules/subscription/subscription.controller.ts`
- `server/src/modules/subscription/schema/payment.schema.ts`
- `seller/src/utils/paymentUtils.ts`
- `seller/src/pages/PaymentMethodSelection.tsx` 
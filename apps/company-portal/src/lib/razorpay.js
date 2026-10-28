/**
 * Razorpay Checkout SDK Helper for Company Portal (Franchise Owners)
 */

export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('Failed to load Razorpay Checkout script from CDN.');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout({
  orderId,
  amount,
  currency = 'INR',
  keyId,
  name = 'Rupadiya Franchise Operations',
  description = 'Company Wallet Fund Deposit',
  prefill = {},
  notes = {},
  onSuccess = () => {},
  onDismiss = () => {}
}) {
  const isLoaded = await loadRazorpayScript();

  if (!isLoaded || !window.Razorpay) {
    const proceedTest = confirm(
      `[Razorpay Gateway Simulation]\n\n` +
      `Amount: ₹${Number(amount).toLocaleString('en-IN')}\n` +
      `Order: ${orderId}\n` +
      `Purpose: ${description}\n\n` +
      `Click OK to simulate successful company deposit capture, or Cancel to dismiss.`
    );
    if (proceedTest) {
      onSuccess({
        razorpay_order_id: orderId,
        razorpay_payment_id: `pay_sim_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
        razorpay_signature: `sig_sim_${Date.now()}`
      });
    } else {
      onDismiss();
    }
    return;
  }

  const options = {
    key: keyId || 'rzp_test_rupadiya_demo',
    amount: Math.round(Number(amount) * 100),
    currency,
    name,
    description,
    image: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    order_id: orderId,
    prefill: {
      name: prefill.name || 'Company Owner',
      email: prefill.email || 'owner@rupadiya.com',
      contact: prefill.contact || prefill.phone || '9876543210'
    },
    notes: {
      platform: 'Rupadiya Company Portal',
      ...notes
    },
    theme: {
      color: '#1D4ED8' // Royal Blue for Company
    },
    handler: function (response) {
      onSuccess({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature
      });
    },
    modal: {
      ondismiss: function () {
        if (onDismiss) onDismiss();
      }
    }
  };

  const rzp = new window.Razorpay(options);
  rzp.on('payment.failed', function (response) {
    alert(`Payment failed: ${response.error?.description || 'Gateway transaction declined'}`);
  });
  rzp.open();
}


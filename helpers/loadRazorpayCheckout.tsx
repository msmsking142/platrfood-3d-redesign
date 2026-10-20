export type CheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayCheckout = {
  open: () => void;
  on: (event: "payment.failed", callback: () => void) => void;
};

export type RazorpayConstructor = new (options: {
  key: string;
  amount: number;
  currency: "INR";
  order_id: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (response: CheckoutResponse) => void | Promise<void>;
  modal: { ondismiss: () => void };
}) => RazorpayCheckout;

let checkoutScriptPromise: Promise<RazorpayConstructor> | undefined;

export function loadRazorpayCheckout(): Promise<RazorpayConstructor> {
  checkoutScriptPromise ??= new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      const Razorpay = (window as Window & { Razorpay?: RazorpayConstructor }).Razorpay;
      if (Razorpay) {
        const RazorpayCtor = Razorpay;
        class InteractiveRazorpayCheckout implements RazorpayCheckout {
          private readonly checkout: RazorpayCheckout;

          constructor(options: ConstructorParameters<RazorpayConstructor>[0]) {
            this.checkout = new RazorpayCtor(options);
          }

          open(): void {
            this.checkout.open();
            document.querySelectorAll<HTMLElement>(".razorpay-container").forEach((container) => {
              container.style.pointerEvents = "auto";
            });
            if (document.body.style.pointerEvents === "none") {
              document.body.style.pointerEvents = "";
            }
          }

          on(event: "payment.failed", callback: () => void): void {
            this.checkout.on(event, callback);
          }
        }

        resolve(InteractiveRazorpayCheckout);
      } else {
        script.remove();
        reject(new Error("Razorpay checkout did not load. Please try again."));
      }
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("Could not load Razorpay checkout. Check your connection and try again."));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    checkoutScriptPromise = undefined;
    throw error;
  });

  return checkoutScriptPromise;
}
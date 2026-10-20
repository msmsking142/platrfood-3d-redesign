import superjson from "superjson";
import { z } from "zod";
import {
  getRazorpayCredentials,
} from "../../helpers/razorpayProPayment";
import { schema, type OutputType, type PaymentMethodGroup } from "./methods_GET.schema";

const methodsSchema = z.record(z.unknown());

const cardNames: Record<string, string> = {
  VISA: "Visa",
  MC: "Mastercard",
  RUPAY: "RuPay",
  AMEX: "American Express",
  DICL: "Diners Club",
  MAES: "Maestro",
  JCB: "JCB",
};

const walletNames: Record<string, string> = {
  paytm: "Paytm",
  phonepe: "PhonePe",
  amazonpay: "Amazon Pay",
  mobikwik: "MobiKwik",
  freecharge: "Freecharge",
  airtelmoney: "Airtel Money",
  olamoney: "Ola Money",
  jiomoney: "JioMoney",
  payzapp: "PayZapp",
};

const providerNames: Record<string, string> = {
  simpl: "Simpl",
  getsimpl: "Simpl",
  lazypay: "LazyPay",
  icic: "ICICI PayLater",
  icici: "ICICI PayLater",
  hdfcflexipay: "HDFC FlexiPay",
};

const preferredBanks = [
  { match: /sbi|state bank/i, name: "State Bank of India" },
  { match: /hdfc/i, name: "HDFC Bank" },
  { match: /icic/i, name: "ICICI Bank" },
  { match: /axis|utib/i, name: "Axis Bank" },
  { match: /kotak|kkbk/i, name: "Kotak Mahindra Bank" },
  { match: /pnb|punb|punjab national/i, name: "Punjab National Bank" },
  { match: /bob|barb|bank of baroda/i, name: "Bank of Baroda" },
];

let cached: { value: OutputType; expiresAt: number } | null = null;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readableCode(code: string): string {
  return code.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function enabledProviders(
  value: unknown,
  names: Record<string, string>,
): string[] {
  return [...new Set(
    Object.entries(record(value))
      .filter(([, enabled]) => enabled === true)
      .map(([code]) => {
        const normalized = code.toLowerCase().replace(/[^a-z0-9]/g, "");
        return names[normalized] ?? readableCode(code);
      }),
  )];
}

function buildGroups(response: unknown): OutputType {
  const methods = methodsSchema.parse(response);
  console.log("Razorpay payment method response keys:", Object.keys(methods));
  const groups: PaymentMethodGroup[] = [];

  if (methods.upi === true) {
    groups.push({
      id: "upi",
      title: "UPI",
      description: "Pay using a UPI app.",
      items: ["Google Pay", "PhonePe", "Paytm", "BHIM", "Any UPI app"],
    });
  }

  if (methods.card === true) {
    const networks = Object.entries(record(methods.card_networks))
      .filter(([, enabled]) => enabled === true)
      .map(([code]) => cardNames[code.toUpperCase()] ?? readableCode(code));
    groups.push({
      id: "card",
      title: "Cards",
      description: "Credit and debit cards.",
      items: networks.length ? [...new Set(networks)] : ["Credit cards", "Debit cards"],
    });
  }

  const banks = Object.entries(record(methods.netbanking))
    .filter(([, name]) => typeof name === "string" && name.trim().length > 0)
    .map(([code, name]) => ({ code, name: name as string }));

  if (banks.length) {
    const leading = preferredBanks.flatMap(({ match, name }) =>
      banks.some((bank) => match.test(`${bank.code} ${bank.name}`)) ? [name] : [],
    );
    const other = banks
      .map((bank) => bank.name)
      .filter((name) => !preferredBanks.some((bank) => bank.match.test(name)));

    groups.push({
      id: "netbanking",
      title: "Netbanking",
      description: "Pay directly through your bank.",
      items: [...new Set([...leading, ...other])].slice(0, 8),
      count: banks.length,
    });
  }

  const wallets = enabledProviders(methods.wallet, walletNames);
  if (wallets.length) {
    groups.push({
      id: "wallet",
      title: "Wallets",
      description: "Supported payment wallets.",
      items: wallets,
    });
  }

  if (methods.emi === true) {
    groups.push({
      id: "emi",
      title: "EMI",
      description: "Eligibility and plans are shown at checkout.",
      items: ["Card EMI"],
    });
  }

  const payLater = enabledProviders(methods.paylater, providerNames);
  if (payLater.length) {
    groups.push({
      id: "paylater",
      title: "Pay later",
      description: "Subject to provider eligibility.",
      items: payLater,
    });
  }

  const cardlessEmi = enabledProviders(methods.cardless_emi, providerNames);
  if (cardlessEmi.length) {
    groups.push({
      id: "cardless_emi",
      title: "Cardless EMI",
      description: "Subject to provider eligibility.",
      items: cardlessEmi,
    });
  }

  return { source: "razorpay", groups };
}

function defaultMethods(): OutputType {
  return {
    source: "default",
    groups: [
      {
        id: "upi",
        title: "UPI",
        description: "Check availability at checkout.",
        items: ["Google Pay", "PhonePe", "Paytm", "BHIM", "Any UPI app"],
      },
      {
        id: "card",
        title: "Cards",
        description: "Check availability at checkout.",
        items: ["Visa", "Mastercard", "RuPay"],
      },
      {
        id: "netbanking",
        title: "Netbanking",
        description: "Available banks are confirmed at checkout.",
        items: ["Netbanking"],
      },
      {
        id: "wallet",
        title: "Wallets",
        description: "Available wallets are confirmed at checkout.",
        items: ["Payment wallets"],
      },
    ],
  };
}

export async function handle(request: Request) {
  schema.parse({});

  if (cached && cached.expiresAt > Date.now()) {
    return new Response(superjson.stringify(cached.value), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { keyId, secret } = getRazorpayCredentials();
    let value: OutputType | undefined;

    for (const password of ["", secret]) {
      const response = await fetch("https://api.razorpay.com/v1/methods", {
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${password}`).toString("base64")}`,
        },
      });

      if (response.ok) {
        value = buildGroups(await response.json());
        break;
      }

      let description: string | undefined;
      try {
        const errorBody = z.object({
          error: z.object({ description: z.string().optional() }).passthrough().optional(),
        }).passthrough().safeParse(JSON.parse(await response.text()));
        description = errorBody.success
          ? errorBody.data.error?.description?.slice(0, 200)
          : undefined;
      } catch {
        // Razorpay did not return a JSON error body.
      }
      console.error("Razorpay payment methods request failed:", {
        status: response.status,
        ...(description ? { description } : {}),
      });
    }

    if (!value) {
      throw new Error("Razorpay payment methods request failed with both authentication methods");
    }
    cached = { value, expiresAt: Date.now() + 60 * 60 * 1000 };
    return new Response(superjson.stringify(value), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Could not load Razorpay payment methods:", error);
    const value = defaultMethods();
    cached = { value, expiresAt: Date.now() + 5 * 60 * 1000 };
    return new Response(superjson.stringify(value), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
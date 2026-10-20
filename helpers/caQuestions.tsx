const intro = [
  "platr™ is a food delivery app (e-commerce operator).",
  "We pay GST on restaurant food u/s 9(5).",
  "Please answer each question in 1–2 lines.",
];

const questions = [
  {
    no: 1,
    title: "GST on delivery fee",
    text: "GST on the delivery fee charged to customers: 18% or 5% (no ITC)? Some sources cite an Oct 2026 PIB note saying 5% under Sec 9(5). The app currently uses 18%.",
  },
  {
    no: 2,
    title: "GST on food",
    text: "GST on food: we charge 5% on food and pay it as ECO under Sec 9(5), with no TCS. Correct?",
  },
  {
    no: 3,
    title: "Pro subscription GST",
    text: "Pro subscription for restaurants: we will charge ₹2,499 + 18% GST = ₹2,949 (rounded). Is the rate correct, and which SAC code applies?",
  },
  {
    no: 4,
    title: "GST on commission",
    text: "GST on our commission to restaurants (15% Basic / 8% Pro): is 18% correct? Does the restaurant pay GST on top of the commission?",
  },
  {
    no: 5,
    title: "Platform fee GST",
    text: "Platform fee (₹0 now, maybe ₹3 later): is 18% GST correct?",
  },
  {
    no: 6,
    title: "TDS on restaurant payouts",
    text: "Income-tax TDS on restaurant payouts: 0.1% of food sales with PAN, 5% without PAN (Sec 393(1), earlier 194-O), deducted weekly from the payout. Correct? Which form/return do we file, and when?",
  },
  {
    no: 7,
    title: "Riders – TDS/GST",
    text: "Riders: we pay base + distance + incentive weekly. Do we need to deduct TDS or collect GST from riders?",
  },
  {
    no: 8,
    title: "Input tax credit",
    text: "Can we claim ITC on Razorpay fees, hosting and CA fees against GST on commission, Pro fees and delivery?",
  },
  {
    no: 9,
    title: "Customer invoice",
    text: "Customer invoice: do we need a numbered GST tax invoice for every order? What invoice number format and details must it show?",
  },
  {
    no: 10,
    title: "Restaurant invoice",
    text: "Restaurant invoice: should we issue a monthly invoice for commission + Pro fee? What format should it use?",
  },
  {
    no: 11,
    title: "Founder income tax",
    text: "Income tax for me (sole proprietor, new regime): does the ₹12 lakh rebate apply to business profit? Is advance tax needed?",
  },
  {
    no: 12,
    title: "Other registrations",
        text: "Any other registration needed for platr™ in Uttarakhand (GST as ECO, TAN, professional tax, FSSAI for platr™)?",
  },
  {
    no: 13,
    title: "platr™ Wallet",
    text: "Customers pre-load a closed-loop platr™ Wallet (non-withdrawable, usable only on platr™). Is the top-up an advance, with GST applying only at order time? How do we show unspent wallet balance in our accounts (customer advance/liability)? Any RBI PPI concern since it is closed-loop?",
  },
];

export const caQuestions = {
  intro,
  questions,
  buildCopyText(answers: Record<number, string>): string {
    return [
      ...intro,
      "",
      ...questions.flatMap(({ no, text }) => [
        `${no}. ${text}`,
        `Answer: ${answers[no]?.trim() ?? ""}`,
        "",
      ]),
      "Please reply in 1–2 lines per question.",
    ].join("\n");
  },
};
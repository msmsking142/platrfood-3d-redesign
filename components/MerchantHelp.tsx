import { Mail, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { Button } from "./Button";
import { CallSupportButton } from "./CallSupportButton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./Accordion";
import { MerchantSectionHeader, MerchantCard } from "./MerchantUi";
import styles from "./MerchantHelp.module.css";

const FAQS = [
  { q: "How do I start receiving orders?", a: "Complete verification (FSSAI licence), add at least a few dishes in Menu Editor, then switch your outlet to Open from Overview. New orders appear in Orders with a red badge." },

  { q: "How are orders and food GST handled?", a: "All orders are paid online; there is no cash collection. platr™ collects 5% GST on food from customers and pays it to the government under Section 9(5) of the CGST Act. Restaurants do not charge food GST separately on platr™ orders." },
  { q: "Who pays the rider?", a: "platr™ pays riders a base pay plus distance pay and incentives. Rider pay is never deducted from your earnings." },
  { q: "What happens if I reject an order?", a: "The customer is notified with the reason you enter. Frequent rejections can lower your visibility, so mark dishes as Hidden when they run out." },
  { q: "Why is my outlet closed after I uploaded a new licence?", a: "Every new licence is re-checked by the platr™ team. Your outlet is closed during review and you can reopen once it is approved – usually within 1–2 working days." },
  { q: "When do I get paid?", a: "All orders are paid online. Delivered orders are included in the weekly Friday payout to your saved bank account or UPI ID. Your Finance page shows each order's payout breakdown." },
];

export const MerchantHelp = ({ className }: { className?: string }) => {
  const settings = ziptoHooks.useSettings();
  const basicPct = settings.data?.basicCommissionPercent ?? 15;
  const proPct = settings.data?.proCommissionPercent ?? 8;
  const proFee = settings.data?.proMonthlyFee ?? 2499;
  const proTotal = settings.data?.proMonthlyTotal ?? 2949;
  const proGstPercent = settings.data?.proGstPercent ?? 18;
  const faqs = [
    FAQS[0],
    { q: "How much commission does platr™ take?", a: `Basic: ₹0 monthly fee and ${basicPct}% commission per order. Pro: ${ziptoConfig.rupees(proFee)} + GST / 30 days (${ziptoConfig.rupees(proTotal)} total at ${proGstPercent}% GST) and ${proPct}% commission per order. Commission applies to the food subtotal, not delivery or platform fees; 18% GST applies to commission.` },
    { q: "Kya platr™ koi extra charge leta hai?", a: `Sirf commission (${basicPct}% Basic / ${proPct}% Pro) + uspar 18% GST. Pro subscription par ${proGstPercent}% GST bhi lagta hai. Koi payment gateway fee, support-order charge ya rejection penalty nahi.` },
    ...FAQS.slice(1),
  ];

  return (
    <div className={`${styles.wrap} ${className || ""}`}>
      <MerchantSectionHeader eyebrow="Help Centre" title="How can we help?" subtitle="Quick answers for platr™ partners, and a direct line to our team." />
      <div className={styles.grid}>
        <MerchantCard>
          <h3 className={styles.h3}><BookOpen size={18} /> Frequently asked questions</h3>
          {settings.isError && <p role="alert">Could not load current plan pricing: {settings.error.message}. Showing indicative prices.</p>}
          <Accordion type="single" collapsible>
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={String(i)}>
                <AccordionTrigger>{f.q}</AccordionTrigger>
                <AccordionContent>{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </MerchantCard>
        <MerchantCard tone="gold">
          <h3 className={styles.h3}><Mail size={18} /> Contact partner support</h3>
          <p className={styles.supportText}>Need help? Our partner support team is here for you.</p>
          <Button asChild>
            <Link to="/support">Contact platr™ Support</Link>
          </Button>
          <CallSupportButton label="Call partner support" />
        </MerchantCard>
      </div>
    </div>
  );
};
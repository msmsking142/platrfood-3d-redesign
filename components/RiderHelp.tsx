import { Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./Accordion";
import { Button } from "./Button";
import { MerchantCard, MerchantSectionHeader } from "./MerchantUi";
import { Skeleton } from "./Skeleton";
import styles from "./RiderHelp.module.css";

const faqs = [
  {
    question: "How do I start receiving orders?",
    answer: "Upload your driving licence and selfie in Verification. Once platr™ approves you, switch Online. Nearby orders in your town appear in Orders; the first rider to accept gets the order.",
  },
  {
    question: "Do I collect cash?",
    answer: "No. All platr™ orders are paid online, so you never collect cash. Just hand over the order and mark it delivered.",
  },

  {
    question: "How long does verification take?",
    answer: "After you upload both documents, review usually takes up to 24 hours. If a document is rejected, read the review note and upload a clear licence and selfie again.",
  },
];

export const RiderHelp = ({ className }: { className?: string }) => {
  const settings = ziptoHooks.useSettings();

  return (
  <div className={`${styles.wrap} ${className ?? ""}`}>
    <MerchantSectionHeader
      eyebrow="Help Centre"
      title="Need a hand?"
      subtitle="Quick answers for delivery partners. Our support team is here to help."
    />
    <div className={styles.grid}>
      <MerchantCard>
        <h2 className={styles.heading}>Frequently asked questions</h2>
        <Accordion type="single" collapsible>
          {faqs.map(({ question, answer }, index) => (
            <AccordionItem key={question} value={String(index)}>
              <AccordionTrigger>{question}</AccordionTrigger>
              <AccordionContent>{answer}</AccordionContent>
            </AccordionItem>
          ))}
          <AccordionItem value="payouts">
            <AccordionTrigger>How do rider payouts work?</AccordionTrigger>
            <AccordionContent>
              {settings.isFetching && !settings.data ? (
                <Skeleton className={styles.paySkeleton} />
              ) : settings.isError ? (
                <div role="alert">
                  Could not load current pay rates.{" "}
                  <Button variant="secondary" size="sm" onClick={() => void settings.refetch()}>Retry</Button>
                </div>
              ) : settings.data ? (
                <>
                  Delivery pay is {ziptoConfig.rupees(settings.data.riderBasePay)} base for the first {settings.data.riderBaseKm} km,
                  plus {ziptoConfig.rupees(settings.data.riderPerKm)}/km after that and a {ziptoConfig.rupees(settings.data.riderIncentive)} incentive.
                  The customer delivery fee matches rider pay — delivery fee seedha rider ko.
                  Eligible earnings are paid weekly after batch approval to your UPI or bank.
                </>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </MerchantCard>
      <MerchantCard tone="gold" className={styles.contact}>
        <Mail size={28} aria-hidden="true" />
        <h2 className={styles.heading}>Rider support</h2>
        <p>Tell us your issue and include your order number if it's about a delivery.</p>
        <Button asChild size="lg">
          <Link to="/support">Contact platr™ Support</Link>
        </Button>
      </MerchantCard>
    </div>
  </div>
  );
};
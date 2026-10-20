import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Crown } from "lucide-react";
import type { OutputType } from "../endpoints/restaurant/dashboard_GET.schema";
import { postRestaurantAction } from "../endpoints/restaurant/action_POST.schema";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { formatProDate, useMerchantProCheckout } from "../helpers/useMerchantProCheckout";
import { hasExplicitRenewalConsent } from "../helpers/proTrialEligibility";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./Dialog";
import { MerchantSectionHeader, MerchantCard } from "./MerchantUi";
import styles from "./MerchantSubscription.module.css";

export const MerchantSubscription = ({ data, className }: { data: OutputType; className?: string }) => {
  const r = data.restaurant!;
  const settings = ziptoHooks.useSettings();
  const s = settings.data;
  const basicPct = s?.basicCommissionPercent ?? 15;
  const proPct = s?.proCommissionPercent ?? 8;
  const proFee = s?.proMonthlyFee ?? 2499;
  const proGst = s?.proMonthlyGst ?? 450;
  const proTotal = s?.proMonthlyTotal ?? 2949;
  const proGstPercent = s?.proGstPercent ?? 18;
  const act = ziptoHooks.useAction((x: Parameters<typeof postRestaurantAction>[0]) => postRestaurantAction(x), [ziptoHooks.keys.restaurantDashboard], "Plan updated");
  const checkout = useMerchantProCheckout();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [continueOpen, setContinueOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [trialConsent, setTrialConsent] = useState(false);
  const [continueConsent, setContinueConsent] = useState(false);
  const activePro = r.plan === "pro" && r.proPaidUntil !== null && r.proPaidUntil > new Date();
  const trial = data.proTrial;
  const trialEnd = trial.endsAt;
  const prospectiveEnd = new Date(Date.now() + trial.days * 24 * 60 * 60 * 1000);
  const daysLeft = trialEnd ? Math.max(1, Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : 0;
  const breakEven = basicPct > proPct ? Math.ceil(proFee / (400 * ((basicPct - proPct) / 100))) : null;
  const breakEvenSales = basicPct > proPct
    ? Math.round(proFee / ((basicPct - proPct) / 100) / 1000) * 1000
    : null;

  const plans = [
    { id: "basic" as const, name: "Basic", price: "₹0", per: "/month", pct: basicPct, perks: ["No monthly fee", `You keep ${100 - basicPct}% of food sales`, "Best for new or small outlets"], payout: 400 - Math.round(400 * basicPct / 100) },
    { id: "pro" as const, name: "Pro", price: `${ziptoConfig.rupees(proFee)} + GST`, per: "/30 days", pct: proPct, perks: [`Only ${proPct}% commission`, `You keep ${100 - proPct}% of food sales`, ...(breakEvenSales === null ? [] : [`Cheaper than Basic above ~${ziptoConfig.rupees(breakEvenSales)} food sales/month`]), ...(breakEven === null ? [] : [`Around ${breakEven} orders/month at ₹400 per order`])], payout: 400 - Math.round(400 * proPct / 100) },
  ];

  return (
    <div className={`${styles.wrap} ${className || ""}`}>
      <MerchantSectionHeader eyebrow="Subscription" title="platr™ Fair Plan" subtitle="Transparent pricing – no hidden charges. Switch any time." />
      {settings.isError && <p role="alert" className={styles.error}>Could not load current plan pricing: {settings.error.message}</p>}
      {trial.eligible && s?.proTrialEnabled && (
        <MerchantCard tone="gold">
          <h3>New restaurant offer: Pro free for {trial.days} days</h3>
          <p>₹0 subscription · {proPct}% commission + GST on commission. No payment needed now, and no auto-charge.</p>
          <Button disabled={act.isPending || settings.isFetching} onClick={() => setTrialOpen(true)}>
            Start free Pro trial
          </Button>
        </MerchantCard>
      )}
      {trial.startedAt && !trial.active && !activePro && (
        <p className={styles.secured}>Your free trial ended on {formatProDate(trial.cancelledAt ?? trial.endsAt!)}. You're on Basic.</p>
      )}
      <div className={styles.plans}>
        {plans.map((p) => {
          const current = p.id === "basic" ? !activePro : activePro;
          return (
            <article key={p.id} className={`${styles.plan} ${p.id === "pro" ? styles.pro : ""} ${current ? styles.current : ""}`}>
              {p.id === "pro" && <span className={styles.tag}><Crown size={13} /> Best for growth</span>}
              <h3>{p.name}</h3>
              <div className={styles.price}>{p.price}<span>{p.per}</span></div>
              {p.id === "pro" && <small className={styles.secured}>{ziptoConfig.rupees(proFee)} + {ziptoConfig.rupees(proGst)} GST ({proGstPercent}%) = {ziptoConfig.rupees(proTotal)} · GST input credit available if you are GST-registered</small>}
              <p className={styles.pct}>+ {p.pct}% commission per order</p>
              <ul>{p.perks.map((x) => <li key={x}><Check size={15} /> {x}</li>)}</ul>
              <div className={styles.example}>On a ₹400 order you get <b>{ziptoConfig.rupees(p.payout)}</b></div>
              {p.id === "basic" ? (
                <Button
                  variant={current ? "outline" : "secondary"}
                  disabled={current || act.isPending || checkout.isBusy}
                  onClick={() => act.mutate({ action: "set_plan", plan: "basic" })}
                >
                  {current ? "Current plan" : "Switch to Basic"}
                </Button>
              ) : (
                <>
                  {trial.active && trial.startedAt && trialEnd && (
                    <span className={styles.activeUntil}>
                      Free trial · starts {formatProDate(trial.startedAt)} · ends {formatProDate(trialEnd)} · {daysLeft} days left. After that: Pro ₹{proFee.toLocaleString("en-IN")} + applicable GST per 30 days only with your consent; otherwise Basic ₹0/month with {basicPct}% commission.
                    </span>
                  )}
                  {activePro && !trial.active && <span className={styles.activeUntil}>Current plan · active till {formatProDate(r.proPaidUntil!)}</span>}
                  {data.proAwaitingActivation && (
                    <span className={styles.awaiting}>
                      Paid · awaiting activation{data.proAwaitingPaidAt ? ` (paid on ${formatProDate(data.proAwaitingPaidAt)})` : ""}
                    </span>
                  )}
                  <Button
                    disabled={data.proAwaitingActivation || checkout.isBusy || act.isPending || settings.isFetching || !s}
                    onClick={() => trial.active ? setContinueOpen(true) : s?.launchMode ? setConfirmationOpen(true) : void checkout.start()}
                  >
                    {data.proAwaitingActivation ? "Payment received – activation pending" :
                      checkout.phase === "opening" ? "Opening Razorpay…" :
                      checkout.phase === "verifying" ? "Verifying payment…" :
                      trial.active ? `Continue Pro after trial · pay ${ziptoConfig.rupees(proTotal)}` :
                      activePro ? "Renew / extend 30 days" :
                      r.plan === "pro" ? `Pay ${ziptoConfig.rupees(proTotal)} to activate` : `Switch to Pro · pay ${ziptoConfig.rupees(proTotal)}`}
                  </Button>
                  <small className={styles.secured}>Secured by Razorpay</small>
                  {trial.active && (
                    <Button variant="outline" disabled={act.isPending || checkout.isBusy} onClick={() => setCancelOpen(true)}>
                      Cancel trial / move to Basic
                    </Button>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
      <MerchantCard tone="gold">
        <p className={styles.note}>
          Riders are paid by platr™ separately (base + distance pay + incentive) – never from your commission or earnings. Pro is paid securely via Razorpay (UPI, cards, netbanking). Pro is valid for 30 days and must be renewed manually (no auto-debit). <Link to="/terms#pro-plan">Read Terms</Link>.
        </p>
      </MerchantCard>
      <Dialog open={trialOpen} onOpenChange={(open) => { setTrialOpen(open); if (!open) setTrialConsent(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start your free Pro trial</DialogTitle>
            <DialogDescription>
              Your {trial.days}-day trial starts today and ends on {formatProDate(prospectiveEnd)}.
              {` ${proPct}% commission plus GST on commission applies to orders during the trial.`}
              {` After the trial, Pro continues only if you choose to pay ${ziptoConfig.rupees(proFee)} + ${ziptoConfig.rupees(proGst)} GST = ${ziptoConfig.rupees(proTotal)}.`}
              {` We never auto-charge. Otherwise your account moves automatically to Basic (${basicPct}% commission). You can cancel the trial any time.`}
            </DialogDescription>
          </DialogHeader>
          <Link to="/terms#pro-plan">Read Pro trial terms</Link>
          <label className={styles.acknowledge}>
            <Checkbox checked={trialConsent} onChange={(event) => setTrialConsent(event.target.checked)} />
            I agree to the Pro trial terms
          </label>
          <DialogFooter>
            <Button disabled={!trialConsent || act.isPending} onClick={() => act.mutate(
              { action: "start_pro_trial", consent: true },
              { onSuccess: () => setTrialOpen(false) },
            )}>
              {act.isPending ? "Starting…" : "Confirm free trial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={continueOpen} onOpenChange={(open) => { setContinueOpen(open); if (!open) setContinueConsent(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Continue Pro after your trial</DialogTitle>
            <DialogDescription>
              Your paid 30-day Pro period starts after your trial ends on {trialEnd ? formatProDate(trialEnd) : "the trial end date"}.
              There is no auto-renewal.
            </DialogDescription>
          </DialogHeader>
          <label className={styles.acknowledge}>
            <Checkbox checked={continueConsent} onChange={(event) => setContinueConsent(event.target.checked)} />
            I agree to pay {ziptoConfig.rupees(proTotal)} for 30 days of Pro starting {trialEnd ? formatProDate(trialEnd) : "after my trial"}. No auto-renewal.
          </label>
          <DialogFooter>
            <Button disabled={!hasExplicitRenewalConsent(continueConsent) || checkout.isBusy} onClick={() => {
              if (!hasExplicitRenewalConsent(continueConsent)) return;
              setContinueOpen(false);
              setContinueConsent(false);
              void checkout.start();
            }}>
              Continue to payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel your Pro trial?</DialogTitle>
            <DialogDescription>
              Your trial ends immediately and commission becomes {basicPct}% on new orders. You cannot restart this one-time offer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>Keep trial</Button>
            <Button disabled={act.isPending} onClick={() => act.mutate(
              { action: "cancel_pro_trial" },
              { onSuccess: () => setCancelOpen(false) },
            )}>
              {act.isPending ? "Cancelling…" : "Cancel trial / move to Basic"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmationOpen} onOpenChange={(open) => { setConfirmationOpen(open); if (!open) setUnderstood(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pro activation after launch</DialogTitle>
            <DialogDescription>
              platr™ abhi fully operational nahi hai. Aapka Pro plan payment ke turant baad activate nahi hoga. Payment total {ziptoConfig.rupees(proTotal)} hai, including {ziptoConfig.rupees(proGst)} GST ({proGstPercent}%). Jab customer registrations shuru honge aur platr™ launch announce karega, usi din se aapka 30-day Pro period start hoga. Activation hone par aapko email se inform kiya jayega. After 30 days, Pro must be paid again to continue.
            </DialogDescription>
          </DialogHeader>
          <Link to="/terms#pro-plan">Read Terms</Link>
          <label className={styles.acknowledge}>
            <Checkbox checked={understood} onChange={(event) => setUnderstood(event.target.checked)} />
            I understand
          </label>
          <DialogFooter>
            <Button disabled={!understood || checkout.isBusy || data.proAwaitingActivation} onClick={() => { setConfirmationOpen(false); setUnderstood(false); void checkout.start(); }}>
              Continue to pay {ziptoConfig.rupees(proTotal)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={checkout.lastState === "awaiting_activation"} onOpenChange={(open) => { if (!open) checkout.clearLastState(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment received ✅</DialogTitle>
            <DialogDescription>
              Your Pro plan will be activated in a few days once platr™ is fully operational. You'll be informed via email, and your 30 days will start from the activation date.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter><Button onClick={checkout.clearLastState}>Got it</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
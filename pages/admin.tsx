import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { useAdminSupportTickets } from "../helpers/useSupportTickets";
import {
  adminControlSections,
  getAdminControlSection,
  getAdminControlSectionUrl,
} from "../helpers/adminControlSections";
import { postAdminAction } from "../endpoints/admin/action_POST.schema";
import { StatusPill } from "../components/StatusPill";
import { AdminRiderVerification } from "../components/AdminRiderVerification";
import { AdminNoteBox } from "../components/AdminNoteBox";
import { AdminDishPhotoReviews } from "../components/AdminDishPhotoReviews";
import { AdminLaunchMode } from "../components/AdminLaunchMode";
import { AdminPayouts } from "../components/AdminPayouts";
import { AdminFinanceDashboard } from "../components/AdminFinanceDashboard";
import { AdminGstReserve } from "../components/AdminGstReserve";
import { AdminPricingSettings } from "../components/AdminPricingSettings";
import { AdminCaChecklist } from "../components/AdminCaChecklist";
import { AdminServiceAreas } from "../components/AdminServiceAreas";
import { AdminFoodComplaints } from "../components/AdminFoodComplaints";
import { AdminDeliveryReliability } from "../components/AdminDeliveryReliability";
import { AdminSupportInbox } from "../components/AdminSupportInbox";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import { AdminRoute } from "../components/ProtectedRoute";
import styles from "./admin.module.css";

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #eee6d1",
  borderRadius: 16,
  padding: 18,
  margin: "14px 0",
};
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

function AdminContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "support" ? "support" : "control";
  const activeSection = getAdminControlSection(searchParams.get("section"));
  const openTickets = useAdminSupportTickets("open");
  const q = ziptoHooks.useAdminOverview();
  const siteSettings = ziptoHooks.useSettings();
  const [financeDays, setFinanceDays] = useState(30);
  const finance = ziptoHooks.useAdminFinance(financeDays);
  const providers = ziptoHooks.usePayoutProviders();
  const act = ziptoHooks.useAction(
    (action: Parameters<typeof postAdminAction>[0]) => postAdminAction(action),
    [ziptoHooks.keys.adminOverview, ["admin", "finance"], ziptoHooks.keys.settings],
    "Admin changes saved",
  );
  const [s, setS] = useState<{
    basicCommissionPercent: string;
    proCommissionPercent: string;
    proMonthlyFee: string;
    upiId: string;
    upiPayeeName: string;
  } | null>(null);

  if ((q.isFetching && !q.data) || (siteSettings.isFetching && !siteSettings.data)) {
    return <div style={{ padding: 24 }}><Skeleton /><Skeleton /><Skeleton /></div>;
  }
  if (siteSettings.isError || !siteSettings.data) {
    return (
      <div className={styles.section}>
        Could not load website settings. {siteSettings.error instanceof Error && siteSettings.error.message}
        <Button onClick={() => void siteSettings.refetch()}>Retry</Button>
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div style={{ padding: 24 }}>
        Could not load admin overview. {q.error instanceof Error && q.error.message}
        <Button onClick={() => void q.refetch()}>Retry</Button>
      </div>
    );
  }

  const d = q.data;
  const adminRiders = d.riders.filter((r) => !/\bdemo\b/i.test(`${r.name ?? ""} ${r.email ?? ""}`));
  const v = s ?? {
    basicCommissionPercent: String(d.settings.basicCommissionPercent),
    proCommissionPercent: String(d.settings.proCommissionPercent),
    proMonthlyFee: String(d.settings.proMonthlyFee),
    upiId: d.settings.upiId ?? "",
    upiPayeeName: d.settings.upiPayeeName,
  };
  const set = (k: keyof typeof v, val: string) => setS({ ...v, [k]: val });
  const stat = [
    ["Orders today", d.stats.ordersToday],
    ["GMV today", money(d.stats.gmvToday)],
    ["platr™ today", money(d.stats.ziptoToday)],
    ["platr™ this month", money(d.stats.ziptoMonth)],
    ["Pending approvals", d.stats.pendingApprovals],
    ["Riders online", d.stats.ridersOnline],
    ["Customers registered", d.registrations.customers],
    ["Restaurants registered", d.registrations.restaurants],
    ["Riders registered", d.registrations.riders],
    ["Pro awaiting activation", d.pendingProActivations.length],
  ];

  return (
    <main className={styles.adminShell} style={{ maxWidth: "none", margin: 0, padding: 24, color: "#171717" }}>
      <Helmet><title>platr™ Admin</title></Helmet>
      <aside className={styles.sidebar} aria-label="Main admin navigation and controls">
        <div className={styles.brand}><strong>platr™</strong><small>FOOD · RIDES · MORE</small></div>
        <div className={styles.sideNavLabel}>WORKSPACE</div>
        {adminControlSections.map(({ value, label }) => (
          <Link key={value} to={getAdminControlSectionUrl(searchParams, value)} className={`${styles.sideLink} ${activeSection === value && activeTab === "control" ? styles.sideActive : ""}`}>
            <span aria-hidden="true">{{ overview: "▦", payouts: "▱", "food-complaints": "◉", "delivery-reliability": "✓", finance: "▥", gst: "▧", pricing: "₹", "ca-questions": "☷", "service-areas": "◎", "merchant-verification": "▣", customers: "♙", "rider-verification": "♧", "photo-reviews": "▧", settings: "⚙" }[value]}</span>
            {label === "Merchant verification" ? "Merchants" : label === "Rider verification" ? "Riders" : label === "GST Reserve" ? "GST & Compliance" : label === "Finance" ? "Finance & Reports" : label === "Service areas" ? "Service Areas" : label}
            {value === "customers" && <b className={styles.sideCount}>{d.registrations.customers}</b>}
          </Link>
        ))}
        <Link to="?tab=support" className={`${styles.sideLink} ${activeTab === "support" ? styles.sideActive : ""}`}><span>✉</span> Support CRM {openTickets.data && <b className={styles.sideCount}>{openTickets.data.counts.open}</b>}</Link>
      </aside>
      <div className={styles.adminMain}>
      <div className={styles.topBar}><div><strong>Hi, Manpreet 👋</strong><span>Welcome to platr™ Admin Panel</span></div><div className={styles.profile}><span className={styles.avatar}>M</span><span><strong>Manpreet Singh</strong><small>Admin</small></span></div></div>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.headerLabel}>FOUNDER CONTROL ROOM</span>
          <h1>platr™ Admin <span aria-hidden="true">✦</span></h1>
          <p>Good to see you. Your platform, partners and operations — all in one place.</p>
        </div>
        <div className={styles.heroStatus}>
          <span className={styles.liveDot} />
          <span>{siteSettings.data.sitePaused ? "Website paused" : d.settings.launchMode ? "Launch mode active" : "Platform controls ready"}</span>
        </div>
      </header>

      <section className={styles.registrationControls} aria-label="Registration access controls">
        <div>
          <h2>Registration access</h2>
          <p>Choose which groups can create new accounts. Existing accounts can still log in.</p>
        </div>
        <div className={styles.registrationButtons}>
          {([
            { role: "user", label: "Customers", enabled: siteSettings.data.allowCustomerRegistration },
            { role: "rider", label: "Riders", enabled: siteSettings.data.allowRiderRegistration },
            { role: "restaurant", label: "Merchants", enabled: siteSettings.data.allowMerchantRegistration },
          ] as const).map(({ role, label, enabled }) => (
            <div className={styles.registrationItem} key={role}>
              <div><strong>{label}</strong><small className={enabled ? styles.registrationOpen : styles.registrationClosed}>{enabled ? "Allowed" : "Closed"}</small></div>
              <Button size="sm" variant={enabled ? "outline" : "primary"} disabled={act.isPending || siteSettings.data.sitePaused} onClick={() => {
                const next = !enabled;
                if (confirm(`${next ? "Allow" : "Close"} new ${label.toLowerCase()} registrations?`)) act.mutate({ action: "set_registration_permission", role, enabled: next });
              }}>{act.isPending ? "…" : enabled ? "Disable" : "Allow"}</Button>
            </div>
          ))}
        </div>
      </section>
      <section className={styles.registrationControls} aria-label="Platform status controls">
        <h2>Platform status</h2>
        <AdminLaunchMode launchMode={d.settings.launchMode} sitePaused={siteSettings.data.sitePaused} onAction={act.mutate} isPending={act.isPending} />
      </section>

      {activeTab === "control" && <AdminNoteBox riders={adminRiders} restaurants={d.restaurants} onAction={act.mutate} isPending={act.isPending} />}

      {activeTab === "support" ? <AdminSupportInbox /> : (
        <>
      {activeSection === "overview" && (
        <>
      <h2>Overview</h2>
      <section id="admin-overview" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        {stat.map(([label, value], index) => <div className={`${styles.statCard} ${[styles.statGold, styles.statGreen, styles.statBlue, styles.statGreen, styles.statOrange, styles.statBlue][index % 6]}`} key={String(label)}><small>{label}</small><h2>{value}</h2></div>)}
      </section>

      <section id="pro-activations" style={card}>
        <h2>Pro plan activations</h2>
        <p>Pro payments made before launch are held. When you click Go live, all of them activate together – each gets 30 days from the go-live day and the merchant is emailed.</p>
        {d.proBillingStartedAt && (
          <p>Pro billing started on {new Date(d.proBillingStartedAt).toLocaleDateString("en-IN")}.</p>
        )}
        {!d.pendingProActivations.length ? (
          <p>No Pro payments awaiting activation.</p>
        ) : (
          <ul>
            {d.pendingProActivations.map((activation) => (
              <li key={activation.paymentId}>
                <b>{activation.restaurantName}</b> · {activation.ownerName} · {activation.ownerEmail} · {money(activation.amount)} · Paid {new Date(activation.paidAt).toLocaleDateString("en-IN")}
              </li>
            ))}
          </ul>
        )}
      </section>
        </>
      )}

      {activeSection === "finance" && <section id="admin-finance" className={styles.section}>
        <h2>Finance</h2>
        {finance.isFetching && !finance.data ? (
          <><Skeleton className={styles.skeletonTitle} /><Skeleton /><Skeleton /><Skeleton /></>
        ) : finance.isError && !finance.data ? (
          <p>Could not load finance: {finance.error instanceof Error ? finance.error.message : "Unknown error"}{" "}
            <Button onClick={() => void finance.refetch()}>Retry</Button>
          </p>
        ) : finance.data ? (
          <AdminFinanceDashboard
            finance={finance.data}
            days={financeDays}
            onDaysChange={setFinanceDays}
            onAction={act.mutate}
            isPending={act.isPending}
            isFetching={finance.isFetching}
          />
        ) : null}
      </section>}

      {activeSection === "gst" && <section id="admin-gst-reserve" className={styles.section}>
        {finance.isFetching && !finance.data ? (
          <><Skeleton className={styles.skeletonTitle} /><Skeleton /><Skeleton /></>
        ) : finance.isError && !finance.data ? (
          <p>Could not load GST reserve: {finance.error instanceof Error ? finance.error.message : "Unknown error"}{" "}
            <Button onClick={() => void finance.refetch()}>Retry</Button>
          </p>
        ) : finance.data ? <AdminGstReserve finance={finance.data} isFetching={finance.isFetching} /> : null}
      </section>}

      {activeSection === "payouts" && <section id="admin-payouts" className={styles.section}>
        <h2>Payouts</h2>
        {finance.isFetching && !finance.data || providers.isFetching && !providers.data ? (
          <><Skeleton className={styles.skeletonTitle} /><Skeleton /><Skeleton /></>
        ) : finance.isError && !finance.data ? (
          <p>Could not load rider payouts: {finance.error instanceof Error ? finance.error.message : "Unknown error"}{" "}
            <Button onClick={() => void finance.refetch()}>Retry</Button>
          </p>
        ) : providers.isError && !providers.data ? (
          <p>Could not check payout providers: {providers.error instanceof Error ? providers.error.message : "Unknown error"}{" "}
            <Button onClick={() => void providers.refetch()}>Retry</Button>
          </p>
        ) : finance.data && providers.data ? (
          <AdminPayouts
            payouts={d.payouts}
            riderPayouts={finance.data.riderPayouts}
            providers={providers.data}
            unsettledOnline={d.unsettledOnline}
            onAction={act.mutate}
            isPending={act.isPending}
            formatMoney={money}
          />
        ) : null}
      </section>}

      {activeSection === "food-complaints" && <AdminFoodComplaints />}
      {activeSection === "delivery-reliability" && <AdminDeliveryReliability />}

      {activeSection === "pricing" && <section id="admin-pricing" className={styles.section}>
        <h2>Pricing</h2>
        {finance.isFetching && !finance.data ? (
          <><Skeleton className={styles.skeletonTitle} /><Skeleton /><Skeleton /></>
        ) : finance.isError && !finance.data ? (
          <p>Could not load pricing: {finance.error instanceof Error ? finance.error.message : "Unknown error"}{" "}
            <Button onClick={() => void finance.refetch()}>Retry</Button>
          </p>
        ) : finance.data ? (
          <AdminPricingSettings
            key={finance.data.pricing.updatedAt.toString()}
            pricing={finance.data.pricing}
            onAction={act.mutate}
            isPending={act.isPending}
          />
        ) : null}
      </section>}

      {activeSection === "ca-questions" && (
        <section className={styles.section}>
          <h2>CA questions</h2>
          <AdminCaChecklist
            answers={d.caAnswers}
            onSave={(questionNo, answer) => act.mutate({ action: "ca_answer", questionNo, answer })}
            isPending={act.isPending}
          />
        </section>
      )}

      {activeSection === "service-areas" && <section id="admin-areas" className={styles.section}>
        <h2>Service areas</h2>
        {finance.isFetching && !finance.data ? (
          <><Skeleton className={styles.skeletonTitle} /><Skeleton /><Skeleton /></>
        ) : finance.isError && !finance.data ? (
          <p>Could not load service areas: {finance.error instanceof Error ? finance.error.message : "Unknown error"}{" "}
            <Button onClick={() => void finance.refetch()}>Retry</Button>
          </p>
        ) : finance.data ? (
          <AdminServiceAreas areas={finance.data.serviceAreas} onAction={act.mutate} isPending={act.isPending} />
        ) : null}
      </section>}

      {activeSection === "merchant-verification" && <section id="merchant-verification" style={card}>
        <h2>Merchant verification</h2>
        <section aria-label="Merchant admin notes and replies" style={{ margin: "16px 0 22px", padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
          <h3 style={{ marginTop: 0 }}>Merchant notes & replies</h3>
          <p>Review the note sent to each merchant and any reply they have submitted.</p>
          {!d.restaurants.some((r) => r.adminNote || r.adminReply) ? <p>No merchant notes or replies yet.</p> : d.restaurants.filter((r) => r.adminNote || r.adminReply).map((r) => (
            <article key={`note-${r.id}`} style={{ padding: 12, marginTop: 10, borderRadius: 10, border: r.adminReply ? "1px solid #f59e0b" : "1px solid #e5e7eb", background: r.adminReply ? "#fffbeb" : "#f9fafb" }}>
              <strong>{r.name}</strong> <small>· {r.town} · {r.ownerEmail}</small>
              <p style={{ margin: "8px 0 4px", fontWeight: 600 }}>Admin note</p>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{r.adminNote || "No current admin note"}</p>
              {r.adminReply && <><p style={{ margin: "10px 0 4px", fontWeight: 600, color: "#92400e" }}>Merchant reply{r.adminReplyAt ? ` · ${new Date(r.adminReplyAt).toLocaleString("en-IN")}` : ""}</p><p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{r.adminReply}</p></>}
              <div style={{ marginTop: 10 }}><Button size="sm" variant="outline" onClick={() => { setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set("section", "overview"); next.set("tab", "control"); return next; }); }}>Open Admin Note composer</Button></div>
            </article>
          ))}
        </section>
        <p>Manually compare each submitted licence against the official government record before approval. No automated verification is performed.</p>
        <p><a className={styles.govLink} href="https://foscos.fssai.gov.in/" target="_blank" rel="noreferrer">Open official FoSCoS FBO Search ↗</a></p>
        {!d.restaurants.length ? <p>No restaurant registrations yet.</p> : d.restaurants.map((r) => (
          <div key={r.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <b>{r.name}</b><p>{r.ownerName} · {r.ownerEmail}</p>
              <small>{r.town} · {r.phone} · {r.plan.toUpperCase()}</small>
              <p>FSSAI number: <b>{r.fssaiLicenseNumber || "Not provided"}</b></p>
              <p>FSSAI expiry: {r.fssaiExpiryDate ? new Date(r.fssaiExpiryDate).toLocaleDateString("en-IN") : "Not uploaded"}</p>
              <ul className={styles.checklist}>
                <li>Match licence number with FoSCoS record</li><li>Match business name</li><li>Confirm active status and expiry</li><li>Compare uploaded certificate</li>
              </ul>
              <p>Official check: <b>{r.fssaiVerificationStatus === "verified" ? "Verified" : r.fssaiVerificationStatus === "review_required" ? "Review required" : r.fssaiVerificationStatus === "rejected" ? "Rejected" : "Not checked"}</b>{r.fssaiVerificationCheckedAt ? ` · ${new Date(r.fssaiVerificationCheckedAt).toLocaleDateString("en-IN")}` : ""}</p>
              {r.fssaiVerificationNote && <small>Verification note: {r.fssaiVerificationNote}</small>}
              {r.fssaiDocumentUrl && <p><a href={r.fssaiDocumentUrl} target="_blank" rel="noreferrer">View FSSAI licence ↗</a></p>}
              <p><StatusPill status={r.status} /></p>
            </div>
            <div>
              <Button className={styles.reviewButton} size="sm" disabled={act.isPending || !r.fssaiLicenseNumber || !r.fssaiDocumentUrl || !r.fssaiExpiryDate || new Date(r.fssaiExpiryDate) <= new Date()} onClick={() => {
                const note = prompt("Confirm the official FSSAI record check and enter a note/reference", "Checked on FoSCoS; business name, licence status and validity matched.");
                if (note !== null && note.trim()) act.mutate({ action: "fssai_verification", id: r.id, status: "verified", note });
              }}>Mark FSSAI verified</Button>
              <Button className={styles.reviewButton} size="sm" variant="outline" disabled={act.isPending || !r.fssaiLicenseNumber} onClick={() => {
                const note = prompt("Why does this require review?", "Could not conclusively match the official record; manual follow-up required.");
                if (note !== null) act.mutate({ action: "fssai_verification", id: r.id, status: "review_required", note });
              }}>Needs review</Button>
              {(["approved", "rejected", "suspended"] as const).map((status) => (
                <Button className={styles.reviewButton} key={status} size="sm" variant={status === "approved" ? "primary" : "outline"} disabled={act.isPending || (status === "approved" && r.fssaiVerificationStatus !== "verified")} onClick={() => act.mutate({ action: "restaurant_status", id: r.id, status })}>
                  {status}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </section>}

      {activeSection === "customers" && <section id="admin-customers" className={styles.section}>
        <div className={styles.customerHeading}>
          <div><h2>Registered customers</h2><p>Customer accounts and their platr™ order history. No customer verification is required.</p></div>
          <span className={styles.customerCount}>{d.customers.length} accounts</span>
        </div>
        {!d.customers.length ? <div className={styles.emptyCustomers}><span>♙</span><strong>No customer accounts yet</strong><p>Customers will appear here automatically when they register.</p></div> : (
          <div className={styles.customerList}>
            {d.customers.map((customer) => (
              <article key={customer.id} className={styles.customerCard}>
                <div className={styles.customerTop}>
                  <div className={styles.customerIdentity}>
                    <span className={styles.customerAvatar}>{(customer.name || "C").trim().charAt(0).toUpperCase()}</span>
                    <div><h3>{customer.name || "Unnamed customer"}</h3><p>{customer.email}</p><small>{customer.phone || "No phone added"} · Joined {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString("en-IN") : "Date unavailable"}</small></div>
                  </div>
                  <div className={styles.customerMetrics}>
                    <div><strong>{customer.orderCount}</strong><span>Total orders</span></div>
                    <div><strong>{money(Number(customer.walletBalance || 0))}</strong><span>Wallet balance</span></div>
                  </div>
                </div>
                <div className={styles.customerHistory}>
                  <h4>Recent order history</h4>
                  {customer.orderCount === 0 ? <p className={styles.noOrders}>No food orders yet.</p> : customer.recentOrders.length === 0 ? <p className={styles.noOrders}>This customer has placed {customer.orderCount} order(s). Recent order details are outside the latest admin order feed.</p> : (
                    <div className={styles.orderTableWrap}><table className={styles.orderTable}><thead><tr><th>Order</th><th>Restaurant</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>
                      {customer.recentOrders.map((order) => <tr key={order.id}><td>#{order.id}</td><td>{order.restaurantName}</td><td>{new Date(order.createdAt).toLocaleDateString("en-IN")}</td><td>{money(order.total)}</td><td>{order.paymentMethod.toUpperCase()} · {order.paymentStatus}</td><td><StatusPill status={order.status} /></td></tr>)}
                    </tbody></table></div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>}

      {activeSection === "rider-verification" && (
        <section className={styles.section}>
          <div className={styles.riderSummaryHeading}>
            <div><h2>Rider verification</h2><p>Live overview of rider accounts by approval status.</p></div>
            <span className={styles.riderTotal}>{adminRiders.length} total riders</span>
          </div>
          <div className={styles.riderStats} aria-label="Rider status summary">
            <div className={`${styles.riderStat} ${styles.riderPending}`}><span className={styles.riderStatIcon}>◷</span><div><span>Pending review</span><strong>{adminRiders.filter((r) => r.status !== "approved" && r.status !== "rejected" && r.status !== "suspended").length}</strong><small>Awaiting admin decision</small></div></div>
            <div className={`${styles.riderStat} ${styles.riderApproved}`}><span className={styles.riderStatIcon}>✓</span><div><span>Approved</span><strong>{adminRiders.filter((r) => r.status === "approved").length}</strong><small>Riders approved</small></div></div>
            <div className={`${styles.riderStat} ${styles.riderRejected}`}><span className={styles.riderStatIcon}>×</span><div><span>Rejected</span><strong>{adminRiders.filter((r) => r.status === "rejected").length}</strong><small>Applications rejected</small></div></div>
            <div className={`${styles.riderStat} ${styles.riderSuspended}`}><span className={styles.riderStatIcon}>Ⅱ</span><div><span>Suspended</span><strong>{adminRiders.filter((r) => r.status === "suspended").length}</strong><small>Accounts suspended</small></div></div>
          </div>
          <AdminRiderVerification riders={adminRiders} onAction={act.mutate} isPending={act.isPending} />
        </section>
      )}

      {activeSection === "photo-reviews" && <section id="photo-reviews" style={card}>
        <h2>Restaurant photo reviews</h2>
        {!d.restaurants.some((r) => r.profileImageReview === "pending")
          ? <p>No photos waiting for review.</p>
          : d.restaurants.filter((r) => r.profileImageReview === "pending").map((r) => (
            <div key={r.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}>
              <b>{r.name} · {r.town}</b>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "12px 0" }}>
                <div><small>Current live photo</small><div>
                  {r.profileImageUrl
                    ? <a href={r.profileImageUrl} target="_blank" rel="noreferrer"><img src={r.profileImageUrl} alt={`Current photo for ${r.name}`} style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12 }} /></a>
                    : <p>No live photo</p>}
                </div></div>
                <div><small>New photo</small><div>
                  {r.pendingProfileImageUrl && <a href={r.pendingProfileImageUrl} target="_blank" rel="noreferrer"><img src={r.pendingProfileImageUrl} alt={`Proposed photo for ${r.name}`} style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12 }} /></a>}
                </div></div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ action: "profile_image_review", id: r.id, decision: "approve" })}>Approve</Button>
                <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => {
                  const reason = prompt("Reason for rejecting this photo", "Photo did not meet platr™ guidelines");
                  if (reason !== null) act.mutate({ action: "profile_image_review", id: r.id, decision: "reject", reason });
                }}>Reject</Button>
              </div>
            </div>
          ))}
      </section>}
      {activeSection === "photo-reviews" && (
        <AdminDishPhotoReviews photos={d.pendingDishPhotos} onAction={act.mutate} isPending={act.isPending} />
      )}

      {activeSection === "settings" && <section id="admin-settings" style={card}>
        <h2>Commission, Pro plan &amp; UPI</h2>
        <p>Only save payment settings after verifying the UPI ID belongs to platr™.</p>
        <form onSubmit={(e) => {
          e.preventDefault();
          act.mutate({
            action: "settings",
            riderBonus: d.settings.riderBonus,
            basicCommissionPercent: Number(v.basicCommissionPercent),
            proCommissionPercent: Number(v.proCommissionPercent),
            proMonthlyFee: Number(v.proMonthlyFee),
            upiId: v.upiId,
            upiPayeeName: v.upiPayeeName,
          });
        }} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          {([
            ["basicCommissionPercent", "Basic commission %"],
            ["proCommissionPercent", "Pro commission %"],
            ["proMonthlyFee", "Pro fee ₹ (before GST, per 30 days)"],
            ["upiId", "UPI ID"],
            ["upiPayeeName", "UPI payee name"],
          ] as const).map(([k, label]) => (
            <label key={k} style={{ display: "grid", gap: 6, fontWeight: 700 }}>
              {label}<Input value={v[k]} onChange={(e) => set(k, e.target.value)} required={k !== "upiId"} />
            </label>
          ))}
          <Button type="submit" disabled={act.isPending}>Save settings</Button>
        </form>
      </section>}
        </>
      )}
      </div>
      </main>
  );
}

export default function AdminPage() {
  return <AdminRoute><AdminContent /></AdminRoute>;
}
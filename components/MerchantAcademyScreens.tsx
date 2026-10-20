import { Check, Clock3, FileCheck2, ShoppingBag } from "lucide-react";
import { academyFutureDate, academyTypedText } from "../helpers/academyScenes";
import { ZiptoLogo } from "./ZiptoLogo";
import styles from "./MerchantAcademyScreens.module.css";

export const MerchantAcademyScreens = ({
  sceneIndex,
  progress,
  className,
}: {
  sceneIndex: number;
  progress: number;
  className?: string;
}) => {
  const step = Math.min(3, Math.floor(progress * 4));
  const cursorClass = styles[`cursor${sceneIndex + 1}Step${step}`];
  const menu = [
    "Overview",
    "Orders",
    "Menu Editor",
    "Verification",
    "Subscription",
    "Finance",
    "Customer Reviews",
    "Outlet Information",
    "Help Centre",
  ];

  return (
    <div className={`${styles.screen} ${className ?? ""}`} aria-label="platr™ merchant app walkthrough">
      <div className={styles.appBar}>
        <strong>Merchant Centre</strong>
        <span className={styles.appBarSpace} aria-hidden="true" />
      </div>

      <div className={styles.content} key={sceneIndex}>
        {sceneIndex === 0 && (
          <div className={styles.welcome}>
            <div className={styles.welcomeBrand}>
              <span className={styles.welcomeLogo}><ZiptoLogo size={44} /></span>
              <small>affordable for all</small>
            </div>
            <strong>Welcome to platr™!</strong>
            <span className={styles.muted}>Your restaurant, your dashboard.</span>
            <div className={styles.menu}>
              {menu.map((label, index) => (
                <div
                  key={label}
                  className={`${styles.menuItem} ${progress >= 0.12 + index * 0.095 ? styles.appear : ""}`}
                >
                  <span className={styles.menuDot} />{label}
                </div>
              ))}
            </div>
          </div>
        )}

        {sceneIndex === 1 && (
          <>
            <h2>Restaurant details</h2>
            <p className={styles.muted}>Use the details customers and riders will recognise.</p>
            <div className={styles.fields}>
              <div className={styles.field}>
                <span>Restaurant name</span>
                <div>{academyTypedText("Sharma Dhaba", progress, 0.06, 0.24)}</div>
              </div>
              <div className={styles.field}>
                <span>Phone number</span>
                <div>{academyTypedText("98XXXXXX10", progress, 0.23, 0.38)}</div>
              </div>
              <div className={styles.field}>
                <span>Town</span>
                <div>{progress >= 0.52 ? "Kichha" : "Choose your town ▾"}</div>
                {progress >= 0.39 && progress < 0.52 && (
                  <div className={styles.townOptions}>
                    {["Rudrapur", "Kichha", "Kashipur", "Haldwani"].map((town) => (
                      <span key={town} className={town === "Kichha" ? styles.townChoice : ""}>{town}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.field}>
                <span>Full address</span>
                <div>{academyTypedText("Main Bazaar, Kichha", progress, 0.53, 0.72)}</div>
              </div>
              <div className={styles.field}>
                <span>Cuisine (optional)</span>
                <div>{academyTypedText("North Indian", progress, 0.73, 0.86)}</div>
              </div>
              <div className={styles.field}>
                <span>Short description (optional)</span>
                <div>{academyTypedText("Fresh food, made with love", progress, 0.87, 1)}</div>
              </div>
            </div>
          </>
        )}

        {sceneIndex === 2 && (
          <>
            <h2>FSSAI verification</h2>
            <p className={styles.muted}>A valid licence is required before your outlet can go live.</p>
            <div className={styles.fields}>
              <div className={styles.field}>
                <span>FSSAI licence</span>
                <div className={styles.upload}>
                  <FileCheck2 size={22} />
                  {progress < 0.25
                    ? "Choose a licence file"
                    : progress < 0.68
                      ? "Uploading licence…"
                      : "Licence uploaded ✓"}
                  {progress >= 0.25 && progress < 0.68 && (
                    <progress className={styles.uploadProgress} value={progress - 0.25} max={0.43} />
                  )}
                </div>
                <small>PDF, JPG or PNG · maximum 5 MB</small>
              </div>
              <div className={styles.field}>
                <span>Licence expiry date</span>
                <div>{progress >= 0.82 ? academyFutureDate() : "dd / mm / yyyy"}</div>
              </div>
            </div>
            {progress >= 0.68 && <div className={styles.toast}><Check size={15} /> Licence uploaded ✓</div>}
          </>
        )}

        {sceneIndex === 3 && (
          <>
            <h2>Choose your plan</h2>
            <p className={styles.muted}>Fair pricing for your restaurant.</p>
            <div className={`${styles.plan} ${progress >= 0.2 && progress < 0.53 ? styles.selected : ""}`}>
              <span className={styles.radio}>{progress >= 0.2 && progress < 0.53 ? "●" : ""}</span>
              <div><strong>Basic</strong><b>₹0 <small>/ month</small></b><span>15% commission on eligible food sales</span></div>
            </div>
            <div className={`${styles.plan} ${progress >= 0.53 ? styles.selected : ""}`}>
              <span className={styles.radio}>{progress >= 0.53 ? "●" : ""}</span>
              <div><strong>Pro</strong><b>₹2,499 + 18% GST <small>/ 30 days</small></b><span>₹2,949 total · 8% on eligible food sales</span></div>
            </div>
            <p className={styles.feeNote}>No joining fee · no payment-gateway fee · no extra charges</p>
            <button className={styles.mockButton} type="button" tabIndex={-1}>Submit for approval</button>
            {progress >= 0.83 && <div className={styles.toast}><Check size={15} /> Details submitted for approval</div>}
          </>
        )}

        {sceneIndex === 4 && (
          <>
            <h2>Verification</h2>
            <p className={styles.muted}>Check your outlet's approval status.</p>
            <div className={styles.statusCard}>
              <strong>Verification status</strong>
              <span className={`${styles.statusPill} ${progress >= 0.77 ? styles.approved : ""}`}>
                {progress >= 0.77 ? "Approved" : "Pending"}
              </span>
              <p>This usually takes 1–2 working days.</p>
            </div>
            <div className={styles.steps}>
              {["Outlet registered", "FSSAI licence uploaded", "platr™ review", "Live on platr™"].map((label, index) => {
                const done = progress >= [0.15, 0.34, 0.77, 0.9][index];
                return (
                  <div key={label} className={done ? styles.stepDone : styles.step}>
                    <span>{done ? <Check size={14} /> : index === 2 ? <Clock3 size={14} /> : index + 1}</span>
                    {index + 1}. {label} {done ? "✓" : ""}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {sceneIndex === 5 && (
          <>
                <h2>platr™ Fair Plan</h2>
            <p className={styles.muted}>Subscription · transparent pricing</p>
            <div className={styles.proCard}>
              <strong>Pro</strong>
              <b>₹2,499 + 18% GST <small>/ 30 days</small></b>
<span>₹2,949 total · 8% on eligible food sales</span>
              <span>Pay again every 30 days · no auto-debit</span>
              <button className={styles.mockButton} type="button" tabIndex={-1}>Switch to Pro</button>
            </div>
            {progress >= 0.32 && progress < 0.82 && (
              <div className={styles.checkout}>
                <strong>platr™ · platr™ Pro plan · 30 days</strong>
                <b>₹2,949</b>
                <small>incl. ₹450 GST</small>
                <span>Choose payment method</span>
                <div>UPI</div><div>Card</div><div>Netbanking</div>
                <small>Secured by Razorpay</small>
              </div>
            )}
            {progress >= 0.82 && (
              <div className={styles.success}>
                <Check size={26} />
                <strong>Payment successful!</strong>
                <span>Pro plan active till {academyFutureDate()}</span>
              </div>
            )}
          </>
        )}

        {sceneIndex === 6 && (
          <>
            {progress < 0.42 ? (
              <>
                <h2>Menu Editor</h2>
                <p className={styles.muted}>Build a menu your customers will love.</p>
                <button className={styles.mockButton} type="button" tabIndex={-1}>+ Add item</button>
                {progress >= 0.2 && (
                  <div className={styles.itemCard}>
                    <span className={styles.foodIcon}>🍛</span>
                    <div><strong>Paneer Butter Masala</strong><span>₹220 · Veg</span></div>
                    <Check size={16} />
                  </div>
                )}
              </>
            ) : (
              <>
                <h2>Overview</h2>
                <p className={styles.muted}>Sharma Dhaba · Kichha</p>
                <div className={styles.openCard}>
                  <strong>Outlet {progress >= 0.55 ? "open" : "closed"}</strong>
                  <span className={`${styles.switch} ${progress >= 0.55 ? styles.switchOn : ""}`} />
                </div>
                {progress >= 0.68 && (
                  <div className={styles.orderCard}>
                    <ShoppingBag size={22} />
                    <strong>New order #1024 · ₹480</strong>
                    <button className={styles.mockButton} type="button" tabIndex={-1}>
                      {progress >= 0.87 ? "Accepted ✓" : "Accept"}
                    </button>
                  </div>
                )}
                <p className={styles.help}>हर शुक्रवार साप्ताहिक भुगतान</p>
                <p className={styles.help}>Need help? www.platrfood.co.in/support</p>
              </>
            )}
          </>
        )}
      </div>
      {progress > 0.08 && progress < 0.95 && (
        <span className={`${styles.cursor} ${cursorClass ?? ""}`} aria-hidden="true" />
      )}
    </div>
  );
};
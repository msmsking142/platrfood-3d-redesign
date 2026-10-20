import {
  BellRing,
  Bike,
  Camera,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileCheck2,
  Mail,
  MapPin,
  Navigation,
  Power,
  ShieldCheck,
  Upload,
  Wallet,
} from "lucide-react";
import { academyFutureDate, academyTypedText } from "../helpers/academyScenes";
import styles from "./RiderAcademyScreens.module.css";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const RiderAcademyScreens = ({
  sceneIndex,
  progress,
  className,
}: {
  sceneIndex: number;
  progress: number;
  className?: string;
}) => {
  const step = Math.min(3, Math.floor(progress * 4));
  const online = progress >= 0.42;
  const accepted = progress >= 0.8;
  const pickedUp = progress >= 0.45;
  const delivered = progress >= 0.84;

  return (
    <div className={`${styles.screen} ${className ?? ""}`} aria-label="platr™ rider app walkthrough">
      <div className={styles.appBar}>
        <strong>Rider Centre</strong>
        <span className={styles.appBarSpace} aria-hidden="true" />
      </div>

      <div className={styles.content} key={sceneIndex}>
        {sceneIndex === 0 && (
          <div className={styles.welcome}>
            <span className={styles.roundIcon}><Bike size={28} aria-hidden="true" /></span>
            <span className={styles.eyebrow}>PLATR RIDER</span>
            <h2>चलो कमाई शुरू करें.</h2>
            <p>हर डिलीवरी की कमाई देखें: डिलीवरी पे और योग्य इंसेंटिव।</p>
            <div className={styles.welcomeFigures}>
              <div className={progress >= 0.22 ? styles.revealed : styles.waiting}>
                <strong>{rupees.format(30)}</strong><span>डिलीवरी पे · उदाहरण</span>
              </div>
              <div className={progress >= 0.48 ? styles.revealed : styles.waiting}>
                <strong>+ {rupees.format(5)}</strong><span>इंसेंटिव · उदाहरण</span>
              </div>
            </div>
            <div className={styles.totalCallout}>
              <CircleDollarSign size={20} aria-hidden="true" />
              <span>उदाहरण: एक डिलीवरी पर <b>{rupees.format(35)}</b></span>
            </div>
          </div>
        )}

        {sceneIndex === 1 && (
          <>
            <h2>राइडर रजिस्ट्रेशन</h2>
            <p className={styles.subheading}>अपना नाम, शहर और मोबाइल नंबर भरें।</p>
            <div className={styles.fields}>
              <div className={styles.field}><span>नाम</span><div>{academyTypedText("Rahul Kumar", progress, 0.08, 0.3)}</div></div>
              <div className={styles.field}><span>शहर</span><div>{academyTypedText("Kichha", progress, 0.31, 0.53)}</div></div>
              <div className={styles.field}><span>मोबाइल नंबर</span><div>{academyTypedText("98XXXXXX10", progress, 0.54, 0.8)}</div></div>
            </div>
            <div className={styles.mockButton}>{progress >= 0.88 ? "Continue ✓" : "Continue"}</div>
          </>
        )}

        {sceneIndex === 2 && (
          <>
            <h2>एक बार की ऑनबोर्डिंग फ़ीस</h2>
            <p className={styles.subheading}>डॉक्यूमेंट भेजने से पहले पेमेंट करें। फ़ीस वापस नहीं होती।</p>
            <div className={styles.feeCard}>
              <div><span>ऑनबोर्डिंग फ़ीस</span><strong>₹199.00</strong></div>
              <div><span>GST (18%)</span><strong>₹35.82</strong></div>
              <div className={styles.feeTotal}><span>कुल देय</span><strong>₹234.82</strong></div>
            </div>
            <div className={styles.mockButton}>{progress >= 0.86 ? "Onboarding fee paid ✓" : "Pay ₹234.82"}</div>
            {progress >= 0.4 && progress < 0.82 && (
              <div className={styles.checkout}>
                <strong>platr™ · Rider onboarding</strong>
                <b>₹234.82</b>
                <span>Razorpay से पे करें</span>
                <div>UPI</div><div>Card</div><div>Netbanking</div>
                <small>Secure payment via Razorpay</small>
              </div>
            )}
            {progress >= 0.82 && (
              <div className={styles.reviewStatus}><CheckCircle2 size={18} /> Onboarding fee paid ✓</div>
            )}
          </>
        )}

        {sceneIndex === 3 && (
          <>
            <h2>जानकारी और डॉक्यूमेंट</h2>
            <p className={styles.subheading}>साप्ताहिक भुगतान के लिए बैंक विवरण भी भरें।</p>
            <div className={styles.detailsGrid}>
              <div><small>वाहन का प्रकार</small><strong>{progress >= 0.1 ? "Ebike / Normal bike" : "चुनें"}</strong></div>
              <div><small>वाहन नंबर</small><strong>{academyTypedText("UK06AB1234", progress, 0.1, 0.32)}</strong></div>
              <div><small>वैकल्पिक फ़ोन</small><strong>{academyTypedText("98XXXXXX11", progress, 0.25, 0.42)}</strong></div>
              <div><small>लाइसेंस की समाप्ति</small><strong>{progress >= 0.42 ? academyFutureDate() : "dd / mm / yyyy"}</strong></div>
              <div><small>बैंक खाता धारक</small><strong>{progress >= 0.5 ? "Rahul Kumar" : "नाम"}</strong></div>
              <div><small>खाता नंबर · IFSC</small><strong>{progress >= 0.56 ? "••••1234 · SBIN0001234" : "बैंक विवरण"}</strong></div>
            </div>
            <div className={styles.documentRow}>
              <span>{progress >= 0.66 ? <FileCheck2 size={19} /> : <Upload size={19} />} ड्राइविंग लाइसेंस {progress >= 0.66 && "✓"}</span>
              <span>{progress >= 0.77 ? <Check size={19} /> : <Camera size={19} />} सेल्फ़ी {progress >= 0.77 && "✓"}</span>
            </div>
            <div className={styles.mockButton}>{progress >= 0.9 ? "Sent for review ✓" : "Send for review"}</div>
          </>
        )}

        {sceneIndex === 4 && (
          <>
            <h2>platr™ वेरिफ़िकेशन</h2>
            <p className={styles.subheading}>डॉक्यूमेंट रिव्यू आमतौर पर 24 घंटे में होता है।</p>
            <div className={`${styles.reviewPanel} ${progress >= 0.76 ? styles.reviewPanelApproved : ""}`}>
              {progress >= 0.76 ? <ShieldCheck size={38} /> : <Clock3 size={38} />}
              <strong>{progress >= 0.76 ? "Approved ✓" : "Pending review"}</strong>
              <span>{progress >= 0.76 ? "अब आप ऑर्डर लेने के लिए तैयार हैं" : "platr™ आपकी जानकारी चेक कर रहा है"}</span>
            </div>
            <div className={styles.statusSteps}>
              <span><CheckCircle2 size={16} /> रजिस्ट्रेशन और फ़ीस पूरी</span>
              <span><CheckCircle2 size={16} /> डॉक्यूमेंट भेजे गए</span>
              <span className={progress >= 0.76 ? styles.activeStep : ""}>
                {progress >= 0.76 ? <CheckCircle2 size={16} /> : <Clock3 size={16} />} platr™ review
              </span>
            </div>
          </>
        )}

        {sceneIndex === 5 && (
          <>
            <h2>ऑर्डर लेने के लिए तैयार?</h2>
            <p className={styles.subheading}>अपनी availability आप तय करें।</p>
            <div className={`${styles.onlinePanel} ${online ? styles.onlineActive : ""}`}>
              <Power size={29} aria-hidden="true" />
              <strong>{online ? "Online" : "Offline"}</strong>
              <span>{online ? "अब आपको ऑर्डर मिल सकते हैं" : "अभी नए ऑर्डर नहीं आएँगे"}</span>
              <div className={`${styles.bigToggle} ${online ? styles.bigToggleOn : ""}`} aria-hidden="true"><span /></div>
            </div>
            <div className={styles.tip}><Clock3 size={18} aria-hidden="true" /> ब्रेक लेना हो? स्विच Offline कर दें।</div>
          </>
        )}

        {sceneIndex === 6 && (
          <>
            <h2>नया ऑर्डर!</h2>
            <p className={styles.subheading}>पहले Accept करने वाले राइडर को मिलेगा।</p>
            {progress >= 0.12 && (
              <div className={styles.incomingCard}>
                <div className={styles.incomingHeader}>
                  <span className={styles.ringing}><BellRing size={22} aria-hidden="true" /></span>
                  <strong>New delivery request</strong>
                </div>
                <div className={styles.address}><MapPin size={17} aria-hidden="true" /><span><small>पिकअप</small>Sharma Dhaba · Main Bazaar</span></div>
                <div className={styles.address}><Navigation size={17} aria-hidden="true" /><span><small>ड्रॉप</small>Customer · Kichha</span></div>
                <div className={styles.earning}><span>आपकी कमाई · उदाहरण</span><strong>{rupees.format(35)}</strong></div>
                <div className={`${styles.mockButton} ${accepted ? styles.pressed : ""}`}>{accepted ? "Accepted ✓" : "Accept"}</div>
              </div>
            )}
          </>
        )}

        {sceneIndex === 7 && (
          <>
            <h2>पिकअप से डिलीवरी तक</h2>
            <p className={styles.subheading}>Live location शेयर होती है; Google Maps से रास्ता देखें।</p>
            <div className={styles.map}>
              <span className={styles.mapLabel}>Live location · Sharma Dhaba</span>
              <div className={styles.mapRoute}>
                <span className={`${styles.mapDot} ${pickedUp ? styles.mapDotArrived : ""}`} />
                <span className={styles.mapDestination}><MapPin size={18} aria-hidden="true" /></span>
              </div>
              <span className={styles.mapFooter}>आप → रेस्टोरेंट → ग्राहक</span>
            </div>
            <div className={styles.mockButton}>{pickedUp ? "Picked up ✓" : "Mark picked up"}</div>
            {pickedUp && (
              <>
                <div className={styles.mapLink}><Navigation size={18} aria-hidden="true" /> Google Maps में रास्ता देखें</div>
                <div className={styles.paidBox}><CreditCard size={19} aria-hidden="true" /> सभी ऑर्डर ऑनलाइन पेड — कैश नहीं लेना</div>
                <div className={styles.mockButton}>{delivered ? "Delivered ✓" : "Mark delivered"}</div>
              </>
            )}
          </>
        )}

        {sceneIndex === 8 && (
          <>
            <h2>आपकी कमाई</h2>
            <p className={styles.subheading}>यह उदाहरण है; अपनी असली कमाई Earnings में देखें।</p>
            <div className={styles.earningsHero}>
              <small>आज की कमाई · उदाहरण</small>
              <strong>{rupees.format(Math.round(280 * Math.min(1, progress / 0.65)))}</strong>
              <span>8 deliveries × {rupees.format(35)}</span>
            </div>
            <div className={styles.earningsRow}>
              <div><small>इस हफ़्ते · उदाहरण</small><strong>{rupees.format(Math.round(1260 * Math.min(1, progress / 0.85)))}</strong></div>
              <div><small>अगला भुगतान</small><strong>शुक्रवार</strong><small>admin approval के बाद</small></div>
            </div>
            <div className={styles.chart} aria-label="उदाहरण साप्ताहिक कमाई">
              {[0, 1, 2, 3, 4, 5, 6].map((index) => (
                <span key={index} className={progress >= (index + 1) / 9 ? styles.chartBarVisible : ""} />
              ))}
            </div>
            <div className={styles.support}><Mail size={16} aria-hidden="true" /> www.platrfood.co.in/support</div>
            <div className={styles.tip}>ऑनलाइन होकर कमाई शुरू करें!</div>
          </>
        )}
      </div>

      {progress > 0.08 && progress < 0.95 && (
        <span className={`${styles.cursor} ${styles[`cursorScene${sceneIndex}Step${step}`] ?? ""}`} aria-hidden="true" />
      )}
    </div>
  );
};
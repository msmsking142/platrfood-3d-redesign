import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { User, Store, Bike, Check } from "lucide-react";
import { PasswordLoginForm } from "../components/PasswordLoginForm";
import { OtpVerifyForm } from "../components/OtpVerifyForm";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Spinner } from "../components/Spinner";
import { Skeleton } from "../components/Skeleton";
import { ZiptoLogo } from "../components/ZiptoLogo";
import { useAuth } from "../helpers/useAuth";
import { authDestination } from "../helpers/authDestination";
import type { OtpChallengeResponse } from "../endpoints/auth/verify_otp_POST.schema";
import { ziptoHooks } from "../helpers/ziptoHooks";
import {
  postRegister,
  schema,
} from "../endpoints/auth/register_with_password_POST.schema";
import styles from "./login.module.css";

type Role = "user" | "restaurant" | "rider";

const roles: {
  id: Role;
  title: string;
  desc: string;
  loginTitle: string;
  loginSubtitle: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "user",
    title: "Customer",
    desc: "Order food from local restaurants",
    loginTitle: "Customer login",
    loginSubtitle: "Apne account se login karke order karein.",
    icon: <User size={22} />,
  },
  {
    id: "restaurant",
    title: "Restaurant",
    desc: "Sell with low commission",
    loginTitle: "Restaurant login",
    loginSubtitle: "Login karke apna restaurant dashboard kholein.",
    icon: <Store size={22} />,
  },
  {
    id: "rider",
    title: "Rider",
    desc: "Earn base + distance pay + incentive",
    loginTitle: "Rider login",
    loginSubtitle: "Login karke apna rider dashboard kholein.",
    icon: <Bike size={22} />,
  },
];

export default function LoginPage() {
  const [params] = useSearchParams();
  const joinParam = params.get("join") as Role | null;
  const asRole = !joinParam
    ? roles.find((option) => option.id === params.get("as"))
    : undefined;
  const [mode, setMode] = useState<"login" | "join">(
    joinParam ? "join" : "login",
  );
  const [role, setRole] = useState<Role>(
    joinParam && ["user", "restaurant", "rider"].includes(joinParam)
      ? joinParam
      : "user",
  );
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<OtpChallengeResponse | null>(null);
  const { onLogin } = useAuth();
  const settings = ziptoHooks.useSettings();
  const navigate = useNavigate();
  const registrationAllowed = settings.data
    ? role === "user"
      ? settings.data.allowCustomerRegistration
      : role === "rider"
        ? settings.data.allowRiderRegistration
        : settings.data.allowMerchantRegistration
    : false;

  const submitJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!settings.data || settings.data.sitePaused) {
      setError("platr™ is launching soon. Registration is currently closed.");
      return;
    }
    if (!registrationAllowed) {
      setError(`New ${role === "user" ? "customer" : role === "rider" ? "rider" : "merchant"} registrations are currently closed. Please check back later.`);
      return;
    }
    if (role === "user" && settings.data.launchMode) return;

    const parsed = schema.safeParse({ ...form, role });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }

    setLoading(true);
    try {
      const result = await postRegister(parsed.data);
      setChallenge(result);
    } catch (caught) {
      console.error("Registration failed:", caught);
      setError(
        caught instanceof Error && caught.message.includes("already")
          ? "This email is already registered. Please log in."
          : caught instanceof Error
            ? caught.message
            : "Could not create account",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <Helmet>
        <title>{`${mode === "login" ? "Login" : "Join"} – platr™`}</title>
      </Helmet>

      <main className={styles.card}>
        <header className={styles.brand}>
          <ZiptoLogo tone="ink" size={100} />
          <p>Affordable for Everyone</p>
        </header>

        <img
          className={styles.rider}
          src="/_cdn/static/61f66be5-0427-4579-a9f1-0d48b8936266.png"
          alt="platr™ delivery rider"
        />

        <ul className={styles.benefits}>
          <li>
            <span className={styles.checkIcon}>
              <Check size={14} aria-hidden="true" />
            </span>
            Affordable Food Delivery
          </li>
          <li>
            <span className={styles.checkIcon}>
              <Check size={14} aria-hidden="true" />
            </span>
            Lower Commissions for Restaurants
          </li>
        </ul>

        <section className={styles.actionArea} aria-label="Account access">
          {settings.isFetching && !settings.data ? (
            <Skeleton aria-label="Checking registration availability" />
          ) : settings.isError || !settings.data ? (
            <div role="alert" className={styles.error}>
              Could not check registration availability:{" "}
              {settings.error instanceof Error
                ? settings.error.message
                : "Please try again."}
              <Button type="button" onClick={() => void settings.refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              {settings.data.sitePaused && (
                <p className={styles.sub}>
                  platr™ launching soon – new registrations are paused.
                </p>
              )}

              <div key={settings.data.sitePaused ? "paused" : mode} className={styles.formArea}>
                {settings.data.sitePaused || mode === "login" ? (
                  <>
                    <h1 className={styles.title}>
                      {mode === "login" ? asRole?.loginTitle ?? "Welcome back" : "Welcome back"}
                    </h1>
                    <p className={styles.sub}>
                      {mode === "login" && asRole
                        ? asRole.loginSubtitle
                        : "Customers, restaurants and riders – sab yahin se login karein."}
                    </p>
                    <PasswordLoginForm className={styles.authForm} />
                  </>
                ) : challenge ? (
                  <OtpVerifyForm
                    challengeId={challenge.challengeId}
                    maskedEmail={challenge.maskedEmail}
                    resendAvailableAt={challenge.resendAvailableAt}
                    onVerified={(user) => {
                      onLogin(user);
                      navigate(authDestination(user.role));
                    }}
                    onBack={() => setChallenge(null)}
                  />
                ) : (
                  <form onSubmit={submitJoin} className={styles.joinForm}>
                    <h1 className={styles.title}>Join platr™</h1>
                    <p className={styles.sub}>Aap kaun hain?</p>

                    <div className={styles.roles}>
                      {roles.map((option) => (
                        <button
                          type="button"
                          key={option.id}
                          className={`${styles.roleCard} ${role === option.id ? styles.roleOn : ""}`}
                          aria-pressed={role === option.id}
                          onClick={() => setRole(option.id)}
                        >
                          {option.icon}
                          <b>{option.title}</b>
                          <span>{option.desc}</span>
                        </button>
                      ))}
                    </div>

                    {!registrationAllowed ? (
                      <div className={styles.comingSoon}>
                        <h2>{roles.find((option) => option.id === role)?.title} registration is currently closed</h2>
                        <p>The platr™ admin team has not opened registration for this account type yet. Please check back later.</p>
                      </div>
                    ) : (
                      <>
                        {error && (
                          <div role="alert" className={styles.error}>
                            {error}
                          </div>
                        )}
                        <label className={styles.field}>
                          <span>
                            {role === "restaurant" ? "Owner name" : "Full name"}
                          </span>
                          <Input
                            value={form.displayName}
                            onChange={(event) =>
                              setForm({
                                ...form,
                                displayName: event.target.value,
                              })
                            }
                            placeholder="Your name"
                          />
                        </label>
                        <div className={styles.row}>
                          <label className={styles.field}>
                            <span>Mobile number</span>
                            <Input
                              inputMode="numeric"
                              maxLength={10}
                              value={form.phone}
                              onChange={(event) =>
                                setForm({
                                  ...form,
                                  phone: event.target.value.replace(/\D/g, ""),
                                })
                              }
                              placeholder="98XXXXXXXX"
                            />
                          </label>
                          <label className={styles.field}>
                            <span>Email</span>
                            <Input
                              type="email"
                              value={form.email}
                              onChange={(event) =>
                                setForm({ ...form, email: event.target.value })
                              }
                              placeholder="you@email.com"
                            />
                          </label>
                        </div>
                        <label className={styles.field}>
                          <span>Password</span>
                          <Input
                            type="password"
                            value={form.password}
                            onChange={(event) =>
                              setForm({ ...form, password: event.target.value })
                            }
                            placeholder="At least 8 characters"
                          />
                        </label>
                        <Button
                          type="submit"
                          size="lg"
                          disabled={loading}
                          className={styles.submit}
                        >
                          {loading && <Spinner size="sm" />}
                          {role === "user"
                            ? "Create account"
                            : role === "restaurant"
                              ? "Continue to restaurant details"
                              : "Continue to rider details"}
                        </Button>
                      </>
                    )}
                  </form>
                )}
              </div>

              {!settings.data.sitePaused && (settings.data.allowCustomerRegistration || settings.data.allowRiderRegistration || settings.data.allowMerchantRegistration) && (
                <Button
                  type="button"
                  variant="ghost"
                  className={styles.modeButton}
                  onClick={() => {
                    if (mode === "login" && asRole) setRole(asRole.id);
                    setMode(mode === "login" ? "join" : "login");
                  }}
                >
                  {mode === "login"
                    ? "Create account"
                    : "I already have an account"}
                </Button>
              )}

              <div className={styles.skip}>
                <Link to="/">Skip for now</Link> to continue
              </div>

              <small className={styles.terms}>
                {mode === "join" && !settings.data.sitePaused
                  ? "By creating an account you agree to the "
                  : "By continuing you agree to the "}
                <Link to="/terms">Terms of Service</Link> and{" "}
                {mode === "join" && !settings.data.sitePaused
                  ? "acknowledge the "
                  : ""}
                <Link to="/privacy-policy">Privacy Policy</Link>
              </small>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
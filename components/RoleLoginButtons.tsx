import { Bike, Store, User } from "lucide-react";
import { Link } from "react-router-dom";
import styles from "./RoleLoginButtons.module.css";

type RoleLoginButtonsProps = {
  className?: string;
};

const roles = [
  {
    title: "Customer",
    subtitle: "Order food",
    to: "/login?as=user",
    icon: User,
  },
  {
    title: "Restaurant",
    subtitle: "Restaurant dashboard",
    to: "/login?as=restaurant",
    icon: Store,
  },
  {
    title: "Rider",
    subtitle: "Rider dashboard",
    to: "/login?as=rider",
    icon: Bike,
  },
] as const;

export function RoleLoginButtons({ className }: RoleLoginButtonsProps) {
  return (
    <section className={`${styles.section} ${className ?? ""}`} aria-labelledby="role-login-heading">
      <h2 id="role-login-heading" className={styles.heading}>
        Login karein – aap kaun hain?
      </h2>

      <div className={styles.grid}>
        {roles.map(({ title, subtitle, to, icon: Icon }) => (
          <Link key={to} to={to} className={styles.role}>
            <span className={styles.icon} aria-hidden="true">
              <Icon size={20} />
            </span>
            <span className={styles.details}>
              <span className={styles.title}>{title}</span>
              <span className={styles.subtitle}>{subtitle}</span>
            </span>
          </Link>
        ))}
      </div>

      <p className={styles.register}>
        Naya account? <Link to="/login?join=user">Register karein</Link>
      </p>
    </section>
  );
}
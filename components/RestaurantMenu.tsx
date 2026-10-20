import { Minus, Plus, UtensilsCrossed } from "lucide-react";
import type { MenuItem } from "../endpoints/restaurant_GET.schema";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { Button } from "./Button";
import styles from "./RestaurantMenu.module.css";

type RestaurantMenuProps = {
  menu: MenuItem[];
  cart: Record<number, number>;
  isOpen: boolean;
  onChange: (itemId: number, delta: number) => void;
  className?: string;
};

export function RestaurantMenu({
  menu, cart, isOpen, onChange, className,
}: RestaurantMenuProps) {
  const visibleMenu = menu;
  const categories = Array.from(new Set(visibleMenu.map((item) => item.category)));

  return (
    <div className={`${styles.menu} ${className ?? ""}`}>
      <div className={styles.menuHeader}>
        <h2>Menu</h2>
      </div>
      {visibleMenu.length === 0 && (
        <div className={styles.empty}>
          Menu coming soon.
        </div>
      )}
      {categories.map((category) => (
        <section key={category} className={styles.category}>
          <h2>{category}</h2>
          <div className={styles.items}>
            {visibleMenu.filter((item) => item.category === category).map((item) => (
              <article key={item.id} className={styles.item}>
                {item.imageUrl ? (
                  <img className={styles.itemImage} src={item.imageUrl} alt={item.name} loading="lazy" />
                ) : (
                  <span className={styles.imageFallback}><UtensilsCrossed size={28} aria-hidden="true" /></span>
                )}
                <div className={styles.itemInfo}>
                  <span className={item.isVeg ? styles.veg : styles.nonveg} aria-label={item.isVeg ? "Veg" : "Non-veg"} />
                  <h3>{item.name}</h3>
                  <b className={styles.price}>{ziptoConfig.rupees(item.price)}</b>
                  {item.description && <p>{item.description}</p>}
                </div>
                {cart[item.id] ? (
                  <div className={styles.stepper} aria-label={`Quantity for ${item.name}`}>
                    <button type="button" className={styles.decrease} onClick={() => onChange(item.id, -1)} aria-label={`Remove one ${item.name}`}><Minus size={16} /></button>
                    <span>{cart[item.id]}</span>
                    <button type="button" className={styles.increase} onClick={() => onChange(item.id, 1)} disabled={cart[item.id] >= 20} aria-label={`Add one ${item.name}`}><Plus size={16} /></button>
                  </div>
                ) : (
                  <Button variant="outline" disabled={!isOpen} onClick={() => onChange(item.id, 1)} className={styles.add}>
                    ADD
                  </Button>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
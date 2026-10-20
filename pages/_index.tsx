import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import {
  ArrowRight,
  BadgeIndianRupee,
  Bell,
  Bike,
  ChevronDown,
  Clock,
  Heart,
  Leaf,
  MapPin,
  Search,
  Store,
} from "lucide-react";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { useVegMode } from "../helpers/useVegMode";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { useAuth } from "../helpers/useAuth";
import { filterHomeListings, homeCategories } from "../helpers/homeFilters";
import { useScrollReveal } from "../helpers/useScrollReveal";
import { useNativeApp } from "../helpers/useNativeApp";
import { useDeliveryLocation } from "../helpers/useDeliveryLocation";
import { AppHomeHeader } from "../components/AppHomeHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import { Skeleton } from "../components/Skeleton";
import { Button } from "../components/Button";
import { LaunchingSoonHome } from "../components/LaunchingSoonHome";
import { RoleLoginButtons } from "../components/RoleLoginButtons";
import { RestaurantRatingStars } from "../components/RestaurantRatingStars";
import styles from "./_index.module.css";

export default function HomePage() {
  const nativeApp = useNativeApp();
  const { location, setLocation, useCurrentLocation, locating } = useDeliveryLocation();
  const town = location.town;
  const [search, setSearch] = useState("");
  const [categoryLabel, setCategoryLabel] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const revealDishes = useScrollReveal();
  const revealRestaurants = useScrollReveal();

  const { authState } = useAuth();
  const role = authState.type === "authenticated" ? authState.user.role : null;
  const { vegMode, setVegMode, isSaving } = useVegMode();
  const restaurantsQuery = ziptoHooks.useRestaurants(town, vegMode);
  const settingsQuery = ziptoHooks.useSettings();

  // Admin accounts should land directly in the operations workspace, never the food-ordering home.
  useEffect(() => {
    if (role === "admin") navigate("/admin", { replace: true });
  }, [role, navigate]);

  useEffect(() => {
    if (searchParams.get("search") === "1" && (!settingsQuery.data?.launchMode || role === "admin")) {
      searchRef.current?.focus();
      searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchParams, nativeApp, settingsQuery.data, role]);
  const settings = settingsQuery.data;
  const data = restaurantsQuery.isPlaceholderData
    ? undefined
    : restaurantsQuery.data;
  const category = homeCategories.find((item) => item.label === categoryLabel) ?? null;
  const listings = filterHomeListings(data, search, category);
  const filtering = Boolean(search.trim() || category);

  const roleBanners = (
    <>
      {role === "restaurant" && (
        <Link to="/partner" className={styles.roleBanner}>
          <Store size={18} /> Go to your restaurant dashboard <ArrowRight size={16} />
        </Link>
      )}
      {role === "rider" && (
        <Link to="/rider" className={styles.roleBanner}>
          <Bike size={18} /> Go to your rider dashboard <ArrowRight size={16} />
        </Link>
      )}
    </>
  );

  if (settingsQuery.isFetching && !settings) {
    return (
      <div className={styles.loading} aria-label="Loading website settings">
        <Skeleton className={styles.loadingHero} />
        <Skeleton />
        <Skeleton />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className={styles.empty}>
        <p>Could not load website settings. {settingsQuery.error instanceof Error && settingsQuery.error.message}</p>
        <Button onClick={() => void settingsQuery.refetch()}>Retry</Button>
      </div>
    );
  }

  if (settings.launchMode && role !== "admin") {
    return (
      <>
        <Helmet><title>platr™ – Launching soon</title></Helmet>
        {roleBanners}
        <LaunchingSoonHome
          settings={settings}
          showLogin={authState.type === "unauthenticated"}
        />
      </>
    );
  }

  return (
    <div className={`${styles.page} ${nativeApp ? styles.nativePage : ""} ${role === "user" ? styles.darkPage : ""}`}>
      <Helmet>
        <title>platr™ – Affordable for Everyone</title>
      </Helmet>

      {roleBanners}
      {settings.launchMode && role === "admin" && (
        <div className={styles.previewBanner}>Preview – public sees Launching soon</div>
      )}

      {nativeApp ? (
        <AppHomeHeader
          className={styles.nativeHomeHeader}
          customerApp={role === "user"}
          location={location}
          setLocation={setLocation}
          useCurrentLocation={useCurrentLocation}
          locating={locating}
          searchValue={search}
          onSearchChange={setSearch}
          searchRef={searchRef}
        />
      ) : (
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.location}>
            <MapPin size={22} aria-hidden="true" />
            <div>
              <span className={styles.locationLabel}>Delivering to</span>
              <Select value={town} onValueChange={(selectedTown) =>
                setLocation({
                  kind: "town",
                  label: selectedTown,
                  line: `${selectedTown}, Uttarakhand`,
                  town: selectedTown,
                })
              }>
                <SelectTrigger className={styles.townTrigger} aria-label="Choose delivery town">
                  <SelectValue placeholder="Choose town" />
                  <span>, Uttarakhand</span>
                  <ChevronDown size={16} aria-hidden="true" />
                </SelectTrigger>
                <SelectContent>
                  {ziptoConfig.towns.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Link to="/orders" className={styles.notification} aria-label="View orders">
            <Bell size={21} />
          </Link>
        </div>
        <div className={styles.searchBox}>
          <Search size={21} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search dishes, restaurants..."
            aria-label="Search dishes and restaurants"
          />
        </div>
      </header>
      )}

      {authState.type === "unauthenticated" && <RoleLoginButtons />}

      <section className={styles.hero} aria-label="platr™ food delivery">
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}>Uttarakhand ka apna low commission food app</span>
          <h1 className={styles.heroBrand}>Good food.<br />Fair prices.</h1>
          <p className={styles.heroDescription}>
            Affordable for everyone.
          </p>
          <div className={styles.heroActions}>
            <Button
              variant="primary"
              onClick={() => document.getElementById("home-restaurants")?.scrollIntoView({ behavior: "smooth" })}
            >
              Order now
            </Button>
          </div>
        </div>
        <img
          className={styles.heroImage}
          src="/_cdn/static/2183d340-361e-413c-92e1-567761d859d5.png"
          alt="Food from local restaurants"
        />
      </section>

      <section aria-label="Browse categories">
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>What are you craving?</h2>
        </div>
        <div className={styles.categories}>
          {homeCategories.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`${styles.category} ${categoryLabel === item.label ? styles.selectedCategory : ""}`}
              aria-pressed={categoryLabel === item.label}
              onClick={() => setCategoryLabel(categoryLabel === item.label ? null : item.label)}
            >
              <span className={styles.categoryImage}>
                <img src={item.image} alt="" loading="lazy" />
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="benefits-title">
        <div className={styles.sectionHead}>
          <h2 id="benefits-title" className={styles.sectionTitle}>Exclusive Benefits</h2>
        </div>
        <div className={styles.benefits}>
          <div className={styles.benefit}>
            <span className={styles.benefitIcon}><BadgeIndianRupee size={22} /></span>
            <div className={styles.benefitCopy}>
              <b>Menu-rate Prices</b>
              <span>Same price as the restaurant</span>
            </div>
          </div>
          <div className={styles.benefit}>
            <span className={styles.benefitIcon}><Store size={22} /></span>
            <div className={styles.benefitCopy}>
              <b>Lower Commissions</b>
              <span>Local restaurants keep more</span>
            </div>
          </div>
          <div className={styles.benefit}>
            <span className={styles.benefitIcon}><Heart size={22} /></span>
            <div className={styles.benefitCopy}>
              <b>Your Local Favorites</b>
              <span>From your own town</span>
            </div>
          </div>
        </div>
      </section>

      <section ref={revealDishes} className={styles.revealSection} aria-labelledby="dishes-title">
        <div className={styles.sectionHead}>
          <h2 id="dishes-title" className={styles.sectionTitle}>Popular dishes in {town}</h2>
          <span className={styles.count}>Fresh from local menus</span>
        </div>
        {restaurantsQuery.isFetching && !data ? (
          <div className={styles.dishGrid}>
            {[0, 1, 2].map((index) => <Skeleton key={index} className={styles.dishSkeleton} />)}
          </div>
        ) : restaurantsQuery.error ? (
          <div className={styles.empty}>
            <p>Could not load popular dishes. {restaurantsQuery.error instanceof Error ? restaurantsQuery.error.message : "Please try again."}</p>
            <Button onClick={() => void restaurantsQuery.refetch()}>Retry</Button>
          </div>
        ) : listings.featuredDishes.length ? (
          <div className={styles.dishGrid}>
            {listings.featuredDishes.map((dish) => (
              <Link key={dish.id} to={`/r/${dish.restaurantId}`} className={styles.dishCard}>
                <div className={styles.dishCover}>
                  <img
                    className={styles.dishImage}
                    src={dish.imageUrl || ziptoHooks.coverFor(dish.restaurantId)}
                    alt={dish.imageUrl ? dish.name : ""}
                    loading="lazy"
                  />
                  <span
                    className={`${styles.dietDot} ${dish.isVeg ? styles.vegDot : styles.nonVegDot}`}
                    role="img"
                    aria-label={dish.isVeg ? "Vegetarian" : "Non-vegetarian"}
                  />
                </div>
                <div className={styles.dishBody}>
                  <b>{dish.name}</b>
                  <span className={styles.dishRestaurant}>{dish.restaurantName}</span>
                  <strong>{ziptoConfig.rupees(dish.price)}</strong>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <h3>{filtering ? "No dishes match your filters" : "Local favourites are on the way"}</h3>
            <p>{filtering ? "Try another search or category." : "Dish photos uploaded by approved restaurants will appear here."}</p>
          </div>
        )}
      </section>

      <section
        id="home-restaurants"
        ref={revealRestaurants}
        className={styles.revealSection}
        aria-labelledby="restaurants-title"
      >
        <div className={styles.sectionHead}>
          <h2 id="restaurants-title" className={styles.sectionTitle}>Top Restaurants Near You</h2>
          {data && <span className={styles.count}>{listings.restaurants.length} places in {town}</span>}
        </div>

        {restaurantsQuery.isFetching && !data ? (
          <div className={styles.grid}>
            {[0, 1, 2].map((index) => <Skeleton key={index} className={styles.cardSkeleton} />)}
          </div>
        ) : restaurantsQuery.error ? (
          <div className={styles.empty}>
            <p>Could not load restaurants. {restaurantsQuery.error instanceof Error ? restaurantsQuery.error.message : "Please try again."}</p>
            <Button onClick={() => void restaurantsQuery.refetch()}>Retry</Button>
          </div>
        ) : listings.restaurants.length === 0 ? (
          <div className={styles.empty}>
            <h3>{filtering ? "No restaurants match your filters" : `platr™ is coming to ${town} soon`}</h3>
            <p>{filtering ? "Try another search or category." : role === "user" ? "We're bringing local restaurants to your town soon. Stay tuned!" : "Restaurant owner ho? Join early and get the Fair Plan."}</p>
            {!filtering && role !== "user" && (
              <Button asChild><Link to="/login?join=restaurant">Register your restaurant</Link></Button>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {listings.restaurants.map((restaurant) => (
              <Link
                key={restaurant.id}
                to={`/r/${restaurant.id}`}
                className={`${styles.card} ${!restaurant.isOpen ? styles.closed : ""}`}
              >
                <div className={styles.cover}>
                  <img
                    src={ziptoHooks.coverFor(restaurant.id, restaurant.imageUrl)}
                    alt=""
                    loading="lazy"
                  />
                  <span className={styles.priceTag}>Menu-rate prices</span>
                  <Heart className={styles.cardHeart} size={19} aria-hidden="true" />
                  {!restaurant.isOpen && <span className={styles.closedTag}>Closed now</span>}
                </div>
                {restaurant.profileImageUrl && (
                  <img
                    className={styles.profileAvatar}
                    src={restaurant.profileImageUrl}
                    alt={`${restaurant.name} display photo`}
                  />
                )}
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>
                    <h3>{restaurant.name}</h3>
                    <RestaurantRatingStars
                      size="sm"
                      ratingAverage={restaurant.ratingAverage}
                      ratingCount={restaurant.ratingCount}
                    />
                  </div>
                  <p>{restaurant.cuisine || restaurant.description || "Freshly made food"}</p>
                  <div className={styles.meta}>
                    <span><Clock size={14} /> {restaurant.avgPrepMinutes + 15}–{restaurant.avgPrepMinutes + 30} min</span>
                    <span><Leaf size={14} /> {vegMode ? `${restaurant.vegItemCount} veg dishes` : `${restaurant.itemCount} dishes`}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {role !== "user" && <section className={styles.partners} aria-label="Join platr™">
        <div className={styles.partnerCard}>
          <Store size={28} />
          <h3>Restaurant partner banein</h3>
          <p>Basic: ₹0 monthly, {settings.basicCommissionPercent}% commission. Pro: {ziptoConfig.rupees(settings.proMonthlyFee)} + GST / 30 days + {settings.proCommissionPercent}% commission.</p>
          <Button asChild variant="primary"><Link to="/login?join=restaurant">Join as restaurant</Link></Button>
        </div>
        <div className={`${styles.partnerCard} ${styles.partnerGold}`}>
          <Bike size={28} />
          <h3>Rider banein, poori kamai</h3>
          <p>Base pay + distance pay + incentive on every delivery. Apne time par kaam karo.</p>
          <Button asChild variant="secondary"><Link to="/login?join=rider">Join as rider</Link></Button>
        </div>
      </section>}
    </div>
  );
}
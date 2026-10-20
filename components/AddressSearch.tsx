import { useEffect, useId, useState } from "react";
import { MapPin, Search } from "lucide-react";
import type { OutputType as PlaceResult } from "../endpoints/maps/place_POST.schema";
import {
  useAddressSuggestions,
  usePlaceDetails,
} from "../helpers/useAddressSearch";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import styles from "./AddressSearch.module.css";

type Props = {
  onSelect: (result: PlaceResult) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

function isUnavailable(error: unknown): boolean {
  return (
    error instanceof Error &&
    "status" in error &&
    error.status === 503
  );
}

export const AddressSearch = ({
  onSelect,
  placeholder = "Search area, street or landmark",
  disabled = false,
  className,
}: Props) => {
  const [query, setQuery] = useState("");
  const [sessionToken, setSessionToken] = useState(() => crypto.randomUUID());
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [unavailable, setUnavailable] = useState(false);
  const listId = useId();

  const suggestions = useAddressSuggestions(
    disabled ? "" : query,
    sessionToken,
  );
  const place = usePlaceDetails();

  useEffect(() => {
    if (isUnavailable(suggestions.error) || isUnavailable(place.error)) {
      setUnavailable(true);
    }
  }, [suggestions.error, place.error]);

  if (
    unavailable ||
    isUnavailable(suggestions.error) ||
    isUnavailable(place.error)
  ) {
    return null;
  }

  const showPanel = isOpen && !disabled && query.trim().length >= 3;
  const loading =
    showPanel &&
    (!suggestions.isCurrentQuery ||
      suggestions.isFetching ||
      place.isPending);
  const matches =
    suggestions.isCurrentQuery ? (suggestions.data?.suggestions ?? []) : [];

  async function selectPlace(placeId: string) {
    if (place.isPending || disabled) return;
    try {
      const result = await place.mutateAsync({ placeId, sessionToken });
      onSelect(result);
      setQuery("");
      setIsOpen(false);
      setActiveIndex(-1);
      setSessionToken(crypto.randomUUID());
    } catch {
      // The mutation's error state displays the failure or hides an
      // unconfigured search. Keep the query so the user can retry.
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showPanel) return;
    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (loading || !matches.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? matches.length - 1 : index - 1,
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      void selectPlace(matches[activeIndex].placeId);
    }
  }

  return (
    <div className={`${styles.root} ${className ?? ""}`}>
      <div className={styles.inputWrap}>
        <Search className={styles.searchIcon} size={19} aria-hidden="true" />
        <Input
          className={styles.input}
          type="search"
          value={query}
          placeholder={placeholder}
          disabled={disabled || place.isPending}
          aria-label="Search area, street or landmark"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPanel && !loading && matches.length > 0}
          aria-controls={showPanel && !loading && matches.length ? listId : undefined}
          aria-activedescendant={
            showPanel && !loading && activeIndex >= 0 && matches[activeIndex]
              ? `${listId}-${activeIndex}`
              : undefined
          }
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setIsOpen(false);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
            setIsOpen(true);
            place.reset();
          }}
        />
      </div>

      {showPanel && (
        <div className={styles.panel} aria-live="polite">
          {loading ? (
            <div className={styles.loading} role="status">
              <Skeleton className={styles.skeleton} />
              <Skeleton className={styles.skeleton} />
              <span className={styles.visuallyHidden}>Searching addresses</span>
            </div>
          ) : suggestions.isError || place.isError ? (
            <p className={styles.message} role="alert">
              Address search failed. Please try again.
            </p>
          ) : matches.length ? (
            <ul className={styles.list} id={listId} role="listbox">
              {matches.map((match, index) => (
                <li
                  className={`${styles.option} ${index === activeIndex ? styles.active : ""}`}
                  key={match.placeId}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void selectPlace(match.placeId)}
                >
                  <MapPin size={17} className={styles.pin} aria-hidden="true" />
                  <span className={styles.optionText}>
                    <span className={styles.primary}>{match.primaryText}</span>
                    {match.secondaryText && (
                      <span className={styles.secondary}>
                        {match.secondaryText}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.message}>No matches</p>
          )}
          <p className={styles.attribution}>Powered by Google</p>
        </div>
      )}
    </div>
  );
};
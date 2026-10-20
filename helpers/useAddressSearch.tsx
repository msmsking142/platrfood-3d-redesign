import { useMutation, useQuery } from "@tanstack/react-query";
import { postMapsAutocomplete } from "../endpoints/maps/autocomplete_POST.schema";
import { postMapsPlace } from "../endpoints/maps/place_POST.schema";
import { postMapsReverseGeocode } from "../endpoints/maps/reverse_geocode_POST.schema";
import { useDebounce } from "./useDebounce";

export function useAddressSuggestions(query: string, sessionToken: string) {
  const debouncedQuery = useDebounce(query.trim(), 400);
  const result = useQuery({
    queryKey: ["maps", "autocomplete", sessionToken, debouncedQuery],
    queryFn: () =>
      postMapsAutocomplete({
        input: debouncedQuery,
        sessionToken,
      }),
    enabled: debouncedQuery.length >= 3,
    staleTime: 5 * 60 * 1_000,
    placeholderData: (previousData) => previousData,
    retry: false,
  });

  return {
    ...result,
    isCurrentQuery: debouncedQuery === query.trim(),
  };
}

export function usePlaceDetails() {
  return useMutation({ mutationFn: postMapsPlace });
}

export function useReverseGeocode() {
  return useMutation({ mutationFn: postMapsReverseGeocode });
}
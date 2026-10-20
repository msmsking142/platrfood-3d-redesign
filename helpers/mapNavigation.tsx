type Destination = {
  lat: number | null;
  lng: number | null;
  address?: string;
  town?: string;
};

export const mapNavigation = {
  directionsUrl(dest: Destination): string {
    let destination: string;

    if (dest.lat !== null && dest.lng !== null) {
      destination = `${dest.lat},${dest.lng}`;
    } else {
      const addressParts = [dest.address?.trim(), dest.town?.trim()].filter(
        (part): part is string => Boolean(part),
      );

      if (addressParts.length === 0) {
        throw new Error("Directions require coordinates, an address, or a town.");
      }

      destination = `${addressParts.join(", ")}, Uttarakhand`;
    }

    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  },

  placeUrl(lat: number, lng: number): string {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  },
};
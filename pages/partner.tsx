import React from "react";
import { RestaurantRoute } from "../components/ProtectedRoute";
import PartnerContent from "./partnerContent";

export default function PartnerPage() {
  return <RestaurantRoute><PartnerContent /></RestaurantRoute>;
}
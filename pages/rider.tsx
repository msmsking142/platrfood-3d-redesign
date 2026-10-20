import React from "react";
import { RiderRoute } from "../components/ProtectedRoute";
import RiderContent from "./riderContent";

export default function RiderPage() {
  return <RiderRoute><RiderContent /></RiderRoute>;
}
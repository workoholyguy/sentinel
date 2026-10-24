import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = {
  title: "UPLink · Network mission control",
};

export default function DashboardPage() {
  return <Dashboard />;
}

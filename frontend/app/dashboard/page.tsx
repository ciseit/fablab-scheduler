import AppLayout from "@/components/layout/AppLayout";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import MetricsGrid from "@/components/dashboard/MetricsGrid";
import TodaysSchedule from "@/components/dashboard/TodaysSchedule";
import ActionRequired from "@/components/dashboard/ActionRequired";
import QuickActions from "@/components/dashboard/QuickActions";
import RecentActivity from "@/components/dashboard/RecentActivity";
import ActiveCampaigns from "@/components/dashboard/ActiveCampaigns";

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="space-y-8">

        <DashboardHeader />

        <MetricsGrid />

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">

          <TodaysSchedule />

          <div className="space-y-6">
            <QuickActions />
            <ActionRequired />
            <RecentActivity />
          </div>

        </div>

        <ActiveCampaigns />

      </div>
    </AppLayout>
  );
}
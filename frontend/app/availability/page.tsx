import AppLayout from "@/components/layout/AppLayout";

export default function AvailabilityPage() {
  return (
    <AppLayout>
      <div>
        <p className="text-sm font-medium text-neutral-500">
          Availability
        </p>

        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-950">
          Manage availability
        </h1>

        <p className="mt-3 text-base text-neutral-600">
          Review technician availability, preferred hours, backup times, and restrictions.
        </p>
      </div>
    </AppLayout>
  );
}
export type TodaysScheduleItem = {
  shiftId: number;
  startTime: string;
  endTime: string;
  requiredTechnicians: number;
  technicianNames: string[];
};

type TodaysScheduleProps = {
  campaignName: string | null;
  dateLabel: string;
  items: TodaysScheduleItem[];
  loading?: boolean;
};

export default function TodaysSchedule({
  campaignName,
  dateLabel,
  items,
  loading = false,
}: TodaysScheduleProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-neutral-950">
          Today&apos;s schedule
        </h2>

        <p className="mt-1 text-sm text-neutral-500">
          {dateLabel}
          {campaignName ? ` · ${campaignName}` : ""}
        </p>
      </div>

      {loading ? (
        <div className="px-6 py-10 text-center text-sm text-neutral-500">
          Loading today&apos;s schedule...
        </div>
      ) : !campaignName ? (
        <div className="px-6 py-10 text-center">
          <p className="font-medium text-neutral-900">
            No active availability request
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Open an availability request to see today&apos;s coverage
            here.
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="font-medium text-neutral-900">
            No shifts scheduled for today
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Add coverage shifts in the Schedule Builder to see them
            here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200">
          {items.map((item) => {
            const filled = item.technicianNames.length;
            const isFullyStaffed = filled >= item.requiredTechnicians;

            return (
              <article
                key={item.shiftId}
                className="grid gap-3 px-6 py-5 sm:grid-cols-[140px_1fr_auto] sm:items-center"
              >
                <p className="text-sm font-medium text-neutral-500">
                  {item.startTime} – {item.endTime}
                </p>

                <div>
                  <h3 className="font-medium text-neutral-950">
                    {filled > 0
                      ? item.technicianNames.join(", ")
                      : "Unassigned"}
                  </h3>

                  <p className="mt-1 text-sm text-neutral-500">
                    {filled} of {item.requiredTechnicians}{" "}
                    {item.requiredTechnicians === 1
                      ? "technician"
                      : "technicians"}{" "}
                    assigned
                  </p>
                </div>

                <span
                  className={
                    isFullyStaffed
                      ? "w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                      : "w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                  }
                >
                  {isFullyStaffed ? "Covered" : "Needs coverage"}
                </span>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

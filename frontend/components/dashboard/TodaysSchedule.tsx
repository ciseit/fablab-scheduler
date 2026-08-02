const schedule = [
  {
    time: "9:00 AM",
    title: "Opening coverage",
    technician: "Maya Patel",
    status: "Confirmed",
  },
  {
    time: "11:00 AM",
    title: "Laser lab support",
    technician: "Jordan Lee",
    status: "Confirmed",
  },
  {
    time: "1:00 PM",
    title: "Lunch coverage",
    technician: "Unassigned",
    status: "Needs coverage",
  },
  {
    time: "3:00 PM",
    title: "3D printing support",
    technician: "Alex Kim",
    status: "Confirmed",
  },
];

export default function TodaysSchedule() {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-neutral-950">
          Today&apos;s schedule
        </h2>

        <p className="mt-1 text-sm text-neutral-500">
          Tuesday, July 28
        </p>
      </div>

      <div className="divide-y divide-neutral-200">
        {schedule.map((item) => (
          <article
            key={`${item.time}-${item.title}`}
            className="grid gap-3 px-6 py-5 sm:grid-cols-[100px_1fr_auto] sm:items-center"
          >
            <p className="text-sm font-medium text-neutral-500">
              {item.time}
            </p>

            <div>
              <h3 className="font-medium text-neutral-950">
                {item.title}
              </h3>

              <p className="mt-1 text-sm text-neutral-500">
                {item.technician}
              </p>
            </div>

            <span
              className={
                item.status === "Confirmed"
                  ? "w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                  : "w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
              }
            >
              {item.status}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
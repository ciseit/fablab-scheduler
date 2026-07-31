import { CalendarPlus, Users, Send } from "lucide-react";

export default function QuickActions() {
  const actions = [
    {
      title: "New Availability Request",
      icon: CalendarPlus,
    },
    {
      title: "Add Technician",
      icon: Users,
    },
    {
      title: "Generate Schedule",
      icon: Send,
    },
  ];

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Quick Actions</h2>

      <div className="mt-5 space-y-3">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.title}
              className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 p-4 transition hover:bg-neutral-50"
            >
              <Icon size={20} />
              <span>{action.title}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
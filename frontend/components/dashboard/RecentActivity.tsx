import { CheckCircle2, Clock3, UserPlus } from "lucide-react";

const activity = [
  {
    icon: UserPlus,
    title: "Maya Patel submitted availability",
    time: "2 min ago",
  },
  {
    icon: CheckCircle2,
    title: "Fall 2026 Availability Request published",
    time: "25 min ago",
  },
  {
    icon: Clock3,
    title: "Jordan Lee updated preferred hours",
    time: "1 hour ago",
  },
];

export default function RecentActivity() {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Recent Activity</h2>

      <div className="mt-5 space-y-4">
        {activity.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className="flex items-start gap-3"
            >
              <div className="mt-1 rounded-lg bg-neutral-100 p-2">
                <Icon size={18} />
              </div>

              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-neutral-500">
                  {item.time}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
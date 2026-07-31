import { Copy, ExternalLink, MoreHorizontal } from "lucide-react";

const campaigns = [
  {
    name: "Fall 2026 Technician Availability",
    status: "Open",
    submissions: "14 of 18",
    closes: "August 7",
    link: "/submit/fall-2026-demo",
  },
  {
    name: "Weekend Coverage Collection",
    status: "Draft",
    submissions: "0 of 8",
    closes: "Not published",
    link: "#",
  },
];

export default function ActiveCampaigns() {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950">
            Active campaigns
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Track submissions and share public availability links.
          </p>
        </div>

        <button
          type="button"
          className="text-sm font-medium text-neutral-700 transition hover:text-neutral-950"
        >
          View all
        </button>
      </div>

      <div className="divide-y divide-neutral-200">
        {campaigns.map((campaign) => (
          <article
            key={campaign.name}
            className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-medium text-neutral-950">
                  {campaign.name}
                </h3>

                <span
                  className={
                    campaign.status === "Open"
                      ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                      : "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600"
                  }
                >
                  {campaign.status}
                </span>
              </div>

              <p className="mt-2 text-sm text-neutral-500">
                {campaign.submissions} submissions · Closes {campaign.closes}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`Copy link for ${campaign.name}`}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
              >
                <Copy size={17} />
              </button>

              <button
                type="button"
                aria-label={`Open ${campaign.name}`}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
              >
                <ExternalLink size={17} />
              </button>

              <button
                type="button"
                aria-label={`More actions for ${campaign.name}`}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
              >
                <MoreHorizontal size={17} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
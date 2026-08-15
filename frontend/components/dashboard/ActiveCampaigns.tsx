"use client";

import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink } from "lucide-react";

export type ActiveCampaignItem = {
  id: number;
  name: string;
  statusLabel: "Open" | "Draft" | "Closed";
  submittedCount: number;
  totalTechnicians: number;
  closesLabel: string;
  publicToken: string;
  href: string;
};

type ActiveCampaignsProps = {
  campaigns: ActiveCampaignItem[];
  loading?: boolean;
  copiedCampaignId: number | null;
  onCopyLink: (campaign: ActiveCampaignItem) => void;
};

export default function ActiveCampaigns({
  campaigns,
  loading = false,
  copiedCampaignId,
  onCopyLink,
}: ActiveCampaignsProps) {
  const router = useRouter();

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950">
            Availability requests
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Track submissions and share public availability links.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/availability-requests")}
          className="text-sm font-medium text-neutral-700 transition hover:text-neutral-950"
        >
          View all
        </button>
      </div>

      {loading ? (
        <div className="px-6 py-10 text-center text-sm text-neutral-500">
          Loading availability requests...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="font-medium text-neutral-900">
            No availability requests yet
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Create one to start collecting technician availability.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200">
          {campaigns.map((campaign) => (
            <article
              key={campaign.id}
              className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-neutral-950">
                    {campaign.name}
                  </h3>

                  <span
                    className={
                      campaign.statusLabel === "Open"
                        ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                        : "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600"
                    }
                  >
                    {campaign.statusLabel}
                  </span>
                </div>

                <p className="mt-2 text-sm text-neutral-500">
                  {campaign.submittedCount} of{" "}
                  {campaign.totalTechnicians} submissions · Closes{" "}
                  {campaign.closesLabel}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Copy link for ${campaign.name}`}
                  onClick={() => onCopyLink(campaign)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
                >
                  {copiedCampaignId === campaign.id ? (
                    <Check size={17} />
                  ) : (
                    <Copy size={17} />
                  )}
                </button>

                <a
                  href={campaign.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open public form for ${campaign.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
                >
                  <ExternalLink size={17} />
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

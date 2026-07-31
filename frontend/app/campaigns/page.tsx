"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppLayout from "@/components/layout/AppLayout";
import AvailabilityRequestCard, {
  type AvailabilityRequest,
} from "@/components/availability-requests/AvailabilityRequestCard";
import AvailabilityRequestToolbar from "@/components/availability-requests/AvailabilityRequestToolbar";

const initialRequests: AvailabilityRequest[] = [
  {
    id: 1,
    name: "Fall 2026 Availability",
    status: "Open",
    opensOn: "August 1",
    closesOn: "August 7",
    submittedCount: 14,
    totalTechnicians: 18,
    publicLink: "https://fablab.app/submit/fall-2026",
  },
  {
    id: 2,
    name: "Summer Workshop Availability",
    status: "Draft",
    opensOn: "August 15",
    closesOn: "August 20",
    submittedCount: 0,
    totalTechnicians: 18,
    publicLink: "https://fablab.app/submit/summer-workshop",
  },
  {
    id: 3,
    name: "Spring 2026 Availability",
    status: "Closed",
    opensOn: "January 5",
    closesOn: "January 12",
    submittedCount: 18,
    totalTechnicians: 18,
    publicLink: "https://fablab.app/submit/spring-2026",
  },
];

export default function AvailabilityRequestsPage() {
  const router = useRouter();

  const [requests] = useState<AvailabilityRequest[]>(initialRequests);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedRequestId, setCopiedRequestId] = useState<number | null>(null);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return requests;
    }

    return requests.filter((request) =>
      [request.name, request.status, request.opensOn, request.closesOn]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [requests, searchTerm]);

  function createRequest() {
    window.alert("Create Availability Request form is the next step.");
  }

  async function copyLink(request: AvailabilityRequest) {
    try {
      await navigator.clipboard.writeText(request.publicLink);
      setCopiedRequestId(request.id);

      window.setTimeout(() => {
        setCopiedRequestId(null);
      }, 2000);
    } catch {
      window.alert("Unable to copy the link.");
    }
  }

  function generateSchedule(request: AvailabilityRequest) {
    router.push("/schedule-builder");
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <section>
          <p className="text-sm font-medium text-neutral-500">
            Availability Requests
          </p>

          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-950">
            Collect technician availability
          </h1>

          <p className="mt-3 max-w-2xl text-base text-neutral-600">
            Create a request, share the public link, track submissions, and move
            completed responses into the Schedule Builder.
          </p>
        </section>

        <AvailabilityRequestToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onCreateRequest={createRequest}
        />

        {copiedRequestId !== null && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            Shareable link copied.
          </div>
        )}

        <div className="space-y-5">
          {filteredRequests.length > 0 ? (
            filteredRequests.map((request) => (
              <AvailabilityRequestCard
                key={request.id}
                request={request}
                onCopyLink={copyLink}
                onGenerateSchedule={generateSchedule}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-16 text-center">
              <p className="font-medium text-neutral-900">
                No availability requests found
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Try another search or create a new request.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
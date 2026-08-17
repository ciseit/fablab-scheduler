"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, X } from "lucide-react";

import { getAvailabilityRequestRoster } from "@/lib/availabilityRequestApi";
import type { TechnicianSubmissionStatus } from "@/lib/availabilityRequestApi";

type SubmissionRosterDialogProps = {
  open: boolean;
  requestId: number | null;
  requestName?: string;
  onClose: () => void;
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function SubmissionRosterDialog({
  open,
  requestId,
  requestName,
  onClose,
}: SubmissionRosterDialogProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<
    TechnicianSubmissionStatus[]
  >([]);
  const [pending, setPending] = useState<
    TechnicianSubmissionStatus[]
  >([]);

  useEffect(() => {
    if (!open || requestId === null) {
      return;
    }

    let cancelled = false;

    async function loadRoster(id: number) {
      setLoading(true);
      setError("");

      try {
        const data = await getAvailabilityRequestRoster(id);

        if (cancelled) {
          return;
        }

        setSubmitted(data.submitted);
        setPending(data.pending);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        console.error(
          "Failed to load submission roster:",
          loadError
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load who has submitted availability."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRoster(requestId);

    return () => {
      cancelled = true;
    };
  }, [open, requestId]);

  if (!open || requestId === null) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submission-roster-title"
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-neutral-200 px-6 py-5">
          <div>
            <h2
              id="submission-roster-title"
              className="text-xl font-semibold text-neutral-950"
            >
              Who has submitted?
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              {requestName
                ? `Availability submission status for "${requestName}".`
                : "Availability submission status for this request."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-neutral-500">
              <Loader2 size={18} className="animate-spin" />
              Loading submission status...
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          ) : submitted.length === 0 && pending.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-500">
              No active technicians found.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 size={16} />
                  Submitted ({submitted.length})
                </h3>

                {submitted.length === 0 ? (
                  <p className="mt-3 text-sm text-neutral-500">
                    No one has submitted yet.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {submitted.map((technician) => (
                      <li
                        key={technician.technician_id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm"
                      >
                        <span className="flex items-center gap-2 font-medium text-neutral-900">
                          <CheckCircle2
                            size={15}
                            className="shrink-0 text-emerald-600"
                          />
                          {technician.technician_name}
                        </span>

                        {technician.submitted_at && (
                          <span className="shrink-0 text-xs text-neutral-500">
                            {formatTimestamp(
                              technician.submitted_at
                            )}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-600">
                  <Circle size={16} />
                  Still Waiting ({pending.length})
                </h3>

                {pending.length === 0 ? (
                  <p className="mt-3 text-sm text-neutral-500">
                    Everyone has submitted. Nice work!
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {pending.map((technician) => (
                      <li
                        key={technician.technician_id}
                        className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-medium text-neutral-700"
                      >
                        <Circle
                          size={15}
                          className="shrink-0 text-neutral-400"
                        />
                        {technician.technician_name}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

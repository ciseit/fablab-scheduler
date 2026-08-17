"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";

import type { AvailabilityRequestApiResponse } from "@/lib/availabilityRequestApi";
import type { CreateSchedulePayload } from "@/lib/scheduleApi";

type CreateScheduleDialogProps = {
  open: boolean;
  availabilityRequests: AvailabilityRequestApiResponse[];
  onClose: () => void;
  onSave: (data: CreateSchedulePayload) => Promise<void>;
};

const emptyForm: CreateSchedulePayload = {
  name: "",
  start_date: "",
  end_date: "",
  semester: "",
  notes: "",
  minimum_weekly_hours: 15,
  campaign_id: null,
};

export default function CreateScheduleDialog({
  open,
  availabilityRequests,
  onClose,
  onSave,
}: CreateScheduleDialogProps) {
  const [form, setForm] = useState<CreateSchedulePayload>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setError("");
      setSaving(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  function updateField<K extends keyof CreateSchedulePayload>(
    field: K,
    value: CreateSchedulePayload[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!form.name.trim()) {
      setError("Please give this schedule a name.");
      return;
    }

    setError("");
    setSaving(true);

    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        semester: form.semester?.trim() || null,
        notes: form.notes?.trim() || null,
      });
    } catch (saveError) {
      console.error("Failed to create schedule:", saveError);

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to create this schedule."
      );
    } finally {
      setSaving(false);
    }
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
        aria-labelledby="schedule-dialog-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5">
          <div>
            <h2
              id="schedule-dialog-title"
              className="text-xl font-semibold text-neutral-950"
            >
              Create Schedule
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Give this schedule a name and, if you have one, link it to
              an availability request so it can be generated
              automatically. You can also skip linking and build it by
              hand.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-700">
              Schedule name
            </span>

            <input
              required
              value={form.name}
              disabled={saving}
              placeholder="e.g. Fall 2026 FABLAB Schedule"
              onChange={(event) =>
                updateField("name", event.target.value)
              }
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
            />
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">
                Start date
              </span>

              <input
                type="date"
                value={form.start_date ?? ""}
                disabled={saving}
                onChange={(event) =>
                  updateField("start_date", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">
                End date
              </span>

              <input
                type="date"
                value={form.end_date ?? ""}
                disabled={saving}
                onChange={(event) =>
                  updateField("end_date", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-700">
              Semester / scheduling period
            </span>

            <input
              value={form.semester ?? ""}
              disabled={saving}
              placeholder="e.g. Fall 2026"
              onChange={(event) =>
                updateField("semester", event.target.value)
              }
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-700">
              Required weekly hours
            </span>
            <span className="block text-xs text-neutral-500">
              Used to flag technicians who need more hours in this
              schedule.
            </span>

            <input
              required
              type="number"
              min={0}
              max={80}
              value={form.minimum_weekly_hours}
              disabled={saving}
              onChange={(event) =>
                updateField(
                  "minimum_weekly_hours",
                  Number(event.target.value)
                )
              }
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-700">
              Linked availability request
            </span>
            <span className="block text-xs text-neutral-500">
              Optional. Linking lets you auto-generate this schedule
              from submitted availability. Leave unset to build it by
              hand.
            </span>

            <select
              value={form.campaign_id ?? ""}
              disabled={saving}
              onChange={(event) =>
                updateField(
                  "campaign_id",
                  event.target.value
                    ? Number(event.target.value)
                    : null
                )
              }
              className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
            >
              <option value="">
                No availability request — build manually
              </option>

              {availabilityRequests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-700">
              Notes
              <span className="ml-2 font-normal text-neutral-400">
                Optional
              </span>
            </span>

            <textarea
              value={form.notes ?? ""}
              disabled={saving}
              rows={3}
              placeholder="Anything else worth noting about this schedule."
              onChange={(event) =>
                updateField("notes", event.target.value)
              }
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
            />
          </label>

          <div className="flex justify-end gap-3 border-t border-neutral-200 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="min-w-36 rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
            >
              {saving ? "Creating..." : "Create Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

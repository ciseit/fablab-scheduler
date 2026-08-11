"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export type AvailabilityRequestFormData = {
  name: string;
  semester: string;
  opens_at: string;
  closes_at: string;
  minimum_weekly_hours: number;
};

type CreateAvailabilityRequestDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: AvailabilityRequestFormData) => Promise<void>;
};

const initialFormData: AvailabilityRequestFormData = {
  name: "",
  semester: "",
  opens_at: "",
  closes_at: "",
  minimum_weekly_hours: 15,
};

export default function CreateAvailabilityRequestDialog({
  open,
  onClose,
  onSave,
}: CreateAvailabilityRequestDialogProps) {
  const [formData, setFormData] =
    useState<AvailabilityRequestFormData>(initialFormData);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFormData(initialFormData);
      setError("");
      setSaving(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  function updateField(
    field: keyof AvailabilityRequestFormData,
    value: string | number
  ) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    if (
      !formData.name.trim() ||
      !formData.semester.trim() ||
      !formData.opens_at ||
      !formData.closes_at
    ) {
      setError("Please complete all required fields.");
      return;
    }

    if (
      new Date(formData.closes_at) <=
      new Date(formData.opens_at)
    ) {
      setError("Closing time must be later than opening time.");
      return;
    }

    if (formData.minimum_weekly_hours < 0) {
      setError("Minimum weekly hours cannot be negative.");
      return;
    }

    try {
      setSaving(true);
      await onSave(formData);
    } catch (saveError) {
      console.error(
        "Failed to create availability request:",
        saveError
      );

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to create availability request."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-neutral-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-neutral-950">
              Create Availability Request
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Set the collection window and minimum weekly hours.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-6 py-6">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="request-name"
                className="mb-2 block text-sm font-medium text-neutral-700"
              >
                Request name
              </label>

              <input
                id="request-name"
                type="text"
                value={formData.name}
                onChange={(event) =>
                  updateField("name", event.target.value)
                }
                placeholder="Fall 2026 Availability"
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-950"
                required
              />
            </div>

            <div>
              <label
                htmlFor="semester"
                className="mb-2 block text-sm font-medium text-neutral-700"
              >
                Semester
              </label>

              <input
                id="semester"
                type="text"
                value={formData.semester}
                onChange={(event) =>
                  updateField("semester", event.target.value)
                }
                placeholder="Fall 2026"
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-950"
                required
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="opens-at"
                  className="mb-2 block text-sm font-medium text-neutral-700"
                >
                  Opens at
                </label>

                <input
                  id="opens-at"
                  type="datetime-local"
                  value={formData.opens_at}
                  onChange={(event) =>
                    updateField("opens_at", event.target.value)
                  }
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-950"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="closes-at"
                  className="mb-2 block text-sm font-medium text-neutral-700"
                >
                  Closes at
                </label>

                <input
                  id="closes-at"
                  type="datetime-local"
                  value={formData.closes_at}
                  onChange={(event) =>
                    updateField("closes_at", event.target.value)
                  }
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-950"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="minimum-hours"
                className="mb-2 block text-sm font-medium text-neutral-700"
              >
                Minimum weekly hours
              </label>

              <input
                id="minimum-hours"
                type="number"
                min="0"
                step="1"
                value={formData.minimum_weekly_hours}
                onChange={(event) =>
                  updateField(
                    "minimum_weekly_hours",
                    Number(event.target.value)
                  )
                }
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-950"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-neutral-200 px-6 py-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
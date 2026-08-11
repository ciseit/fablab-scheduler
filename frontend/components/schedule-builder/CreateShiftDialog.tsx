"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";

import type { ShiftDay } from "@/lib/shiftApi";

export type ShiftFormData = {
  day_of_week: ShiftDay;
  start_time: string;
  end_time: string;
  required_technicians: number;
};

type CreateShiftDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: ShiftFormData) => Promise<void>;
};

const dayOptions: { value: ShiftDay; label: string }[] = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

const initialFormData: ShiftFormData = {
  day_of_week: "monday",
  start_time: "09:00",
  end_time: "17:00",
  required_technicians: 1,
};

export default function CreateShiftDialog({
  open,
  onClose,
  onSave,
}: CreateShiftDialogProps) {
  const [formData, setFormData] =
    useState<ShiftFormData>(initialFormData);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return null;
  }

  function updateField<K extends keyof ShiftFormData>(
    field: K,
    value: ShiftFormData[K]
  ) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!formData.start_time || !formData.end_time) {
      setError("Please provide a start and end time.");
      return;
    }

    if (formData.end_time <= formData.start_time) {
      setError("End time must be later than start time.");
      return;
    }

    if (formData.required_technicians < 1) {
      setError("Required technicians must be at least 1.");
      return;
    }

    setError("");
    setSaving(true);

    try {
      await onSave(formData);
    } catch (saveError) {
      console.error("Failed to create shift:", saveError);

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to create the shift."
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
        aria-labelledby="shift-dialog-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5">
          <div>
            <h2
              id="shift-dialog-title"
              className="text-xl font-semibold text-neutral-950"
            >
              Add Shift
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Define a coverage window technicians can be scheduled
              into.
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
              Day of week
            </span>

            <select
              value={formData.day_of_week}
              disabled={saving}
              onChange={(event) =>
                updateField(
                  "day_of_week",
                  event.target.value as ShiftDay
                )
              }
              className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
            >
              {dayOptions.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">
                Start time
              </span>

              <input
                required
                type="time"
                value={formData.start_time}
                disabled={saving}
                onChange={(event) =>
                  updateField("start_time", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">
                End time
              </span>

              <input
                required
                type="time"
                value={formData.end_time}
                disabled={saving}
                onChange={(event) =>
                  updateField("end_time", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-700">
              Required technicians
            </span>

            <input
              required
              type="number"
              min={1}
              max={20}
              value={formData.required_technicians}
              disabled={saving}
              onChange={(event) =>
                updateField(
                  "required_technicians",
                  Number(event.target.value)
                )
              }
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
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
              className="min-w-32 rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
            >
              {saving ? "Adding..." : "Add Shift"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

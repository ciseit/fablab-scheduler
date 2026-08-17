"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { X } from "lucide-react";

import type { Technician } from "./TechnicianRow";

export type TechnicianFormData = Omit<
  Technician,
  "id"
>;

type AddTechnicianDialogProps = {
  open: boolean;
  technician?: Technician | null;
  onClose: () => void;
  onSave: (
    technician: TechnicianFormData
  ) => void | Promise<void>;
};

const emptyForm: TechnicianFormData = {
  name: "",
  email: "",
  designation: "",
  status: "Active",
  weeklyTargetHours: 20,
  assignmentType: "",
  assignmentName: "",
};

export default function AddTechnicianDialog({
  open,
  technician,
  onClose,
  onSave,
}: AddTechnicianDialogProps) {
  const [form, setForm] =
    useState<TechnicianFormData>(emptyForm);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setError("");

    if (technician) {
      const {
        id: _technicianId,
        ...technicianData
      } = technician;

      setForm(technicianData);
      return;
    }

    setForm(emptyForm);
  }, [technician, open]);

  if (!open) {
    return null;
  }

  function updateField<
    K extends keyof TechnicianFormData
  >(
    field: K,
    value: TechnicianFormData[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setError("");
    setSaving(true);

    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        designation: form.designation.trim(),
        assignmentType:
          form.assignmentType.trim(),
        assignmentName:
          form.assignmentName.trim(),
      });
    } catch (saveError) {
      console.error(
        "Failed to save technician:",
        saveError
      );

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save the technician."
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
        aria-labelledby="technician-dialog-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5">
          <div>
            <h2
              id="technician-dialog-title"
              className="text-xl font-semibold text-neutral-950"
            >
              {technician
                ? "Edit Technician"
                : "Add Technician"}
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Manage technician details and current
              assignment.
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

        <form
          onSubmit={handleSubmit}
          className="space-y-5 p-6"
        >
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">
                Full name
              </span>

              <input
                required
                value={form.name}
                disabled={saving}
                onChange={(event) =>
                  updateField(
                    "name",
                    event.target.value
                  )
                }
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">
                Email
              </span>

              <input
                required
                type="email"
                value={form.email}
                disabled={saving}
                onChange={(event) =>
                  updateField(
                    "email",
                    event.target.value
                  )
                }
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">
                Designation
              </span>

              <input
                required
                value={form.designation}
                disabled={saving}
                onChange={(event) =>
                  updateField(
                    "designation",
                    event.target.value
                  )
                }
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">
                Status
              </span>

              <select
                value={form.status}
                disabled={saving}
                onChange={(event) =>
                  updateField(
                    "status",
                    event.target
                      .value as TechnicianFormData["status"]
                  )
                }
                className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
              >
                <option value="Active">
                  Active
                </option>

                <option value="Inactive">
                  Inactive
                </option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">
                Weekly target hours
              </span>

              <input
                required
                type="number"
                min={0}
                max={40}
                value={form.weeklyTargetHours}
                disabled={saving}
                onChange={(event) =>
                  updateField(
                    "weeklyTargetHours",
                    Number(event.target.value)
                  )
                }
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">
                Assignment type
              </span>
              <span className="block text-xs text-neutral-500">
                What kind of placement is this? A general category.
              </span>

              <input
                required
                placeholder="e.g. FABLAB, School Site, Event, Outreach, Training"
                value={form.assignmentType}
                disabled={saving}
                onChange={(event) =>
                  updateField(
                    "assignmentType",
                    event.target.value
                  )
                }
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-700">
              Assignment name
            </span>
            <span className="block text-xs text-neutral-500">
              The specific site or project name for this placement.
            </span>

            <input
              required
              placeholder="e.g. Carson High School, Robotics Workshop, Laser Lab"
              value={form.assignmentName}
              disabled={saving}
              onChange={(event) =>
                updateField(
                  "assignmentName",
                  event.target.value
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
              className="min-w-36 rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
            >
              {saving
                ? "Saving..."
                : technician
                  ? "Save Changes"
                  : "Add Technician"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
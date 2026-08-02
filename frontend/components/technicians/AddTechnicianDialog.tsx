"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import type { Technician } from "./TechnicianRow";

type TechnicianFormData = Omit<Technician, "id">;

type AddTechnicianDialogProps = {
  open: boolean;
  technician?: Technician | null;
  onClose: () => void;
  onSave: (technician: TechnicianFormData) => void;
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
  const [form, setForm] = useState<TechnicianFormData>(emptyForm);

  useEffect(() => {
    if (technician) {
      const { id: _id, ...technicianData } = technician;
      setForm(technicianData);
    } else {
      setForm(emptyForm);
    }
  }, [technician, open]);

  if (!open) {
    return null;
  }

  function updateField<K extends keyof TechnicianFormData>(
    field: K,
    value: TechnicianFormData[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-neutral-950">
              {technician ? "Edit Technician" : "Add Technician"}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Manage technician details and current assignment.
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

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">
                Full name
              </span>
              <input
                required
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400"
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
                onChange={(event) => updateField("email", event.target.value)}
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">
                Designation
              </span>
              <input
                required
                value={form.designation}
                onChange={(event) =>
                  updateField("designation", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">
                Status
              </span>
              <select
                value={form.status}
                onChange={(event) =>
                  updateField(
                    "status",
                    event.target.value as TechnicianFormData["status"]
                  )
                }
                className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 outline-none transition focus:border-neutral-400"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
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
                onChange={(event) =>
                  updateField(
                    "weeklyTargetHours",
                    Number(event.target.value)
                  )
                }
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">
                Assignment type
              </span>
              <input
                required
                placeholder="School Site, Lab, Project, Other"
                value={form.assignmentType}
                onChange={(event) =>
                  updateField("assignmentType", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-700">
              Assignment name
            </span>
            <input
              required
              placeholder="Carson High School, Laser Lab, FABLAB Scheduler..."
              value={form.assignmentName}
              onChange={(event) =>
                updateField("assignmentName", event.target.value)
              }
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400"
            />
          </label>

          <div className="flex justify-end gap-3 border-t border-neutral-200 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              {technician ? "Save Changes" : "Add Technician"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
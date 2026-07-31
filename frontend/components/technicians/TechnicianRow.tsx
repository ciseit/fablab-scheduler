import { MoreHorizontal, Pencil } from "lucide-react";

export type Technician = {
  id: number;
  name: string;
  email: string;
  designation: string;
  status: "Active" | "Inactive";
  weeklyTargetHours: number;
  assignmentType: string;
  assignmentName: string;
};

type TechnicianRowProps = {
  technician: Technician;
  onEdit: (technician: Technician) => void;
};

export default function TechnicianRow({
  technician,
  onEdit,
}: TechnicianRowProps) {
  return (
    <tr className="border-b border-neutral-200 last:border-b-0">
      <td className="px-6 py-5">
        <div>
          <p className="font-medium text-neutral-950">{technician.name}</p>
          <p className="mt-1 text-sm text-neutral-500">
            {technician.designation}
          </p>
        </div>
      </td>

      <td className="px-6 py-5">
        <p className="font-medium text-neutral-900">
          {technician.assignmentName}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          {technician.assignmentType}
        </p>
      </td>

      <td className="px-6 py-5">
        <span
          className={
            technician.status === "Active"
              ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
              : "rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600"
          }
        >
          {technician.status}
        </span>
      </td>

      <td className="px-6 py-5 text-sm text-neutral-700">
        {technician.weeklyTargetHours} hrs
      </td>

      <td className="px-6 py-5 text-sm text-neutral-600">
        {technician.email}
      </td>

      <td className="px-6 py-5">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onEdit(technician)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
            aria-label={`Edit ${technician.name}`}
          >
            <Pencil size={16} />
          </button>

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
            aria-label={`More actions for ${technician.name}`}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}
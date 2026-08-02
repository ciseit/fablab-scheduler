import TechnicianRow, {
  type Technician,
} from "./TechnicianRow";

type TechnicianTableProps = {
  technicians: Technician[];
  onEdit: (technician: Technician) => void;
  onDelete: (technician: Technician) => void;
  deletingTechnicianId?: number | null;
};

export default function TechnicianTable({
  technicians,
  onEdit,
  onDelete,
  deletingTechnicianId = null,
}: TechnicianTableProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="border-b border-neutral-200 bg-neutral-50">
            <tr>
              {[
                "Technician",
                "Current Assignment",
                "Status",
                "Weekly Hours",
                "Email",
                "Actions",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 last:text-right"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {technicians.length > 0 ? (
              technicians.map((technician) => (
                <TechnicianRow
                  key={technician.id}
                  technician={technician}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  deleting={
                    deletingTechnicianId === technician.id
                  }
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-16 text-center"
                >
                  <p className="font-medium text-neutral-900">
                    No technicians found
                  </p>

                  <p className="mt-1 text-sm text-neutral-500">
                    Try a different search term or add a technician.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
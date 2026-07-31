"use client";

import { useMemo, useState } from "react";

import AppLayout from "@/components/layout/AppLayout";
import TechnicianToolbar from "@/components/technicians/TechnicianToolbar";
import TechnicianTable from "@/components/technicians/TechnicianTable";
import AddTechnicianDialog from "@/components/technicians/AddTechnicianDialog";
import type { Technician } from "@/components/technicians/TechnicianRow";

const initialTechnicians: Technician[] = [
  {
    id: 1,
    name: "Maya Patel",
    email: "maya.patel@fablab.org",
    designation: "Student Technician",
    status: "Active",
    weeklyTargetHours: 20,
    assignmentType: "School Site",
    assignmentName: "Carson High School",
  },
  {
    id: 2,
    name: "Jordan Lee",
    email: "jordan.lee@fablab.org",
    designation: "Lab Technician",
    status: "Active",
    weeklyTargetHours: 24,
    assignmentType: "Lab",
    assignmentName: "Laser Lab",
  },
  {
    id: 3,
    name: "Alex Kim",
    email: "alex.kim@fablab.org",
    designation: "Project Assistant",
    status: "Active",
    weeklyTargetHours: 18,
    assignmentType: "Project",
    assignmentName: "FABLAB Scheduler",
  },
  {
    id: 4,
    name: "Sarah Johnson",
    email: "sarah.johnson@fablab.org",
    designation: "Student Technician",
    status: "Inactive",
    weeklyTargetHours: 16,
    assignmentType: "Other",
    assignmentName: "Orientation Team",
  },
];

export default function TechniciansPage() {
  const [technicians, setTechnicians] =
    useState<Technician[]>(initialTechnicians);

  const [searchTerm, setSearchTerm] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);

  const [selectedTechnician, setSelectedTechnician] =
    useState<Technician | null>(null);

  const filteredTechnicians = useMemo(() => {
    if (!searchTerm.trim()) return technicians;

    return technicians.filter((technician) =>
      [
        technician.name,
        technician.email,
        technician.designation,
        technician.assignmentType,
        technician.assignmentName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, technicians]);

  function openAddDialog() {
    setSelectedTechnician(null);
    setDialogOpen(true);
  }

  function openEditDialog(technician: Technician) {
    setSelectedTechnician(technician);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setSelectedTechnician(null);
  }

  function saveTechnician(data: Omit<Technician, "id">) {
    if (selectedTechnician) {
      setTechnicians((current) =>
        current.map((technician) =>
          technician.id === selectedTechnician.id
            ? {
                ...data,
                id: selectedTechnician.id,
              }
            : technician
        )
      );
    } else {
      setTechnicians((current) => [
        ...current,
        {
          ...data,
          id: current.length + 1,
        },
      ]);
    }

    closeDialog();
  }

  return (
    <AppLayout>
      <div className="space-y-8">

        <section>
          <p className="text-sm font-medium text-neutral-500">
            Technicians
          </p>

          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Manage Technicians
          </h1>

          <p className="mt-3 text-neutral-600">
            Add technicians, update assignments, and manage weekly scheduling.
          </p>
        </section>

        <TechnicianToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAddTechnician={openAddDialog}
        />

        <TechnicianTable
          technicians={filteredTechnicians}
          onEdit={openEditDialog}
        />

        <AddTechnicianDialog
          open={dialogOpen}
          technician={selectedTechnician}
          onClose={closeDialog}
          onSave={saveTechnician}
        />

      </div>
    </AppLayout>
  );
}
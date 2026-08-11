"use client";

import { useEffect, useMemo, useState } from "react";

import AppLayout from "@/components/layout/AppLayout";
import TechnicianToolbar from "@/components/technicians/TechnicianToolbar";
import TechnicianTable from "@/components/technicians/TechnicianTable";
import AddTechnicianDialog, {
  type TechnicianFormData,
} from "@/components/technicians/AddTechnicianDialog";

import {
  createTechnician,
  deleteTechnician,
  getTechnicians,
  updateTechnician,
} from "@/lib/technicianApi";

import type { Technician } from "@/components/technicians/TechnicianRow";

type ApiTechnician = {
  id: number;
  name: string;
  email: string;
  designation: string;
  status: string;
  weekly_target_hours: number;
  notes?: string | null;
};

function mapApiTechnician(
  apiTechnician: ApiTechnician
): Technician {
  return {
    id: apiTechnician.id,
    name: apiTechnician.name,
    email: apiTechnician.email,
    designation: apiTechnician.designation,
    status:
      apiTechnician.status.toLowerCase() === "active"
        ? "Active"
        : "Inactive",
    weeklyTargetHours: apiTechnician.weekly_target_hours,
    assignmentType: "Not assigned",
    assignmentName:
      apiTechnician.notes || "No current assignment",
  };
}

function mapTechnicianForApi(
  data: TechnicianFormData
) {
  return {
    name: data.name,
    email: data.email,
    designation: data.designation,
    status: data.status.toLowerCase(),
    weekly_target_hours: data.weeklyTargetHours,
    notes: data.assignmentName || null,
  };
}

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState<
    Technician[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [
    deletingTechnicianId,
    setDeletingTechnicianId,
  ] = useState<number | null>(null);

  const [
    selectedTechnician,
    setSelectedTechnician,
  ] = useState<Technician | null>(null);

  async function loadTechnicians() {
    setLoading(true);
    setError("");

    try {
      const data =
        (await getTechnicians()) as ApiTechnician[];

      setTechnicians(data.map(mapApiTechnician));
    } catch (loadError) {
      console.error(
        "Failed to load technicians:",
        loadError
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load technicians."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTechnicians();
  }, []);

  const filteredTechnicians = useMemo(() => {
    const normalizedSearch =
      searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return technicians;
    }

    return technicians.filter((technician) =>
      [
        technician.name,
        technician.email,
        technician.designation,
        technician.status,
        technician.assignmentName,
        technician.assignmentType,
      ].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      )
    );
  }, [technicians, searchTerm]);

  function showSuccess(message: string) {
    setSuccessMessage(message);

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 2500);
  }

  function openAddDialog() {
    setSelectedTechnician(null);
    setDialogOpen(true);
  }

  function openEditDialog(
    technician: Technician
  ) {
    setSelectedTechnician(technician);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setSelectedTechnician(null);
  }

  async function saveTechnician(
    data: TechnicianFormData
  ) {
    setError("");

    try {
      const apiPayload =
        mapTechnicianForApi(data);

      if (selectedTechnician) {
        await updateTechnician(
          selectedTechnician.id,
          apiPayload
        );

        showSuccess("Technician updated.");
      } else {
        await createTechnician(apiPayload);
        showSuccess("Technician added.");
      }

      closeDialog();
      await loadTechnicians();
    } catch (saveError) {
      console.error(
        "Failed to save technician:",
        saveError
      );

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save technician."
      );
    }
  }

  async function handleDeleteTechnician(
    technician: Technician
  ) {
    const confirmed = window.confirm(
      `Delete ${technician.name}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setDeletingTechnicianId(technician.id);

    try {
      await deleteTechnician(technician.id);

      setTechnicians((currentTechnicians) =>
        currentTechnicians.filter(
          (currentTechnician) =>
            currentTechnician.id !== technician.id
        )
      );

      showSuccess("Technician deleted.");
    } catch (deleteError) {
      console.error(
        "Failed to delete technician:",
        deleteError
      );

      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete technician."
      );
    } finally {
      setDeletingTechnicianId(null);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <section>
          <p className="text-sm font-medium text-neutral-500">
            Technicians
          </p>

          <h1 className="mt-2 text-4xl font-semibold">
            Manage Technicians
          </h1>

          <p className="mt-3 text-neutral-600">
            Add technicians, update assignments, and
            manage weekly scheduling.
          </p>
        </section>

        <TechnicianToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAddTechnician={openAddDialog}
        />

        {successMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center">
            Loading technicians...
          </div>
        ) : (
          <TechnicianTable
            technicians={filteredTechnicians}
            onEdit={openEditDialog}
            onDelete={handleDeleteTechnician}
            deletingTechnicianId={
              deletingTechnicianId
            }
          />
        )}

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
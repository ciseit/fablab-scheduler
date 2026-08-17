"use client";

import { useEffect, useMemo, useState } from "react";

import AppLayout from "@/components/layout/AppLayout";
import AvailabilityRequestToolbar from "@/components/availability-requests/AvailabilityRequestToolbar";
import AvailabilityRequestCard, {
  type AvailabilityRequest,
} from "@/components/availability-requests/AvailabilityRequestCard";
import CreateAvailabilityRequestDialog, {
  type AvailabilityRequestFormData,
} from "@/components/availability-requests/CreateAvailabilityRequestDialog";
import SubmissionRosterDialog from "@/components/availability-requests/SubmissionRosterDialog";

import {
  createAvailabilityRequest,
  deleteAvailabilityRequest,
  getAvailabilityRequests,
} from "@/lib/availabilityRequestApi";

export default function AvailabilityRequestsPage() {
  const [requests, setRequests] = useState<AvailabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [copiedRequestId, setCopiedRequestId] =
    useState<number | null>(null);

  const [deletingRequestId, setDeletingRequestId] =
    useState<number | null>(null);

  const [rosterRequest, setRosterRequest] =
    useState<AvailabilityRequest | null>(null);

  async function loadRequests() {
    setLoading(true);
    setError("");

    try {
      const data =
        (await getAvailabilityRequests()) as AvailabilityRequest[];

      setRequests(data);
    } catch (loadError) {
      console.error(
        "Failed to load availability requests:",
        loadError
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load availability requests."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return requests;
    }

    return requests.filter((request) =>
      [
        request.name,
        request.semester ?? "",
        request.status,
        request.opens_at,
        request.closes_at,
      ].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      )
    );
  }, [requests, searchTerm]);

  function showSuccess(message: string) {
    setSuccessMessage(message);

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 2500);
  }

  async function handleCreateRequest(
    data: AvailabilityRequestFormData
  ) {
    setError("");

    try {
      await createAvailabilityRequest(data);

      setDialogOpen(false);
      showSuccess("Availability request created.");

      await loadRequests();
    } catch (createError) {
      console.error(
        "Failed to create availability request:",
        createError
      );

      throw createError;
    }
  }

  function buildPublicUrl(request: AvailabilityRequest) {
    return `${window.location.origin}/submit/${encodeURIComponent(
      request.public_token
    )}`;
  }

  async function handleCopyLink(
    request: AvailabilityRequest
  ) {
    setError("");

    try {
      await navigator.clipboard.writeText(
        buildPublicUrl(request)
      );

      setCopiedRequestId(request.id);

      window.setTimeout(() => {
        setCopiedRequestId((currentId) =>
          currentId === request.id ? null : currentId
        );
      }, 2000);
    } catch (copyError) {
      console.error(
        "Failed to copy availability request link:",
        copyError
      );

      setError("Unable to copy the public link.");
    }
  }

  function handleOpenPublicForm(
    request: AvailabilityRequest
  ) {
    window.open(
      buildPublicUrl(request),
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function handleDeleteRequest(
    request: AvailabilityRequest
  ) {
    const confirmed = window.confirm(
      `Delete "${request.name}"? This cannot be undone. If technicians ` +
        `have already submitted availability, or shifts or a schedule ` +
        `have been created for this request, deletion will be blocked ` +
        `to protect that data.`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setDeletingRequestId(request.id);

    try {
      await deleteAvailabilityRequest(request.id);

      setRequests((current) =>
        current.filter(
          (existingRequest) => existingRequest.id !== request.id
        )
      );

      showSuccess("Availability request deleted.");
    } catch (deleteError) {
      console.error(
        "Failed to delete availability request:",
        deleteError
      );

      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete this availability request."
      );
    } finally {
      setDeletingRequestId(null);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <section>
          <p className="text-sm font-medium text-neutral-500">
            Availability Requests
          </p>

          <h1 className="mt-2 text-4xl font-semibold">
            Manage Availability Requests
          </h1>

          <p className="mt-3 text-neutral-600">
            Create requests, monitor submissions, and generate
            schedules.
          </p>
        </section>

        <AvailabilityRequestToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onCreateRequest={() => setDialogOpen(true)}
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
            Loading availability requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center">
            <p className="font-medium text-neutral-900">
              No availability requests found
            </p>

            <p className="mt-2 text-sm text-neutral-500">
              Create a new request or try a different search term.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredRequests.map((request) => (
              <AvailabilityRequestCard
                key={request.id}
                request={request}
                onCopyLink={handleCopyLink}
                onOpenPublicForm={handleOpenPublicForm}
                onDelete={handleDeleteRequest}
                onViewSubmissions={setRosterRequest}
                copied={copiedRequestId === request.id}
                deleting={deletingRequestId === request.id}
              />
            ))}
          </div>
        )}

        <CreateAvailabilityRequestDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSave={handleCreateRequest}
        />

        <SubmissionRosterDialog
          open={rosterRequest !== null}
          requestId={rosterRequest?.id ?? null}
          requestName={rosterRequest?.name}
          onClose={() => setRosterRequest(null)}
        />
      </div>
    </AppLayout>
  );
}
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
  ApiError,
  archiveAvailabilityRequest,
  createAvailabilityRequest,
  deleteAvailabilityRequest,
  getAvailabilityRequests,
  updateAvailabilityRequest,
} from "@/lib/availabilityRequestApi";

export default function AvailabilityRequestsPage() {
  const [requests, setRequests] = useState<AvailabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [copiedRequestId, setCopiedRequestId] =
    useState<number | null>(null);

  const [deletingRequestId, setDeletingRequestId] =
    useState<number | null>(null);

  const [archivingRequestId, setArchivingRequestId] =
    useState<number | null>(null);

  const [rosterRequest, setRosterRequest] =
    useState<AvailabilityRequest | null>(null);

  const [editingRequest, setEditingRequest] =
    useState<AvailabilityRequest | null>(null);

  // Set when a delete attempt is blocked by the backend (409 -- the
  // request has submissions/schedules) so we can show a friendly,
  // in-app explanation with an Archive fallback instead of letting the
  // error bubble up as an uncaught exception.
  const [blockedDeleteRequest, setBlockedDeleteRequest] = useState<{
    request: AvailabilityRequest;
    message: string;
  } | null>(null);

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
    const visibleRequests = showArchived
      ? requests
      : requests.filter((request) => request.status !== "archived");

    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return visibleRequests;
    }

    return visibleRequests.filter((request) =>
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
  }, [requests, searchTerm, showArchived]);

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

  async function handleUpdateRequest(
    data: AvailabilityRequestFormData
  ) {
    if (!editingRequest) {
      return;
    }

    setError("");

    try {
      await updateAvailabilityRequest(editingRequest.id, data);

      setEditingRequest(null);
      showSuccess("Availability request updated.");

      await loadRequests();
    } catch (updateError) {
      console.error(
        "Failed to update availability request:",
        updateError
      );

      throw updateError;
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
    setBlockedDeleteRequest(null);
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

      // A 409 means the backend is correctly protecting technician
      // submissions or linked schedules -- that's expected, recoverable
      // state, not a crash. Show a friendly explanation with an Archive
      // fallback instead of the generic error banner.
      if (
        deleteError instanceof ApiError &&
        deleteError.status === 409
      ) {
        setBlockedDeleteRequest({
          request,
          message: deleteError.message,
        });
      } else {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Unable to delete this availability request."
        );
      }
    } finally {
      setDeletingRequestId(null);
    }
  }

  async function handleArchiveRequest(
    request: AvailabilityRequest
  ) {
    setError("");
    setArchivingRequestId(request.id);

    try {
      const updated =
        (await archiveAvailabilityRequest(
          request.id
        )) as AvailabilityRequest;

      setRequests((current) =>
        current.map((existingRequest) =>
          existingRequest.id === request.id
            ? { ...existingRequest, ...updated }
            : existingRequest
        )
      );

      setBlockedDeleteRequest((current) =>
        current?.request.id === request.id ? null : current
      );

      showSuccess(
        `"${request.name}" archived. Its submissions and schedules ` +
          `are preserved.`
      );
    } catch (archiveError) {
      console.error(
        "Failed to archive availability request:",
        archiveError
      );

      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Unable to archive this availability request."
      );
    } finally {
      setArchivingRequestId(null);
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
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
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

        {blockedDeleteRequest && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium">
              &ldquo;{blockedDeleteRequest.request.name}&rdquo; can&apos;t
              be deleted yet.
            </p>

            <p className="mt-1">{blockedDeleteRequest.message}</p>

            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  handleArchiveRequest(blockedDeleteRequest.request)
                }
                disabled={
                  archivingRequestId ===
                  blockedDeleteRequest.request.id
                }
                className="rounded-lg bg-amber-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {archivingRequestId === blockedDeleteRequest.request.id
                  ? "Archiving..."
                  : "Archive instead"}
              </button>

              <button
                type="button"
                onClick={() => setBlockedDeleteRequest(null)}
                className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
              >
                Dismiss
              </button>
            </div>
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
                onEdit={setEditingRequest}
                onDelete={handleDeleteRequest}
                onArchive={handleArchiveRequest}
                onViewSubmissions={setRosterRequest}
                copied={copiedRequestId === request.id}
                deleting={deletingRequestId === request.id}
                archiving={archivingRequestId === request.id}
              />
            ))}
          </div>
        )}

        <CreateAvailabilityRequestDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSave={handleCreateRequest}
        />

        <CreateAvailabilityRequestDialog
          open={editingRequest !== null}
          onClose={() => setEditingRequest(null)}
          onSave={handleUpdateRequest}
          initialData={
            editingRequest
              ? {
                  name: editingRequest.name,
                  semester: editingRequest.semester ?? "",
                  opens_at: editingRequest.opens_at,
                  closes_at: editingRequest.closes_at,
                  minimum_weekly_hours:
                    editingRequest.minimum_weekly_hours ?? 15,
                }
              : null
          }
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
"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
} from "lucide-react";
import { useParams } from "next/navigation";

import {
  getAvailabilityRequestByToken,
} from "@/lib/availabilityRequestApi";
import { formatUtcForDisplay } from "@/lib/datetimeUtils";

import {
  submitPublicAvailability,
  type AvailabilityDay,
  type AvailabilityType,
  type PublicAvailabilityBlock,
} from "@/lib/availabilityApi";

type AvailabilityRequest = {
  id: number;
  name: string;
  semester: string;
  opens_at: string;
  closes_at: string;
  minimum_weekly_hours: number;
  public_token: string;
  status: string;
  is_accepting_submissions: boolean;
  has_opened: boolean;
};

type DayAvailability = {
  enabled: boolean;
  start_time: string;
  end_time: string;
  availability_type: AvailabilityType;
};

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type DayName = (typeof days)[number];

const initialAvailability: Record<
  DayName,
  DayAvailability
> = {
  Monday: {
    enabled: true,
    start_time: "09:00",
    end_time: "17:00",
    availability_type: "available",
  },
  Tuesday: {
    enabled: true,
    start_time: "09:00",
    end_time: "17:00",
    availability_type: "available",
  },
  Wednesday: {
    enabled: true,
    start_time: "09:00",
    end_time: "17:00",
    availability_type: "available",
  },
  Thursday: {
    enabled: true,
    start_time: "09:00",
    end_time: "17:00",
    availability_type: "available",
  },
  Friday: {
    enabled: true,
    start_time: "09:00",
    end_time: "17:00",
    availability_type: "available",
  },
  Saturday: {
    enabled: false,
    start_time: "09:00",
    end_time: "17:00",
    availability_type: "available",
  },
  Sunday: {
    enabled: false,
    start_time: "09:00",
    end_time: "17:00",
    availability_type: "available",
  },
};

function formatDate(dateValue: string) {
  return formatUtcForDisplay(dateValue);
}

function normalizeTime(timeValue: string) {
  if (!timeValue) {
    return "";
  }

  return timeValue.length === 5
    ? `${timeValue}:00`
    : timeValue;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function AvailabilitySubmissionPage() {
  const params = useParams<{ token: string }>();

  const token =
    typeof params.token === "string"
      ? params.token
      : "";

  const [request, setRequest] =
    useState<AvailabilityRequest | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] =
    useState(false);

  const [loadError, setLoadError] = useState("");
  const [submissionError, setSubmissionError] =
    useState("");

  const [submitted, setSubmitted] =
    useState(false);

  const [
    submittedBlockCount,
    setSubmittedBlockCount,
  ] = useState(0);

  const [technicianName, setTechnicianName] =
    useState("");

  const [
    technicianEmail,
    setTechnicianEmail,
  ] = useState("");

  const [notes, setNotes] = useState("");

  const [availability, setAvailability] =
    useState<
      Record<DayName, DayAvailability>
    >(initialAvailability);

  useEffect(() => {
    async function loadRequest() {
      setLoading(true);
      setLoadError("");

      try {
        const data =
          (await getAvailabilityRequestByToken(
            token
          )) as AvailabilityRequest;

        setRequest(data);
      } catch (error) {
        console.error(
          "Failed to load availability request:",
          error
        );

        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load this availability request."
        );
      } finally {
        setLoading(false);
      }
    }

    if (!token) {
      setLoadError(
        "This availability link is missing its request token."
      );
      setLoading(false);
      return;
    }

    void loadRequest();
  }, [token]);

  const selectedDays = useMemo(
    () =>
      days.filter(
        (day) => availability[day].enabled
      ),
    [availability]
  );

  // Authoritative: computed backend-side from opens_at/closes_at (the
  // same checks the submission endpoint itself enforces), so these can
  // never drift out of sync with what the server will actually accept.
  const requestNotOpenYet = useMemo(
    () => request !== null && !request.has_opened,
    [request]
  );

  const requestIsClosed = useMemo(
    () =>
      request !== null &&
      request.has_opened &&
      !request.is_accepting_submissions,
    [request]
  );

  const submissionsDisabled = requestNotOpenYet || requestIsClosed;

  function updateDay(
    day: DayName,
    updates: Partial<DayAvailability>
  ) {
    setAvailability((current) => ({
      ...current,
      [day]: {
        ...current[day],
        ...updates,
      },
    }));

    setSubmissionError("");
  }

  function validateForm() {
    if (!technicianName.trim()) {
      return "Please enter your full name.";
    }

    if (!technicianEmail.trim()) {
      return "Please enter your email address.";
    }

    if (
      !isValidEmail(technicianEmail.trim())
    ) {
      return "Please enter a valid email address.";
    }

    if (selectedDays.length === 0) {
      return "Please select at least one available day.";
    }

    for (const day of selectedDays) {
      const entry = availability[day];

      if (
        !entry.start_time ||
        !entry.end_time
      ) {
        return `Please enter both a start and end time for ${day}.`;
      }

      if (
        entry.end_time <= entry.start_time
      ) {
        return `The end time for ${day} must be later than the start time.`;
      }
    }

    return "";
  }

  function buildAvailabilityBlocks(): PublicAvailabilityBlock[] {
    return selectedDays.map((day) => {
      const entry = availability[day];

      return {
        day_of_week:
          day.toLowerCase() as AvailabilityDay,
        start_time: normalizeTime(
          entry.start_time
        ),
        end_time: normalizeTime(
          entry.end_time
        ),
        availability_type:
          entry.availability_type,
      };
    });
  }

  async function submitAvailability(
    replaceExisting: boolean
  ) {
    const availabilityBlocks =
      buildAvailabilityBlocks();

    setSubmitting(true);

    try {
      const savedAvailability =
        await submitPublicAvailability(token, {
          email: technicianEmail
            .trim()
            .toLowerCase(),
          availability_blocks:
            availabilityBlocks,
          replace_existing: replaceExisting,
        });

      setSubmittedBlockCount(
        savedAvailability.length
      );

      setSubmitted(true);
    } catch (error) {
      console.error(
        "Failed to submit availability:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unable to submit availability. Please try again.";

      const normalizedMessage =
        message.toLowerCase();

      if (
        normalizedMessage.includes(
          "technician not found"
        )
      ) {
        setSubmissionError(
          "We could not find a technician matching this email. Please use the same email registered by your FABLAB administrator."
        );
      } else if (
        normalizedMessage.includes(
          "already submitted availability"
        )
      ) {
        const confirmedReplace = window.confirm(
          "You've already submitted availability for this request. " +
            "Submitting again will replace your previous answers with " +
            "what you've entered now. Continue?"
        );

        if (confirmedReplace) {
          await submitAvailability(true);
          return;
        }

        setSubmissionError(
          "Your previous submission was kept unchanged."
        );
      } else if (
        normalizedMessage.includes("duplicate")
      ) {
        setSubmissionError(
          "This form has the same day entered more than once. Please review your entries and try again."
        );
      } else if (
        normalizedMessage.includes(
          "availability request not found"
        )
      ) {
        setSubmissionError(
          "This availability request is no longer available. Please ask your FABLAB administrator for a new link."
        );
      } else {
        setSubmissionError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      submitting ||
      submissionsDisabled
    ) {
      return;
    }

    setSubmissionError("");

    const validationError = validateForm();

    if (validationError) {
      setSubmissionError(validationError);
      return;
    }

    await submitAvailability(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white px-8 py-10 text-center shadow-sm">
          <Loader2
            size={28}
            className="mx-auto animate-spin text-neutral-600"
          />

          <p className="mt-4 font-medium text-neutral-900">
            Loading availability request...
          </p>
        </div>
      </main>
    );
  }

  if (loadError || !request) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertCircle size={24} />
          </div>

          <h1 className="mt-5 text-2xl font-semibold text-neutral-950">
            Availability request unavailable
          </h1>

          <p className="mt-3 text-sm text-red-700">
            {loadError ||
              "Unable to load this availability request."}
          </p>
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <div className="w-full max-w-xl rounded-3xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={28} />
          </div>

          <p className="mt-6 text-sm font-medium text-neutral-500">
            FABLAB Smart Scheduler
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-neutral-950">
            Availability submitted
          </h1>

          <p className="mt-3 text-neutral-600">
            Thank you,{" "}
            {technicianName.trim()}. Your
            availability has been recorded for{" "}
            <span className="font-medium text-neutral-900">
              {request.name}
            </span>
            .
          </p>

          <p className="mt-4 text-sm text-neutral-500">
            {submittedBlockCount}{" "}
            {submittedBlockCount === 1
              ? "availability block was"
              : "availability blocks were"}{" "}
            saved successfully.
          </p>

          {notes.trim() && (
            <p className="mt-4 text-xs text-neutral-400">
              Notes are not stored by the
              current backend yet.
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm"
      >
        <section className="border-b border-neutral-200 px-6 py-8 sm:px-10">
          <p className="text-sm font-medium text-neutral-500">
            FABLAB Smart Scheduler
          </p>

          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-950">
            {request.name}
          </h1>

          <p className="mt-3 text-neutral-600">
            {request.semester}
          </p>

          <div className="mt-5 flex items-center gap-2 text-sm text-neutral-600">
            <Clock3 size={17} />

            <span>
              Submit before{" "}
              {formatDate(
                request.closes_at
              )}
            </span>
          </div>

          <p className="mt-4 text-sm text-neutral-500">
            Minimum weekly commitment:{" "}
            {
              request.minimum_weekly_hours
            }{" "}
            hours
          </p>
        </section>

        <section className="space-y-8 px-6 py-8 sm:px-10">
          {requestNotOpenYet && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <p>
                This availability request is not
                open yet. Check back after it
                opens.
              </p>
            </div>
          )}

          {requestIsClosed && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <p>
                This availability request is
                closed and is no longer accepting
                submissions.
              </p>
            </div>
          )}

          {submissionError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700"
            >
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <p>{submissionError}</p>
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="technician-name"
                className="mb-2 block text-sm font-medium text-neutral-700"
              >
                Full name
              </label>

              <input
                id="technician-name"
                value={technicianName}
                onChange={(event) => {
                  setTechnicianName(
                    event.target.value
                  );
                  setSubmissionError("");
                }}
                placeholder="Your full name"
                disabled={
                  submitting ||
                  submissionsDisabled
                }
                autoComplete="name"
                className="h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-neutral-950 placeholder:text-neutral-400 outline-none transition focus:border-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
              />
            </div>

            <div>
              <label
                htmlFor="technician-email"
                className="mb-2 block text-sm font-medium text-neutral-700"
              >
                Email
              </label>

              <input
                id="technician-email"
                type="email"
                value={technicianEmail}
                onChange={(event) => {
                  setTechnicianEmail(
                    event.target.value
                  );
                  setSubmissionError("");
                }}
                placeholder="you@example.com"
                disabled={
                  submitting ||
                  submissionsDisabled
                }
                autoComplete="email"
                className="h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-neutral-950 placeholder:text-neutral-400 outline-none transition focus:border-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
              />
            </div>
          </div>

          <div className="space-y-5">
            {days.map((day) => {
              const entry =
                availability[day];

              return (
                <article
                  key={day}
                  className="rounded-2xl border border-neutral-200 p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-lg font-semibold text-neutral-950">
                      {day}
                    </h2>

                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                      <input
                        type="checkbox"
                        checked={
                          entry.enabled
                        }
                        disabled={
                          submitting ||
                          submissionsDisabled
                        }
                        onChange={(event) =>
                          updateDay(day, {
                            enabled:
                              event.target
                                .checked,
                          })
                        }
                        className="h-4 w-4 rounded"
                      />

                      Available
                    </label>
                  </div>

                  {entry.enabled && (
                    <div className="mt-5 grid gap-5 md:grid-cols-3">
                      <div>
                        <label
                          htmlFor={`${day}-start-time`}
                          className="mb-2 block text-sm font-medium text-neutral-700"
                        >
                          Start time
                        </label>

                        <input
                          id={`${day}-start-time`}
                          type="time"
                          value={
                            entry.start_time
                          }
                          disabled={
                            submitting ||
                            submissionsDisabled
                          }
                          onChange={(event) =>
                            updateDay(day, {
                              start_time:
                                event.target
                                  .value,
                            })
                          }
                          className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-neutral-950 outline-none transition focus:border-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`${day}-end-time`}
                          className="mb-2 block text-sm font-medium text-neutral-700"
                        >
                          End time
                        </label>

                        <input
                          id={`${day}-end-time`}
                          type="time"
                          value={
                            entry.end_time
                          }
                          disabled={
                            submitting ||
                            submissionsDisabled
                          }
                          onChange={(event) =>
                            updateDay(day, {
                              end_time:
                                event.target
                                  .value,
                            })
                          }
                          className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-neutral-950 outline-none transition focus:border-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`${day}-availability-type`}
                          className="mb-2 block text-sm font-medium text-neutral-700"
                        >
                          Availability type
                        </label>

                        <select
                          id={`${day}-availability-type`}
                          value={
                            entry.availability_type
                          }
                          disabled={
                            submitting ||
                            submissionsDisabled
                          }
                          onChange={(event) =>
                            updateDay(day, {
                              availability_type:
                                event.target
                                  .value as AvailabilityType,
                            })
                          }
                          className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-neutral-950 outline-none transition focus:border-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
                        >
                          <option value="preferred">
                            Preferred
                          </option>

                          <option value="available">
                            Available
                          </option>

                          <option value="backup">
                            Backup
                          </option>

                          <option value="restricted">
                            Restricted
                          </option>
                        </select>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div>
            <label
              htmlFor="notes"
              className="mb-2 block text-sm font-medium text-neutral-700"
            >
              Notes
              <span className="ml-2 font-normal text-neutral-400">
                Optional
              </span>
            </label>

            <textarea
              id="notes"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              disabled={
                submitting ||
                submissionsDisabled
              }
              placeholder="Add any scheduling notes or restrictions."
              rows={4}
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none transition focus:border-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
            />

            <p className="mt-2 text-xs text-neutral-400">
              Notes are currently for your
              reference during this session and
              are not yet stored by the backend.
            </p>
          </div>
        </section>

        <div className="flex justify-end border-t border-neutral-200 px-6 py-5 sm:px-10">
          <button
            type="submit"
            disabled={
              submitting ||
              submissionsDisabled
            }
            className="flex min-w-48 items-center justify-center gap-2 rounded-xl bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {submitting ? (
              <>
                <Loader2
                  size={17}
                  className="animate-spin"
                />
                Submitting...
              </>
            ) : (
              "Submit Availability"
            )}
          </button>
        </div>
      </form>
    </main>
  );
}
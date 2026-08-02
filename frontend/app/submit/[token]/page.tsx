"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3 } from "lucide-react";
import { useParams } from "next/navigation";

import {
  getAvailabilityRequestByToken,
} from "@/lib/availabilityRequestApi";

type AvailabilityRequest = {
  id: number;
  name: string;
  semester: string;
  opens_at: string;
  closes_at: string;
  minimum_weekly_hours: number;
  public_token: string;
  status: string;
};

type AvailabilityType =
  | "preferred"
  | "available"
  | "backup"
  | "restricted";

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
] as const;

const initialAvailability: Record<
  (typeof days)[number],
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
};

function formatDate(dateValue: string) {
  if (!dateValue) {
    return "Not specified";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function AvailabilitySubmissionPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [request, setRequest] =
    useState<AvailabilityRequest | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [technicianName, setTechnicianName] = useState("");
  const [technicianEmail, setTechnicianEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [availability, setAvailability] =
    useState(initialAvailability);

  useEffect(() => {
    async function loadRequest() {
      setLoading(true);
      setError("");

      try {
        const data =
          (await getAvailabilityRequestByToken(
            token
          )) as AvailabilityRequest;

        setRequest(data);
      } catch (loadError) {
        console.error(
          "Failed to load availability request:",
          loadError
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load this availability request."
        );
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      void loadRequest();
    }
  }, [token]);

  function updateDay(
    day: (typeof days)[number],
    updates: Partial<DayAvailability>
  ) {
    setAvailability((current) => ({
      ...current,
      [day]: {
        ...current[day],
        ...updates,
      },
    }));
  }

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    if (
      !technicianName.trim() ||
      !technicianEmail.trim()
    ) {
      setError(
        "Please enter your name and email address."
      );
      return;
    }

    const selectedDays = days.filter(
      (day) => availability[day].enabled
    );

    if (selectedDays.length === 0) {
      setError(
        "Please select at least one available day."
      );
      return;
    }

    const invalidDay = selectedDays.find((day) => {
      const entry = availability[day];

      return (
        !entry.start_time ||
        !entry.end_time ||
        entry.end_time <= entry.start_time
      );
    });

    if (invalidDay) {
      setError(
        `Please enter a valid time range for ${invalidDay}.`
      );
      return;
    }

    console.log("Availability submission payload:", {
      public_token: token,
      technician_name: technicianName,
      technician_email: technicianEmail,
      notes,
      availability: selectedDays.map((day) => ({
        day_of_week: day.toLowerCase(),
        start_time: availability[day].start_time,
        end_time: availability[day].end_time,
        availability_type:
          availability[day].availability_type,
      })),
    });

    setSubmitted(true);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <div className="rounded-2xl border border-neutral-200 bg-white px-8 py-10 text-center shadow-sm">
          Loading availability request...
        </div>
      </main>
    );
  }

  if (error && !request) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-neutral-950">
            Availability request unavailable
          </h1>

          <p className="mt-3 text-sm text-red-700">
            {error}
          </p>
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <div className="w-full max-w-xl rounded-3xl bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={28} />
          </div>

          <h1 className="mt-6 text-3xl font-semibold text-neutral-950">
            Availability submitted
          </h1>

          <p className="mt-3 text-neutral-600">
            Thank you, {technicianName}. Your availability
            has been recorded for {request?.name}.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-white shadow-sm"
      >
        <section className="border-b border-neutral-200 px-6 py-8 sm:px-10">
          <p className="text-sm font-medium text-neutral-500">
            FABLAB Smart Scheduler
          </p>

          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-950">
            {request?.name}
          </h1>

          <p className="mt-3 text-neutral-600">
            {request?.semester}
          </p>

          <div className="mt-5 flex items-center gap-2 text-sm text-neutral-600">
            <Clock3 size={17} />

            <span>
              Submit before{" "}
              {request
                ? formatDate(request.closes_at)
                : "the deadline"}
            </span>
          </div>

          {request && (
            <p className="mt-4 text-sm text-neutral-500">
              Minimum weekly commitment:{" "}
              {request.minimum_weekly_hours} hours
            </p>
          )}
        </section>

        <section className="space-y-8 px-6 py-8 sm:px-10">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
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
                onChange={(event) =>
                  setTechnicianName(event.target.value)
                }
                placeholder="Your full name"
                className="h-12 w-full rounded-xl border border-neutral-300 px-4 outline-none transition focus:border-neutral-950"
                required
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
                onChange={(event) =>
                  setTechnicianEmail(event.target.value)
                }
                placeholder="you@example.com"
                className="h-12 w-full rounded-xl border border-neutral-300 px-4 outline-none transition focus:border-neutral-950"
                required
              />
            </div>
          </div>

          <div className="space-y-5">
            {days.map((day) => {
              const entry = availability[day];

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
                        checked={entry.enabled}
                        onChange={(event) =>
                          updateDay(day, {
                            enabled: event.target.checked,
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
                        <label className="mb-2 block text-sm font-medium text-neutral-700">
                          Start time
                        </label>

                        <input
                          type="time"
                          value={entry.start_time}
                          onChange={(event) =>
                            updateDay(day, {
                              start_time:
                                event.target.value,
                            })
                          }
                          className="h-11 w-full rounded-xl border border-neutral-300 px-3 outline-none transition focus:border-neutral-950"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-700">
                          End time
                        </label>

                        <input
                          type="time"
                          value={entry.end_time}
                          onChange={(event) =>
                            updateDay(day, {
                              end_time:
                                event.target.value,
                            })
                          }
                          className="h-11 w-full rounded-xl border border-neutral-300 px-3 outline-none transition focus:border-neutral-950"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-700">
                          Availability type
                        </label>

                        <select
                          value={
                            entry.availability_type
                          }
                          onChange={(event) =>
                            updateDay(day, {
                              availability_type:
                                event.target
                                  .value as AvailabilityType,
                            })
                          }
                          className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 outline-none transition focus:border-neutral-950"
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
            </label>

            <textarea
              id="notes"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Add any scheduling notes or restrictions."
              rows={4}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-950"
            />
          </div>
        </section>

        <div className="flex justify-end border-t border-neutral-200 px-6 py-5 sm:px-10">
          <button
            type="submit"
            className="rounded-xl bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            Submit Availability
          </button>
        </div>
      </form>
    </main>
  );
}
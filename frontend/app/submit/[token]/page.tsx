"use client";

import { useState } from "react";

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const availabilityTypes = [
  "Preferred",
  "Available",
  "Backup",
  "Restricted",
];

export default function AvailabilitySubmissionPage() {
  const [name, setName] = useState("");

  return (
    <main className="min-h-screen bg-neutral-100 py-12">
      <div className="mx-auto max-w-5xl rounded-3xl bg-white p-10 shadow-sm">

        <p className="text-sm text-neutral-500">
          FABLAB Smart Scheduler
        </p>

        <h1 className="mt-2 text-4xl font-bold">
          Fall 2026 Availability
        </h1>

        <p className="mt-3 text-neutral-600">
          Please submit your weekly availability before
          August 7.
        </p>

        <div className="mt-10">

          <label className="text-sm font-medium">
            Technician Name
          </label>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="mt-2 h-12 w-full rounded-xl border border-neutral-200 px-4"
          />

        </div>

        <div className="mt-10 space-y-8">

          {days.map((day) => (

            <div
              key={day}
              className="rounded-2xl border border-neutral-200 p-6"
            >

              <h2 className="text-xl font-semibold">
                {day}
              </h2>

              <div className="mt-5 grid gap-5 md:grid-cols-3">

                <div>
                  <label className="text-sm font-medium">
                    Start Time
                  </label>

                  <input
                    type="time"
                    className="mt-2 h-11 w-full rounded-xl border border-neutral-200 px-3"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    End Time
                  </label>

                  <input
                    type="time"
                    className="mt-2 h-11 w-full rounded-xl border border-neutral-200 px-3"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Availability
                  </label>

                  <select className="mt-2 h-11 w-full rounded-xl border border-neutral-200 px-3">

                    {availabilityTypes.map((type) => (
                      <option key={type}>
                        {type}
                      </option>
                    ))}

                  </select>
                </div>

              </div>

            </div>

          ))}

        </div>

        <button
          className="mt-10 h-12 rounded-xl bg-black px-8 text-white"
        >
          Submit Availability
        </button>

      </div>
    </main>
  );
}
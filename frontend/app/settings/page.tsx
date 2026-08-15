"use client";

import { useEffect, useState, type FormEvent } from "react";

import AppLayout from "@/components/layout/AppLayout";
import {
  getCurrentAdmin,
  updateCurrentAdmin,
  type AdminApiResponse,
} from "@/lib/authApi";

export default function SettingsPage() {
  const [admin, setAdmin] = useState<AdminApiResponse | null>(
    null
  );

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadAdmin() {
    setLoading(true);
    setError("");

    try {
      const data = await getCurrentAdmin();

      setAdmin(data);
      setFullName(data.full_name);
      setEmail(data.email);
    } catch (loadError) {
      console.error(
        "Failed to load admin profile:",
        loadError
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your profile."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAdmin();
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving || !admin) {
      return;
    }

    setError("");
    setSuccessMessage("");
    setSaving(true);

    try {
      const updated = await updateCurrentAdmin({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
      });

      setAdmin(updated);
      setFullName(updated.full_name);
      setEmail(updated.email);

      setSuccessMessage("Profile updated.");

      window.setTimeout(() => {
        setSuccessMessage("");
      }, 2500);
    } catch (saveError) {
      console.error(
        "Failed to update admin profile:",
        saveError
      );

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <section>
          <p className="text-sm font-medium text-neutral-500">
            Settings
          </p>

          <h1 className="mt-2 text-4xl font-semibold">
            Account Settings
          </h1>

          <p className="mt-3 text-neutral-600">
            Manage your administrator profile.
          </p>
        </section>

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
            Loading profile...
          </div>
        ) : admin ? (
          <div className="max-w-xl rounded-2xl border border-neutral-200 bg-white p-6">
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-700">
                  Full name
                </span>

                <input
                  required
                  value={fullName}
                  disabled={saving}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-700">
                  Email
                </span>

                <input
                  required
                  type="email"
                  value={email}
                  disabled={saving}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
                />
              </label>

              <div className="grid gap-5 border-t border-neutral-200 pt-5 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-neutral-500">
                    Role
                  </p>
                  <p className="mt-1 text-neutral-900">
                    {admin.role}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-neutral-500">
                    Member since
                  </p>
                  <p className="mt-1 text-neutral-900">
                    {new Date(
                      admin.created_at
                    ).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex justify-end border-t border-neutral-200 pt-5">
                <button
                  type="submit"
                  disabled={saving}
                  className="min-w-36 rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}

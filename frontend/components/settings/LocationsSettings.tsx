"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MapPin } from "lucide-react";

import {
  createLocation,
  getLocations,
  updateLocation,
  type LocationApiResponse,
} from "@/lib/locationApi";

export default function LocationsSettings() {
  const [locations, setLocations] = useState<LocationApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await getLocations();
      setLocations(data);
    } catch (loadError) {
      console.error("Failed to load locations:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load locations."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function showSuccess(message: string) {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(""), 2500);
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newName.trim() || saving) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await createLocation(newName.trim());
      setNewName("");
      showSuccess("Location added.");
      await load();
    } catch (addError) {
      console.error("Failed to add location:", addError);
      setError(
        addError instanceof Error
          ? addError.message
          : "Unable to add this location."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(location: LocationApiResponse) {
    setBusyId(location.id);
    setError("");

    try {
      await updateLocation(location.id, {
        is_active: !location.is_active,
      });
      showSuccess(
        location.is_active
          ? "Location archived."
          : "Location re-activated."
      );
      await load();
    } catch (toggleError) {
      console.error("Failed to update location:", toggleError);
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update this location."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleRename(location: LocationApiResponse) {
    const nextName = window.prompt(
      "Rename this location",
      location.name
    );

    if (!nextName || !nextName.trim() || nextName === location.name) {
      return;
    }

    setBusyId(location.id);
    setError("");

    try {
      await updateLocation(location.id, { name: nextName.trim() });
      showSuccess("Location renamed.");
      await load();
    } catch (renameError) {
      console.error("Failed to rename location:", renameError);
      setError(
        renameError instanceof Error
          ? renameError.message
          : "Unable to rename this location."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-2xl rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
          <MapPin size={18} />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-neutral-950">
            Locations & Sites
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Manage where shifts can take place (FABLAB, a school site,
            an outreach event, etc.). Add as many as you need.
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleAdd} className="mt-5 flex gap-3">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          disabled={saving}
          placeholder="e.g. Carson High School"
          className="h-11 flex-1 rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
        />

        <button
          type="submit"
          disabled={saving || !newName.trim()}
          className="rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {saving ? "Adding..." : "Add Location"}
        </button>
      </form>

      <div className="mt-5">
        {loading ? (
          <p className="text-sm text-neutral-500">Loading locations...</p>
        ) : locations.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No locations yet. Add one above.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {locations.map((location) => (
              <li
                key={location.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={
                      location.is_active
                        ? "text-sm font-medium text-neutral-900"
                        : "text-sm font-medium text-neutral-400 line-through"
                    }
                  >
                    {location.name}
                  </span>

                  {!location.is_active && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                      Archived
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRename(location)}
                    disabled={busyId === location.id}
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Rename
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(location)}
                    disabled={busyId === location.id}
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {location.is_active ? "Archive" : "Re-activate"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

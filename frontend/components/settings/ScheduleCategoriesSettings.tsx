"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Palette } from "lucide-react";

import {
  createScheduleCategory,
  getScheduleCategories,
  updateScheduleCategory,
  type ScheduleCategoryApiResponse,
} from "@/lib/scheduleCategoryApi";

const DEFAULT_NEW_COLOR = "#2563eb";

export default function ScheduleCategoriesSettings() {
  const [categories, setCategories] = useState<
    ScheduleCategoryApiResponse[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_NEW_COLOR);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await getScheduleCategories();
      setCategories(data);
    } catch (loadError) {
      console.error("Failed to load categories:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load categories."
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
      await createScheduleCategory(newName.trim(), newColor);
      setNewName("");
      setNewColor(DEFAULT_NEW_COLOR);
      showSuccess("Status/category added.");
      await load();
    } catch (addError) {
      console.error("Failed to add category:", addError);
      setError(
        addError instanceof Error
          ? addError.message
          : "Unable to add this category."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(
    category: ScheduleCategoryApiResponse
  ) {
    setBusyId(category.id);
    setError("");

    try {
      await updateScheduleCategory(category.id, {
        is_active: !category.is_active,
      });
      showSuccess(
        category.is_active
          ? "Category archived."
          : "Category re-activated."
      );
      await load();
    } catch (toggleError) {
      console.error("Failed to update category:", toggleError);
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update this category."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleRename(category: ScheduleCategoryApiResponse) {
    const nextName = window.prompt(
      "Rename this status/category",
      category.name
    );

    if (!nextName || !nextName.trim() || nextName === category.name) {
      return;
    }

    setBusyId(category.id);
    setError("");

    try {
      await updateScheduleCategory(category.id, {
        name: nextName.trim(),
      });
      showSuccess("Category renamed.");
      await load();
    } catch (renameError) {
      console.error("Failed to rename category:", renameError);
      setError(
        renameError instanceof Error
          ? renameError.message
          : "Unable to rename this category."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleColorChange(
    category: ScheduleCategoryApiResponse,
    color: string
  ) {
    setBusyId(category.id);
    setError("");

    try {
      await updateScheduleCategory(category.id, { color });
      await load();
    } catch (colorError) {
      console.error("Failed to update category color:", colorError);
      setError(
        colorError instanceof Error
          ? colorError.message
          : "Unable to update this category's color."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-2xl rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
          <Palette size={18} />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-neutral-950">
            Schedule Categories & Statuses
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Control the statuses used on schedules (Working, On Leave,
            Training, etc.) and their colors. Every status is always
            shown with its name, never color alone.
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

      <form onSubmit={handleAdd} className="mt-5 flex flex-wrap gap-3">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          disabled={saving}
          placeholder="e.g. Field Trip"
          className="h-11 flex-1 rounded-xl border border-neutral-200 px-3 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100"
        />

        <input
          type="color"
          value={newColor}
          onChange={(event) => setNewColor(event.target.value)}
          disabled={saving}
          aria-label="New category color"
          className="h-11 w-14 cursor-pointer rounded-xl border border-neutral-200 p-1 disabled:cursor-not-allowed"
        />

        <button
          type="submit"
          disabled={saving || !newName.trim()}
          className="rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {saving ? "Adding..." : "Add Category"}
        </button>
      </form>

      <div className="mt-5">
        {loading ? (
          <p className="text-sm text-neutral-500">
            Loading categories...
          </p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No categories yet. Add one above.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {categories.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={category.color}
                    onChange={(event) =>
                      handleColorChange(category, event.target.value)
                    }
                    disabled={busyId === category.id}
                    aria-label={`Color for ${category.name}`}
                    className="h-8 w-8 cursor-pointer rounded-lg border border-neutral-200 p-0.5 disabled:cursor-not-allowed"
                  />

                  <span
                    className={
                      category.is_active
                        ? "text-sm font-medium text-neutral-900"
                        : "text-sm font-medium text-neutral-400 line-through"
                    }
                  >
                    {category.name}
                  </span>

                  {!category.is_active && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                      Archived
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRename(category)}
                    disabled={busyId === category.id}
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Rename
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(category)}
                    disabled={busyId === category.id}
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {category.is_active ? "Archive" : "Re-activate"}
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

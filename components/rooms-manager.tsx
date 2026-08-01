"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type RoomWithCount = { id: string; name: string; device_count: number };

export function RoomsManager({ householdId, rooms }: { householdId: string; rooms: RoomWithCount[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function addRoom() {
    const name = newName.trim();
    if (name === "") return;

    setAdding(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("rooms").insert({ household_id: householdId, name });

    setAdding(false);

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "You already have a room with that name."
          : "We couldn't add that room. Try again.",
      );
      return;
    }

    setNewName("");
    router.refresh();
  }

  function startRename(room: RoomWithCount) {
    setRenamingId(room.id);
    setRenameValue(room.name);
    setError(null);
  }

  async function saveRename(roomId: string) {
    const name = renameValue.trim();
    if (name === "") return;

    setBusyId(roomId);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.from("rooms").update({ name }).eq("id", roomId);

    setBusyId(null);

    if (updateError) {
      setError(
        updateError.code === "23505"
          ? "You already have a room with that name."
          : "We couldn't rename that room. Try again.",
      );
      return;
    }

    setRenamingId(null);
    router.refresh();
  }

  async function deleteRoom(roomId: string) {
    if (
      !window.confirm(
        "Delete this room? Its devices keep their documents and move to Unassigned.",
      )
    ) {
      return;
    }

    setBusyId(roomId);
    setError(null);

    const supabase = createClient();
    const { error: deleteError } = await supabase.from("rooms").delete().eq("id", roomId);

    setBusyId(null);

    if (deleteError) {
      setError("We couldn't delete that room. Try again.");
      return;
    }

    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      {error ? (
        <div className="banner error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="new-room-name">Add a room</label>
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            id="new-room-name"
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="e.g. Study"
          />
          <button type="button" className="button" onClick={() => void addRoom()} disabled={adding || newName.trim() === ""}>
            Add
          </button>
        </div>
      </div>

      {rooms.length === 0 ? (
        <p className="hint">No rooms yet.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "10px" }}>
          {rooms.map((room) => (
            <li
              key={room.id}
              className="card"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}
            >
              {renamingId === room.id ? (
                <div style={{ display: "flex", gap: "8px", flex: 1 }}>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    autoFocus
                  />
                  <button type="button" className="button" onClick={() => void saveRename(room.id)} disabled={busyId === room.id}>
                    Save
                  </button>
                  <button type="button" className="button secondary" onClick={() => setRenamingId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <span>
                    {room.name}{" "}
                    <span className="hint">
                      ({room.device_count} device{room.device_count === 1 ? "" : "s"})
                    </span>
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button type="button" className="button secondary" onClick={() => startRename(room)}>
                      Rename
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => void deleteRoom(room.id)}
                      disabled={busyId === room.id}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

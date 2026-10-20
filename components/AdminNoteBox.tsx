import { useEffect, useMemo, useState } from "react";
import type { OutputType as Overview } from "../endpoints/admin/overview_GET.schema";
import type { InputType as AdminAction } from "../endpoints/admin/action_POST.schema";
import { Button } from "./Button";
import { Textarea } from "./Textarea";
import styles from "./AdminNoteBox.module.css";

type Target = { key: string; id: number; role: "rider" | "restaurant"; label: string; note: string | null; reply: string | null; replyAt: Date | null };

export const AdminNoteBox = ({
  riders, restaurants, onAction, isPending,
}: {
  riders: Overview["riders"];
  restaurants: Overview["restaurants"];
  onAction: (action: AdminAction) => void;
  isPending: boolean;
}) => {
  const targets = useMemo<Target[]>(() => [
    ...riders.map((r) => ({ key: `rider:${r.id}`, id: r.id, role: "rider" as const, label: `Rider · ${r.name} · ${r.town}`, note: r.adminNote, reply: r.adminReply, replyAt: r.adminReplyAt })),
    ...restaurants.map((r) => ({ key: `restaurant:${r.id}`, id: r.id, role: "restaurant" as const, label: `Merchant · ${r.name} · ${r.town}`, note: r.adminNote, reply: r.adminReply, replyAt: r.adminReplyAt })),
  ], [riders, restaurants]);
  const [targetKey, setTargetKey] = useState(targets[0]?.key ?? "");
  const target = targets.find((item) => item.key === targetKey) ?? targets[0];
  const [note, setNote] = useState(target?.note ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNote(target?.note ?? "");
    setSaved(false);
  }, [targetKey, target?.note]);

  const save = () => {
    if (!target) return;
    onAction({ action: "admin_partner_note", recipientRole: target.role, recipientId: target.id, note: note.trim() });
    setSaved(true);
  };

  return (
    <section className={styles.box}>
      <label className={styles.field}>
        Admin note for
        <select className={styles.select} value={target?.key ?? ""} onChange={(event) => setTargetKey(event.target.value)} disabled={!targets.length}>
          {!targets.length && <option value="">No riders or merchants yet</option>}
          {targets.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </label>
      <label className={styles.field}>
        Note (visible to the selected partner)
        <Textarea rows={2} maxLength={1000} value={note} onChange={(event) => { setNote(event.target.value); setSaved(false); }} placeholder="Write what they need to complete or know…" />
      </label>
      {target?.reply && <div role="status" style={{ gridColumn: "1 / -1", padding: 12, borderRadius: 8, background: "#fff7ed", color: "#7c2d12" }}><strong>Partner reply received{target.replyAt ? ` · ${new Date(target.replyAt).toLocaleString("en-IN")}` : ""}</strong><p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{target.reply}</p></div>}
      <Button disabled={!target || isPending || !note.trim() && !target.note} onClick={save}>{isPending ? "Saving…" : note.trim() ? "Save note" : "Clear note"}</Button>
      {saved && <small role="status" style={{ gridColumn: "1 / -1", color: "#16834a" }}>Note saved. It will appear in the selected partner’s dashboard.</small>}
    </section>
  );
};
import { useMemo, useState } from "react";
import { ImagePlus, UtensilsCrossed, Pencil, Trash2, Plus, Search } from "lucide-react";
import type { OutputType } from "../endpoints/restaurant/dashboard_GET.schema";
import { postRestaurantAction } from "../endpoints/restaurant/action_POST.schema";
import { postMenuImageUpload } from "../endpoints/restaurant/menu_image_POST.schema";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { ziptoSound } from "../helpers/ziptoSound";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";
import { Switch } from "./Switch";
import { ToggleGroup, ToggleGroupItem } from "./ToggleGroup";
import { FileDropzone } from "./FileDropzone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./Dialog";
import { MerchantSectionHeader, MerchantEmpty, MerchantField } from "./MerchantUi";
import styles from "./MerchantMenuEditor.module.css";

type Dish = { name: string; description: string; category: string; price: string; isVeg: boolean; imageUrl: string };
const blank: Dish = { name: "", description: "", category: "Main course", price: "", isVeg: true, imageUrl: "" };

export const MerchantMenuEditor = ({ data, className }: { data: OutputType; className?: string }) => {
  const key = ziptoHooks.keys.restaurantDashboard;
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const act = ziptoHooks.useAction((x: Parameters<typeof postRestaurantAction>[0]) => postRestaurantAction(x), [key], (x) =>
    x.action === "save_item"
      ? photoUploaded && open && x.imageUrl === dish.imageUrl
        ? "Dish saved – photo sent for review"
        : x.id ? "Dish updated" : "Dish added"
      : x.action === "delete_item" ? "Dish deleted" : undefined
  );
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dish, setDish] = useState<Dish>(blank);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("__all");
  const [availability, setAvailability] = useState<"all" | "on" | "off">("all");
  const [deleting, setDeleting] = useState<{ id: number; name: string } | null>(null);

  const categories = useMemo(() => Array.from(new Set(data.menu.map((m) => m.category))).sort(), [data.menu]);
  const items = data.menu.filter(
    (m) =>
      (category === "__all" || m.category === category) &&
      (availability === "all" || (availability === "on" ? m.isAvailable : !m.isAvailable)) &&
      (m.name + " " + m.category).toLowerCase().includes(search.toLowerCase())
  );

  const startNew = () => { setEditingId(null); setDish({ ...blank, category: categories[0] || "Main course" }); setPhotoUploaded(false); setFormError(""); setOpen(true); };
  const startEdit = (m: OutputType["menu"][number]) => {
    setEditingId(m.id);
    setDish({ name: m.name, description: m.description || "", category: m.category, price: String(m.price), isVeg: m.isVeg, imageUrl: m.pendingImageUrl ?? m.imageUrl ?? "" });
    setPhotoUploaded(false);
    setFormError("");
    setOpen(true);
  };

  const uploadImage = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setFormError(""); setUploading(true);
    try {
      const types = ["image/jpeg", "image/png", "image/webp", "image/avif"];
      if (!types.includes(file.type)) throw new Error("Please upload a JPG, PNG, WebP or AVIF image.");
      if (file.size > 8 * 1024 * 1024) throw new Error("Image must be 8 MB or smaller.");
      const signed = await postMenuImageUpload({ filename: file.name, contentType: file.type as "image/jpeg", sizeBytes: file.size });
      const put = await fetch(signed.presignedUrl, { method: "PUT", headers: signed.headers, body: file });
      if (!put.ok) throw new Error("Image upload failed. Please try again.");
      setDish((d) => ({ ...d, imageUrl: signed.url }));
      setPhotoUploaded(true);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not upload image.");
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    const price = Number(dish.price);
    if (dish.name.trim().length < 2) return setFormError("Dish name is required");
    if (!dish.category.trim()) return setFormError("Category is required");
    if (!Number.isInteger(price) || price < 1) return setFormError("Enter a valid price in whole rupees");
    act.mutate(
      {
        action: "save_item",
        ...(editingId ? { id: editingId } : {}),
        name: dish.name.trim(),
        description: dish.description.trim() || undefined,
        category: dish.category.trim(),
        price,
        isVeg: dish.isVeg,
        isAvailable: editingId ? data.menu.find((m) => m.id === editingId)?.isAvailable ?? true : true,
        imageUrl: dish.imageUrl || null,
      },
      { onSuccess: () => setOpen(false) }
    );
  };

  return (
    <div className={`${styles.wrap} ${className || ""}`}>
      <MerchantSectionHeader
        eyebrow="Menu Editor"
        title="Your menu"
        subtitle="Add dishes with photos and switch them on or off any time. Customers pay exactly these prices."
        actions={<Button onClick={startNew}><Plus size={16} /> Add dish</Button>}
      />

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Search size={16} />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dishes…" aria-label="Search dishes" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className={styles.select}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={availability} onValueChange={(v) => setAvailability(v as typeof availability)}>
          <SelectTrigger className={styles.select}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All items</SelectItem>
            <SelectItem value="on">Available</SelectItem>
            <SelectItem value="off">Hidden</SelectItem>
          </SelectContent>
        </Select>
        <span className={styles.count}>{data.menu.filter((m) => m.isAvailable).length}/{data.menu.length} available</span>
      </div>

      {items.length === 0 ? (
        <MerchantEmpty
          icon={<UtensilsCrossed size={32} />}
          title={data.menu.length ? "No dishes match" : "Your menu starts here"}
          text={data.menu.length ? "Try another search or filter." : "Add your first dish – a clear photo and honest price help customers decide."}
          action={!data.menu.length && <Button onClick={startNew}><Plus size={16} /> Add first dish</Button>}
        />
      ) : (
        <div className={styles.grid}>
          {items.map((m) => (
            <article key={m.id} className={`${styles.dish} ${!m.isAvailable ? styles.off : ""}`}>
              <div className={styles.photo}>
                {m.pendingImageUrl ?? m.imageUrl
                  ? <img src={(m.pendingImageUrl ?? m.imageUrl)!} alt={m.name} />
                  : <ImagePlus size={26} />}
                <span className={m.isVeg ? styles.veg : styles.nonveg} aria-label={m.isVeg ? "Veg" : "Non-veg"} />
                {m.imageReview === "pending" && <Badge variant="warning" className={styles.photoBadge}>Pending for review</Badge>}
              </div>
              <div className={styles.body}>
                <div className={styles.row}>
                  <b>{m.name}</b>
                  <b className={styles.price}>{ziptoConfig.rupees(m.price)}</b>
                </div>
                <div className={styles.foodType}>
                  <small className={styles.cat}>{m.category}</small>
                  <ToggleGroup
                    type="single"
                    size="sm"
                    variant="outline"
                    value={m.isVeg ? "veg" : "nonveg"}
                    disabled={act.isPending}
                    aria-label={`Food type for ${m.name}`}
                    onValueChange={(value) => {
                      if (!value || value === (m.isVeg ? "veg" : "nonveg")) return;
                      act.mutate({
                        action: "save_item",
                        id: m.id,
                        name: m.name,
                        description: m.description || undefined,
                        category: m.category,
                        price: m.price,
                        isVeg: value === "veg",
                        isAvailable: m.isAvailable,
                        imageUrl: m.imageUrl || null,
                      });
                    }}
                  >
                    <ToggleGroupItem value="veg" className={styles.vegChoice}>🟢 Veg</ToggleGroupItem>
                    <ToggleGroupItem value="nonveg" className={styles.nonvegChoice}>🔴 Non-veg</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                {m.description && <p>{m.description}</p>}
                {m.imageReview === "rejected" && (
                  <small className={styles.photoRejected}>Photo rejected: {m.imageRejectReason || "Please upload a different photo."}</small>
                )}
                <div className={styles.row}>
                  <label className={styles.toggle}>
                    <Switch checked={m.isAvailable} disabled={act.isPending} onCheckedChange={(v) => {
                      ziptoSound.playToggle(v);
                      act.mutate({ action: "toggle_item", id: m.id, isAvailable: v });
                    }} />
                    {m.isAvailable ? "Available" : "Hidden"}
                  </label>
                  <span className={styles.btns}>
                    <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => startEdit(m)}><Pencil size={15} /></Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Delete" onClick={() => setDeleting({ id: m.id, name: m.name })}><Trash2 size={15} /></Button>
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={styles.dialog}>
          <DialogHeader><DialogTitle>{editingId ? "Edit dish" : "Add a new dish"}</DialogTitle></DialogHeader>
          <div className={styles.form}>
            <MerchantField label="Dish name *"><Input value={dish.name} onChange={(e) => setDish({ ...dish, name: e.target.value })} placeholder="e.g. Paneer Butter Masala" /></MerchantField>
            <div className={styles.two}>
              <MerchantField label="Category *"><Input list="zipto-cats" value={dish.category} onChange={(e) => setDish({ ...dish, category: e.target.value })} placeholder="Main course" /></MerchantField>
              <MerchantField label="Price (₹) *"><Input inputMode="numeric" value={dish.price} onChange={(e) => setDish({ ...dish, price: e.target.value.replace(/\D/g, "") })} placeholder="180" /></MerchantField>
            </div>
            <datalist id="zipto-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            <MerchantField label="Short description"><Input maxLength={200} value={dish.description} onChange={(e) => setDish({ ...dish, description: e.target.value })} placeholder="Ingredients or what makes it special" /></MerchantField>
            <div className={styles.foodType}>
              <span className={styles.foodTypeLabel}>Food type *</span>
              <ToggleGroup
                type="single"
                size="sm"
                variant="outline"
                value={dish.isVeg ? "veg" : "nonveg"}
                aria-label="Food type"
                onValueChange={(value) => {
                  if (value) setDish((current) => ({ ...current, isVeg: value === "veg" }));
                }}
              >
                <ToggleGroupItem value="veg" className={styles.vegChoice}>🟢 Veg</ToggleGroupItem>
                <ToggleGroupItem value="nonveg" className={styles.nonvegChoice}>🔴 Non-veg</ToggleGroupItem>
              </ToggleGroup>
            </div>
            {dish.imageUrl ? (
              <div className={styles.preview}>
                <img src={dish.imageUrl} alt="Dish preview" />
                <Button size="sm" variant="outline" onClick={() => { setDish({ ...dish, imageUrl: "" }); setPhotoUploaded(false); }}>Remove photo</Button>
              </div>
            ) : (
              <FileDropzone accept="image/jpeg,image/png,image/webp,image/avif" maxFiles={1} maxSize={8 * 1024 * 1024} disabled={uploading} onFilesSelected={uploadImage} icon={<ImagePlus size={30} />} title={uploading ? "Uploading photo…" : "Upload dish photo"} subtitle="JPG, PNG, WebP or AVIF · max 8 MB" />
            )}
            {editingId !== null && !photoUploaded && dish.imageUrl &&
              data.menu.find((m) => m.id === editingId)?.pendingImageUrl === dish.imageUrl && (
                <Badge variant="warning" className={styles.dialogBadge}>Pending for review</Badge>
              )}
            {photoUploaded && <p className={styles.photoHelp}>New photo will show to customers after platr™ admin approval.</p>}
            {formError && <p role="alert" className={styles.error}>{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={uploading || act.isPending} onClick={save}>{act.isPending ? "Saving…" : editingId ? "Save changes" : "Add to menu"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {deleting?.name}?</DialogTitle></DialogHeader>
          <p className={styles.muted}>This removes the dish from your menu. Tip: use the Available switch to hide it temporarily instead.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Keep dish</Button>
            <Button variant="destructive" onClick={() => { if (deleting) act.mutate({ action: "delete_item", id: deleting.id }); setDeleting(null); }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-context";
import { useMarketplaceUser } from "../../_lib/MarketplaceProvider";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/marketplace/use-toast";
import { categories } from "@/lib/marketplace/data";
import { PRODUCT_CONDITION_OPTIONS, type ProductCondition } from "@/lib/marketplace/product-condition";
import { compressImageFile, isAllowedImageType, MAX_IMAGE_BYTES } from "@/lib/marketplace/compress-image";
import { shareListing } from "@/lib/marketplace/share-listing";
import { buildLoginUrl } from "@/lib/marketplace/auth-redirect";
import { ensureUserProfile } from "../../_lib/profile";
import { uploadImage } from "../../_lib/mappers";
import { formatSupabaseError } from "../../_lib/errors";

const MAX_IMAGES = 4;

type ImageItem = {
  id: string;
  file: File;
  previewUrl: string;
};

type CreatedListing = {
  id: string;
  name: string;
  price: number;
};

export default function NewProductPage() {
  const router = useRouter();
  const { supabase, user } = useSession();
  const { profile } = useMarketplaceUser();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedListing | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState<ProductCondition>("good");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    return () => {
      images.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setImageError(`You can upload up to ${MAX_IMAGES} photos.`);
      return;
    }

    const next: ImageItem[] = [];
    const incoming = Array.from(fileList).slice(0, remaining);
    for (const file of incoming) {
      if (!isAllowedImageType(file)) {
        setImageError("Use JPEG, PNG, or WebP only.");
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setImageError("Each photo must be 5MB or smaller.");
        continue;
      }
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (next.length) {
      setImages((prev) => [...prev, ...next]);
      setImageError(null);
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    const priceNum = Number(price);

    if (trimmedName.length < 3) nextErrors.name = "Title must be at least 3 characters.";
    else if (trimmedName.length > 80) nextErrors.name = "Title must be at most 80 characters.";
    if (trimmedDesc.length < 10) nextErrors.description = "Description must be at least 10 characters.";
    else if (trimmedDesc.length > 2000) nextErrors.description = "Description must be at most 2000 characters.";
    if (!price || !isFinite(priceNum) || priceNum <= 0) nextErrors.price = "Price must be greater than 0.";
    else if (priceNum > 100000) nextErrors.price = "Price must be at most RM 100,000.";
    if (!category) nextErrors.category = "Please select a category.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (images.length < 1) {
      setImageError("Add at least one photo to list your item.");
      return;
    }

    if (!user) {
      toast({ variant: "destructive", title: "Please log in", description: "You must be logged in to create a listing." });
      router.push(buildLoginUrl("/marketplace/products/new"));
      return;
    }

    setIsSubmitting(true);
    setUploadLabel("Preparing photos…");

    try {
      await ensureUserProfile(supabase, user);

      const selectedCategory = categories.find((c) => c.id === category);
      if (!selectedCategory) {
        throw new Error("Invalid category selected.");
      }

      const imageUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        setUploadLabel(`Uploading photo ${i + 1} of ${images.length}…`);
        const compressed = await compressImageFile(images[i].file);
        const url = await uploadImage(supabase, compressed);
        imageUrls.push(url);
      }

      setUploadLabel("Publishing listing…");
      const { data, error } = await supabase
        .from("products")
        .insert({
          name: trimmedName,
          description: trimmedDesc,
          price: priceNum,
          category_id: selectedCategory.id,
          category_name: selectedCategory.name,
          seller_id: user.id,
          image_urls: imageUrls,
          condition,
          status: "available",
          date_added: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;

      const listing: CreatedListing = {
        id: data.id as string,
        name: trimmedName,
        price: priceNum,
      };
      setCreated(listing);

      if (!profile?.qrCodeUrl) {
        toast({
          title: "Add a payment QR",
          description: "Add your bank/e-wallet QR in Profile → Edit so buyers can pay you faster.",
        });
      }

      toast({
        title: "Listing published",
        description: `${listing.name} is live. Share it with campus buyers.`,
      });
    } catch (error: unknown) {
      console.error("Failed to create listing:", formatSupabaseError(error));
      toast({
        variant: "destructive",
        title: "Failed to create listing",
        description: formatSupabaseError(error) || "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
      setUploadLabel(null);
    }
  }

  const handleShare = async () => {
    if (!created) return;
    const result = await shareListing(created);
    if (result.ok) {
      toast({
        title: result.method === "native" ? "Shared" : "Link copied",
        description:
          result.method === "native"
            ? "Listing ready to send in WhatsApp or Telegram."
            : "Link copied. Paste it into WhatsApp or Telegram.",
      });
      return;
    }
    if (result.reason === "aborted") return;
    toast({
      variant: "destructive",
      title: "Could not copy link",
      description: `Copy this URL manually: ${result.url}`,
    });
  };

  if (created) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <Card>
          <h3 style={{ marginTop: 0 }}>Your listing is live</h3>
          <p style={{ color: "var(--muted)" }}>
            Share the link in WhatsApp or Telegram, or open the listing page.
          </p>
          <div className="stack">
            <strong>{created.name}</strong>
            <strong style={{ color: "var(--brand-deep)" }}>RM {created.price.toFixed(2)}</strong>
            <button type="button" className="btn btn-primary" onClick={handleShare}>
              <i className="ti ti-share" /> Share listing link
            </button>
            <Link className="btn" href={`/marketplace/products/${created.id}`}>
              View listing
            </Link>
            <Link className="btn" href="/marketplace/products">
              Browse marketplace
            </Link>
            <Link className="btn btn-sm" href="/marketplace/profile/edit">
              Add payment QR in Profile → Edit
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
      <Card>
        <h3 style={{ marginTop: 0 }}>Sell your item</h3>
        <p style={{ color: "var(--muted)" }}>
          Start with a photo, add a few details, and publish in under a minute.
        </p>

        <form onSubmit={onSubmit} className="form-stack">
          <div className="form-group">
            <label>Photos (required)</label>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
              Add 1–{MAX_IMAGES} clear photos. JPEG, PNG, or WebP · max 5MB each.
            </p>
            <label
              htmlFor="listing-photos"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 140,
                border: "2px dashed var(--line)",
                borderRadius: 12,
                cursor: "pointer",
                background: "var(--surface)",
                textAlign: "center",
                gap: 6,
              }}
            >
              <i className="ti ti-upload" style={{ fontSize: 26 }} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Click to add photos</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {images.length}/{MAX_IMAGES} selected
              </span>
              <input
                id="listing-photos"
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                accept="image/png,image/jpeg,image/webp"
                multiple
                disabled={isSubmitting || images.length >= MAX_IMAGES}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {imageError && <small style={{ color: "var(--danger)" }}>{imageError}</small>}
            {images.length > 0 && (
              <div className="image-preview-grid">
                {images.map((item) => (
                  <div key={item.id} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.previewUrl} alt="Listing preview" />
                    <button
                      type="button"
                      onClick={() => removeImage(item.id)}
                      disabled={isSubmitting}
                      aria-label="Remove photo"
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        background: "var(--danger)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "50%",
                        width: 24,
                        height: 24,
                        cursor: "pointer",
                        lineHeight: 1,
                      }}
                    >
                      <i className="ti ti-x" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <TextInput
            label="Title"
            placeholder="e.g., Used Textbook"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />

          <div className="form-row">
            <TextInput
              label="Price (RM)"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g., 50.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              error={errors.price}
            />
            <Select
              label="Category"
              placeholder="Select a category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              error={errors.category}
            />
          </div>

          <Select
            label="Condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value as ProductCondition)}
            options={PRODUCT_CONDITION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />

          <Textarea
            label="Description"
            placeholder="Meetup preference and anything buyers should know."
            value={description}
            maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
            error={errors.description}
          />

          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? uploadLabel || "Publishing…" : "Publish listing"}
          </button>
        </form>
      </Card>
    </div>
  );
}

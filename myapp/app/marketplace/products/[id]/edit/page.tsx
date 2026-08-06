"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-context";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/marketplace/use-toast";
import { categories } from "@/lib/marketplace/data";
import { PRODUCT_CONDITION_OPTIONS, type ProductCondition } from "@/lib/marketplace/product-condition";
import { mapProductRow, uploadImage, type ProductRow } from "@/app/marketplace/_lib/mappers";

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const { supabase, user } = useSession();
  const { toast } = useToast();
  const productId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState<ProductCondition>("good");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newImageFile, setNewImageFile] = useState<File | null>(null);

  useEffect(() => {
    if (!productId || !user) {
      setIsLoading(false);
      return;
    }

    const fetchProduct = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*, profiles:seller_id(*)")
        .eq("id", productId)
        .single();

      if (error || !data) {
        toast({ variant: "destructive", title: "Not Found", description: "This product does not exist." });
        router.push("/marketplace/products");
        setIsLoading(false);
        return;
      }

      const productData = mapProductRow(data as ProductRow);
      if (productData.seller.id !== user.id) {
        toast({ variant: "destructive", title: "Unauthorized", description: "You are not authorized to edit this product." });
        router.push(`/marketplace/products/${productId}`);
        return;
      }

      setName(productData.name);
      setDescription(productData.description);
      setPrice(String(productData.price));
      setCategory(productData.category.id);
      setCondition(productData.condition);

      if (productData.imageUrls && productData.imageUrls.length > 0) {
        setImagePreview(productData.imageUrls[0]);
      }
      setIsLoading(false);
    };

    fetchProduct();
  }, [supabase, productId, user, router, toast]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !productId) return;

    const nextErrors: Record<string, string> = {};
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    const priceNum = Number(price);

    if (trimmedName.length < 3) nextErrors.name = "Product name must be at least 3 characters.";
    if (trimmedDesc.length < 10) nextErrors.description = "Description must be at least 10 characters.";
    if (!price || !isFinite(priceNum) || priceNum <= 0) nextErrors.price = "Price must be a positive number.";
    if (!category) nextErrors.category = "Please select a category.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      let finalImageUrl = imagePreview;

      if (newImageFile) {
        finalImageUrl = await uploadImage(supabase, newImageFile);
      }

      const selectedCategory = categories.find((c) => c.id === category);
      if (!selectedCategory) {
        throw new Error("Invalid category selected.");
      }

      const { error } = await supabase
        .from("products")
        .update({
          name: trimmedName,
          description: trimmedDesc,
          price: priceNum,
          category_id: selectedCategory.id,
          category_name: selectedCategory.name,
          condition,
          image_urls: finalImageUrl
            ? [finalImageUrl]
            : ["https://picsum.photos/seed/placeholder/600/400"],
        })
        .eq("id", productId);
      if (error) throw error;

      toast({
        title: "Listing Updated!",
        description: `${trimmedName} has been successfully updated.`,
      });
      router.push(`/marketplace/products/${productId}`);
    } catch (error: any) {
      console.error("Failed to update listing:", error);
      toast({
        variant: "destructive",
        title: "Failed to update listing",
        description: error?.message || "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setNewImageFile(null);
    const fileInput = document.getElementById("dropzone-file") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <Card>
          <h3 style={{ marginTop: 0 }}>Edit listing…</h3>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
      <Card>
        <h3 style={{ marginTop: 0 }}>Edit listing</h3>

        <form onSubmit={onSubmit} className="form-stack">
          {imagePreview && (
            <div className="form-group">
              <label>Listing photo</label>
              <div style={{ position: "relative", display: "inline-block" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Listing preview"
                  style={{ width: 200, aspectRatio: "4/3", objectFit: "cover", borderRadius: 10, border: "2px solid var(--line)" }}
                />
                <button
                  type="button"
                  onClick={removeImage}
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
                  }}
                >
                  <i className="ti ti-x" />
                </button>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Replace photo (optional)</label>
            <input
              id="dropzone-file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
            />
          </div>

          <TextInput
            label="Title"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />

          <div className="form-row">
            <TextInput
              label="Price (RM)"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              error={errors.price}
            />
            <Select
              label="Category"
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={errors.description}
          />

          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </button>
        </form>
      </Card>
    </div>
  );
}

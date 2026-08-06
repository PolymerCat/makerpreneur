"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-context";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/marketplace/use-toast";
import { uploadImage } from "@/app/marketplace/_lib/mappers";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

function sanitizePaymentNote(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
}

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type) && !file.type.startsWith("image/")) {
    return "Please upload a JPEG, PNG, or WebP image.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Image must be 5MB or smaller.";
  }
  return null;
}

export default function EditMarketplaceProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, supabase } = useSession();
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [hadQrOnLoad, setHadQrOnLoad] = useState(false);
  const [qrCleared, setQrCleared] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setName(data.name);
        setPaymentNote(data.payment_note ?? "");
        if (data.avatar_url) setAvatarPreview(data.avatar_url);
        if (data.qr_code_url) {
          setQrPreview(data.qr_code_url);
          setHadQrOnLoad(true);
        }
        setQrCleared(false);
      });
  }, [user, supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to edit your profile.",
      });
      router.push("/signin");
      return;
    }

    const nextErrors: Record<string, string> = {};
    const trimmedName = name.trim();
    if (trimmedName.length < 2) nextErrors.name = "Name must be at least 2 characters.";
    if (newPassword || oldPassword || confirmPassword) {
      if (!newPassword || newPassword.length < 8) nextErrors.newPassword = "New password must be at least 8 characters.";
      if (newPassword !== confirmPassword) nextErrors.confirmPassword = "New passwords don't match";
      if (newPassword && !oldPassword) nextErrors.oldPassword = "Please enter your current password to set a new one.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      const updateData: {
        name: string;
        payment_note: string | null;
        qr_code_url?: string | null;
        avatar_url?: string;
      } = {
        name: trimmedName,
        payment_note: sanitizePaymentNote(paymentNote) || null,
      };

      if (avatarFile) {
        const err = validateImageFile(avatarFile);
        if (err) throw new Error(err);
        updateData.avatar_url = await uploadImage(supabase, avatarFile);
      }

      if (qrFile) {
        const err = validateImageFile(qrFile);
        if (err) throw new Error(err);
        updateData.qr_code_url = await uploadImage(supabase, qrFile);
      } else if (qrCleared && hadQrOnLoad) {
        updateData.qr_code_url = null;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);
      if (profileError) throw profileError;

      await supabase.auth.updateUser({
        data: {
          name: trimmedName,
          ...(updateData.avatar_url ? { avatar_url: updateData.avatar_url } : {}),
        },
      });

      if (newPassword && oldPassword && user.email) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: oldPassword,
        });
        if (reauthError) throw reauthError;

        const { error: pwError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (pwError) throw pwError;
      }

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
      router.push("/marketplace/profile");
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      toast({
        variant: "destructive",
        title: "Failed to update profile",
        description: error?.message || "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleQrFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      toast({ variant: "destructive", title: "Invalid image", description: err });
      return;
    }
    setQrPreview(URL.createObjectURL(file));
    setQrCleared(false);
    setQrFile(file);
  };

  const removeQrImage = () => {
    setQrPreview(null);
    setQrCleared(true);
    setQrFile(null);
  };

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      toast({ variant: "destructive", title: "Invalid image", description: err });
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarFile(file);
  };

  const removeAvatarImage = () => {
    setAvatarPreview(null);
    setAvatarFile(null);
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
      <Card>
        <h3 style={{ marginTop: 0 }}>Edit Your Profile</h3>
        <p style={{ color: "var(--muted)" }}>
          Update your account details below. Leave password fields blank to keep your current
          password.
        </p>

        <form onSubmit={onSubmit} className="form-stack">
          <TextInput
            label="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />

          <div className="form-group">
            <label>Avatar photo</label>
            {avatarPreview && (
              <div style={{ position: "relative", display: "inline-block" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  style={{ width: 90, height: 90, objectFit: "cover", borderRadius: "50%", border: "2px solid var(--line)" }}
                />
                <button
                  type="button"
                  onClick={removeAvatarImage}
                  aria-label="Remove avatar"
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    background: "var(--danger)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50%",
                    width: 22,
                    height: 22,
                    cursor: "pointer",
                  }}
                >
                  <i className="ti ti-x" />
                </button>
              </div>
            )}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarFileChange} />
          </div>

          <div className="form-group">
            <label>Payment QR code</label>
            {qrPreview && (
              <div style={{ position: "relative", display: "inline-block" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrPreview}
                  alt="Payment QR preview"
                  style={{ width: 160, height: 160, objectFit: "cover", borderRadius: 10, border: "2px solid var(--line)" }}
                />
                <button
                  type="button"
                  onClick={removeQrImage}
                  aria-label="Remove QR"
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    background: "var(--danger)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50%",
                    width: 22,
                    height: 22,
                    cursor: "pointer",
                  }}
                >
                  <i className="ti ti-x" />
                </button>
              </div>
            )}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleQrFileChange} />
            <small style={{ color: "var(--muted)" }}>
              Buyers scan this to pay you. Bank/e-wallet QR works best.
            </small>
          </div>

          <Textarea
            label="Payment note (optional)"
            value={paymentNote}
            maxLength={120}
            onChange={(e) => setPaymentNote(e.target.value)}
            placeholder="e.g. DuitNow ID: 012-3456789, bank: Maybank"
          />

          <TextInput
            label="Current password"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            error={errors.oldPassword}
          />
          <TextInput
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={errors.newPassword}
          />
          <TextInput
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
          />

          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save profile"}
          </button>
          <Link href="/marketplace/profile" style={{ color: "var(--brand)", fontWeight: 700, fontSize: 14 }}>
            Back to profile
          </Link>
        </form>
      </Card>
    </div>
  );
}

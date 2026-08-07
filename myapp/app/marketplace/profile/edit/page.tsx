"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-context";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/marketplace/use-toast";
import { displayNameFromProfile, uploadImage, type ProfileRow } from "@/app/marketplace/_lib/mappers";
import { updateMarketplaceProfile } from "@/app/marketplace/_lib/profile";

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
        const row = data as ProfileRow;
        setName(displayNameFromProfile(row));
        setPaymentNote(row.payment_note ?? "");
        if (row.avatar_url) setAvatarPreview(row.avatar_url);
        if (row.qr_code_url) {
          setQrPreview(row.qr_code_url);
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
      const updateFields: {
        displayName: string;
        paymentNote: string | null;
        qrCodeUrl?: string | null;
        avatarUrl?: string;
      } = {
        displayName: trimmedName,
        paymentNote: sanitizePaymentNote(paymentNote) || null,
      };

      if (avatarFile) {
        const err = validateImageFile(avatarFile);
        if (err) throw new Error(err);
        updateFields.avatarUrl = await uploadImage(supabase, avatarFile);
      }

      if (qrFile) {
        const err = validateImageFile(qrFile);
        if (err) throw new Error(err);
        updateFields.qrCodeUrl = await uploadImage(supabase, qrFile);
      } else if (qrCleared && hadQrOnLoad) {
        updateFields.qrCodeUrl = null;
      }

      await updateMarketplaceProfile(supabase, user.id, updateFields);

      await supabase.auth.updateUser({
        data: {
          name: trimmedName,
          full_name: trimmedName,
          ...(updateFields.avatarUrl ? { avatar_url: updateFields.avatarUrl } : {}),
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
    } catch (error: unknown) {
      console.error("Failed to update profile:", error);
      var message = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({
        variant: "destructive",
        title: "Failed to update profile",
        description: message,
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
    <div className="mp-edit-wrap">
      <Card>
        <h3 className="mp-section-title">Edit Your Profile</h3>
        <p className="mp-muted-text">
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
            <label htmlFor="avatar-file">Avatar photo</label>
            {avatarPreview && (
              <div className="mp-preview-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="mp-avatar-preview"
                />
                <button
                  type="button"
                  onClick={removeAvatarImage}
                  aria-label="Remove avatar"
                  className="mp-remove-preview-btn"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
            )}
            <input
              id="avatar-file"
              name="avatar-file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarFileChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="qr-file">Payment QR code</label>
            {qrPreview && (
              <div className="mp-preview-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrPreview}
                  alt="Payment QR preview"
                  className="mp-qr-preview"
                />
                <button
                  type="button"
                  onClick={removeQrImage}
                  aria-label="Remove QR"
                  className="mp-remove-preview-btn"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
            )}
            <input
              id="qr-file"
              name="qr-file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleQrFileChange}
            />
            <small className="mp-muted-text">
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
          <Link href="/marketplace/profile" className="mp-back-link">
            Back to profile
          </Link>
        </form>
      </Card>
    </div>
  );
}

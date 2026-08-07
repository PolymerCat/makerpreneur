"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-context";
import { useMarketplaceUser } from "../_lib/MarketplaceProvider";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Table } from "@/components/ui/Table";
import { Dialog } from "@/components/ui/Dialog";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { SellerListingStatusControls } from "@/components/marketplace/SellerListingStatusControls";
import { useToast } from "@/components/marketplace/use-toast";
import {
  mapProfileToUser,
  mapProductRow,
  mapPurchaseRow,
  mapReportRow,
  type ProfileRow,
  type ProductRow,
  type PurchaseRow,
  type ReportRow,
} from "../_lib/mappers";
import { ensureUserProfile } from "../_lib/profile";
import { formatSupabaseError } from "../_lib/errors";
import type { Product, Purchase, Report, User as AppUser } from "@/lib/marketplace/types";
import { adminDismissReport, adminHideListing, formatAdminReportError } from "../_lib/admin-reports";

export default function MarketplaceProfilePage() {
  const { user, supabase } = useSession();
  const { isAdmin, profile: contextProfile, profileLoading } = useMarketplaceUser();
  const router = useRouter();
  const { toast } = useToast();

  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [userListings, setUserListings] = useState<Product[]>([]);
  const [userSales, setUserSales] = useState<Purchase[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<Purchase[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isListingsLoading, setIsListingsLoading] = useState(true);
  const [isSalesLoading, setIsSalesLoading] = useState(true);
  const [isPurchasesLoading, setIsPurchasesLoading] = useState(true);
  const [isReportsLoading, setIsReportsLoading] = useState(true);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setAppUser(null);
      setProfileError(null);
      setIsProfileLoading(false);
      return;
    }
    setIsProfileLoading(true);
    setProfileError(null);
    try {
      const row = await ensureUserProfile(supabase, user);
      setAppUser(mapProfileToUser(row as ProfileRow));
    } catch (error) {
      console.error("[MARKETPLACE] Failed to load profile:", error);
      setProfileError(formatSupabaseError(error));
    } finally {
      setIsProfileLoading(false);
    }
  }, [user, supabase]);

  const loadListings = useCallback(async () => {
    if (!user) return;
    setIsListingsLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*, profiles:seller_id(*)")
      .eq("seller_id", user.id)
      .order("date_added", { ascending: false });
    if (error) {
      console.error("[MARKETPLACE] Failed to load listings:", error);
      toast({
        variant: "destructive",
        title: "Could not load listings",
        description: formatSupabaseError(error),
      });
      setUserListings([]);
    } else {
      setUserListings((data as ProductRow[] | null)?.map(mapProductRow) ?? []);
    }
    setIsListingsLoading(false);
  }, [user, supabase, toast]);

  const loadSales = useCallback(async () => {
    if (!user) return;
    setIsSalesLoading(true);
    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .eq("seller_id", user.id)
      .eq("status", "Successful")
      .order("purchase_date", { ascending: false });
    if (error) {
      console.error("[MARKETPLACE] Failed to load sales:", error);
      toast({
        variant: "destructive",
        title: "Could not load sales",
        description: formatSupabaseError(error),
      });
      setUserSales([]);
    } else {
      setUserSales((data as PurchaseRow[] | null)?.map(mapPurchaseRow) ?? []);
    }
    setIsSalesLoading(false);
  }, [user, supabase, toast]);

  const loadPurchases = useCallback(async () => {
    if (!user) return;
    setIsPurchasesLoading(true);
    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .eq("buyer_id", user.id)
      .order("purchase_date", { ascending: false });
    if (error) {
      console.error("[MARKETPLACE] Failed to load purchases:", error);
      toast({
        variant: "destructive",
        title: "Could not load purchases",
        description: formatSupabaseError(error),
      });
      setPurchaseHistory([]);
    } else {
      setPurchaseHistory((data as PurchaseRow[] | null)?.map(mapPurchaseRow) ?? []);
    }
    setIsPurchasesLoading(false);
  }, [user, supabase, toast]);

  const loadReports = useCallback(async () => {
    if (!isAdmin) {
      setIsReportsLoading(false);
      return;
    }
    setIsReportsLoading(true);
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("status", "open")
      .order("date", { ascending: false });
    setReports((data as ReportRow[] | null)?.map(mapReportRow) ?? []);
    setIsReportsLoading(false);
  }, [isAdmin, supabase]);

  useEffect(() => {
    if (!user) return;

    loadProfile();
    loadListings();
    loadSales();
    loadPurchases();
    loadReports();

    const channel = supabase
      .channel(`profile:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, () => loadProfile())
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => loadListings())
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, () => {
        loadSales();
        loadPurchases();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => loadReports())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, loadProfile, loadListings, loadSales, loadPurchases, loadReports]);

  const displayUser = appUser ?? contextProfile ?? null;
  const profileStillLoading = Boolean(user) && (isProfileLoading || profileLoading) && !displayUser;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/signin");
  };

  const hideListingFromReport = async (report: Report) => {
    if (!isAdmin) return;
    setBusyReportId(report.id);
    try {
      await adminHideListing(supabase, report.id);
      await loadReports();
      toast({ title: "Listing hidden", description: "Removed from browse. The seller was notified." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Could not hide listing", description: formatAdminReportError(error) });
    } finally {
      setBusyReportId(null);
    }
  };

  const dismissReport = async (reportId: string) => {
    if (!isAdmin) return;
    setBusyReportId(reportId);
    try {
      await adminDismissReport(supabase, reportId);
      await loadReports();
      toast({ title: "Report dismissed", description: "Listing left unchanged." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Could not dismiss report", description: formatAdminReportError(error) });
    } finally {
      setBusyReportId(null);
    }
  };

  if (!user) {
    return (
      <div className="mp-page-center">
        <h2>Please log in</h2>
        <p className="mp-muted-text">Log in to view your marketplace profile.</p>
        <div className="mp-page-center-actions">
          <Link className="btn btn-primary" href="/signin">
            Log In
          </Link>
        </div>
      </div>
    );
  }

  if (profileStillLoading) {
    return (
      <div className="mp-page-center">
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!displayUser) {
    return (
      <div className="mp-page-center">
        <h2>Could not load profile</h2>
        <p className="mp-muted-text">
          {profileError || "Your marketplace profile could not be loaded. Try refreshing the page."}
        </p>
        <div className="mp-page-center-actions">
          <button type="button" className="btn btn-primary" onClick={() => loadProfile()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: "listings", label: "My Listings" },
    { id: "sales", label: "My Sales" },
    { id: "purchases", label: "Purchase History" },
    ...(isAdmin ? [{ id: "reports", label: "Reports" }] : []),
  ];

  return (
    <div className="stack">
      <Card className="mp-profile-header-card">
        <span className="avatar avatar-lg mp-profile-avatar">
          {displayUser.name.charAt(0)}
        </span>
        <div className="mp-profile-header-body">
          <h1 className="mp-profile-name">{displayUser.name}</h1>
          {displayUser.isVerified && (
            <div className="mp-profile-verified">
              <i className="ti ti-shield-check" /> Verified Student
            </div>
          )}
          <p className="mp-profile-joined">
            Joined in {new Date().getFullYear()}
          </p>
        </div>
        <div className="mp-profile-header-actions">
          <Link className="btn btn-sm" href="/marketplace/profile/edit">
            <i className="ti ti-edit" /> Edit Profile
          </Link>
          {user && (
            <button type="button" className="btn btn-sm" onClick={() => setConfirmLogout(true)}>
              <i className="ti ti-logout" /> Log Out
            </button>
          )}
        </div>
      </Card>

      <Tabs
        tabs={TABS}
        defaultTab="listings"
        panes={[
          {
            id: "listings",
            content: (
              <Card>
                <h3 className="mp-section-title">Your Listings ({userListings.length})</h3>
                {isListingsLoading ? (
                  <p className="mp-empty-state-sm">Loading your listings...</p>
                ) : userListings.length > 0 ? (
                  <div className="products-grid">
                    {userListings.map((product) => (
                      <div key={product.id} className="stack">
                        <ProductCard product={product} />
                        <SellerListingStatusControls
                          product={product}
                          onUpdated={(next) =>
                            setUserListings((prev) => prev.map((p) => (p.id === next.id ? next : p)))
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mp-empty-state">
                    <h3>No listings yet</h3>
                    <p>When you list an item for sale, it will appear here.</p>
                  </div>
                )}
              </Card>
            ),
          },
          {
            id: "sales",
            content: (
              <Card>
                <h3 className="mp-section-title">Your Sales History</h3>
                {isSalesLoading ? (
                  <p className="mp-loading-text">Loading…</p>
                ) : userSales.length > 0 ? (
                  <Table
                    columns={[
                      { key: "productName", label: "Item", render: (r) => `${r.productName}` },
                      { key: "price", label: "Price", render: (r) => `RM ${r.price.toFixed(2)}` },
                      { key: "buyerName", label: "Buyer" },
                      {
                        key: "purchaseDate",
                        label: "Date",
                        render: (r) => (r.purchaseDate?.toDate ? new Date(r.purchaseDate.toDate()).toLocaleDateString() : "N/A"),
                      },
                    ]}
                    rows={userSales}
                    emptyLabel="No sales yet"
                  />
                ) : (
                  <p className="mp-empty-state-sm">
                    Successful sales will appear here.
                  </p>
                )}
              </Card>
            ),
          },
          {
            id: "purchases",
            content: (
              <Card>
                <h3 className="mp-section-title">Your Purchase History</h3>
                {isPurchasesLoading ? (
                  <p className="mp-loading-text">Loading…</p>
                ) : purchaseHistory.length > 0 ? (
                  <Table
                    columns={[
                      { key: "productName", label: "Item" },
                      { key: "price", label: "Price", render: (r) => `RM ${r.price.toFixed(2)}` },
                      { key: "sellerName", label: "Seller" },
                      {
                        key: "purchaseDate",
                        label: "Date",
                        render: (r) => (r.purchaseDate?.toDate ? new Date(r.purchaseDate.toDate()).toLocaleDateString() : "N/A"),
                      },
                      {
                        key: "status",
                        label: "Status",
                        render: (r) => <Badge tone={r.status === "Successful" ? "success" : "neutral"}>{r.status}</Badge>,
                      },
                    ]}
                    rows={purchaseHistory}
                    emptyLabel="No purchases yet"
                  />
                ) : (
                  <p className="mp-empty-state-sm">
                    Items you buy will appear here.
                  </p>
                )}
              </Card>
            ),
          },
          ...(isAdmin
            ? [
                {
                  id: "reports",
                  content: (
                    <Card>
                      <h3 className="mp-section-title">Open reports ({reports.length})</h3>
                      {isReportsLoading ? (
                        <p className="mp-loading-text">Loading…</p>
                      ) : reports.length > 0 ? (
                        <Table
                          columns={[
                            {
                              key: "productName",
                              label: "Product",
                              render: (r) => (
                                <Link href={`/marketplace/products/${r.productId}`} className="mp-brand-link">
                                  {r.productName}
                                </Link>
                              ),
                            },
                            { key: "reason", label: "Reason" },
                            { key: "reportedBy", label: "Reported By", render: (r) => r.reportedBy.name },
                            {
                              key: "date",
                              label: "Date",
                              render: (r) => (r.date?.toDate ? new Date(r.date.toDate()).toLocaleDateString() : "N/A"),
                            },
                            {
                              key: "actions",
                              label: "Actions",
                              render: (r) => (
                                <div className="mp-actions-row">
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    disabled={busyReportId !== null}
                                    onClick={() => hideListingFromReport(r)}
                                  >
                                    {busyReportId === r.id ? "Working…" : "Hide listing"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    disabled={busyReportId !== null}
                                    onClick={() => dismissReport(r.id)}
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              ),
                            },
                          ]}
                          rows={reports}
                          emptyLabel="No open reports"
                        />
                      ) : (
                        <p className="mp-empty-state-sm">All clear!</p>
                      )}
                    </Card>
                  ),
                },
              ]
            : []),
        ]}
      />

      <Dialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title="Are you sure you want to log out?"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirmLogout(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleLogout}>
              Log Out
            </button>
          </>
        }
      >
        <p className="mp-dialog-muted">You will be returned to the sign-in page.</p>
      </Dialog>
    </div>
  );
}

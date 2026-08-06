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
import type { Product, Purchase, Report, User as AppUser } from "@/lib/marketplace/types";
import { adminDismissReport, adminHideListing, formatAdminReportError } from "../_lib/admin-reports";

export default function MarketplaceProfilePage() {
  const { user, supabase } = useSession();
  const { isAdmin } = useMarketplaceUser();
  const router = useRouter();
  const { toast } = useToast();

  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [userListings, setUserListings] = useState<Product[]>([]);
  const [userSales, setUserSales] = useState<Purchase[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<Purchase[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const [isListingsLoading, setIsListingsLoading] = useState(true);
  const [isSalesLoading, setIsSalesLoading] = useState(true);
  const [isPurchasesLoading, setIsPurchasesLoading] = useState(true);
  const [isReportsLoading, setIsReportsLoading] = useState(true);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setAppUser(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    setAppUser(data ? mapProfileToUser(data as ProfileRow) : null);
  }, [user, supabase]);

  const loadListings = useCallback(async () => {
    if (!user) return;
    setIsListingsLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*, profiles:seller_id(*)")
      .eq("seller_id", user.id)
      .order("date_added", { ascending: false });
    setUserListings((data as ProductRow[] | null)?.map(mapProductRow) ?? []);
    setIsListingsLoading(false);
  }, [user, supabase]);

  const loadSales = useCallback(async () => {
    if (!user) return;
    setIsSalesLoading(true);
    const { data } = await supabase
      .from("purchases")
      .select("*")
      .eq("seller_id", user.id)
      .eq("status", "Successful")
      .order("purchase_date", { ascending: false });
    setUserSales((data as PurchaseRow[] | null)?.map(mapPurchaseRow) ?? []);
    setIsSalesLoading(false);
  }, [user, supabase]);

  const loadPurchases = useCallback(async () => {
    if (!user) return;
    setIsPurchasesLoading(true);
    const { data } = await supabase
      .from("purchases")
      .select("*")
      .eq("buyer_id", user.id)
      .order("purchase_date", { ascending: false });
    setPurchaseHistory((data as PurchaseRow[] | null)?.map(mapPurchaseRow) ?? []);
    setIsPurchasesLoading(false);
  }, [user, supabase]);

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
    if (!user) {
      setIsListingsLoading(false);
      setIsSalesLoading(false);
      setIsPurchasesLoading(false);
      setIsReportsLoading(false);
      return;
    }

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

  if (!user && !appUser) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <h2>Please log in</h2>
        <p style={{ color: "var(--muted)" }}>Log in to view your marketplace profile.</p>
        <div style={{ marginTop: 16 }}>
          <Link className="btn btn-primary" href="/signin">
            Log In
          </Link>
        </div>
      </div>
    );
  }

  if (!appUser) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <p>Loading profile...</p>
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
      <Card style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <span className="avatar avatar-lg" style={{ fontSize: 30, width: 80, height: 80 }}>
          {appUser.name.charAt(0)}
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0 }}>{appUser.name}</h1>
          {appUser.isVerified && (
            <div style={{ color: "var(--success)", fontSize: 13, fontWeight: 700 }}>
              <i className="ti ti-shield-check" /> Verified Student
            </div>
          )}
          <p style={{ color: "var(--muted)", margin: "4px 0 0" }}>
            Joined in {new Date().getFullYear()}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
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
                <h3 style={{ marginTop: 0 }}>Your Listings ({userListings.length})</h3>
                {isListingsLoading ? (
                  <p style={{ color: "var(--muted)", textAlign: "center", padding: "30px 0" }}>
                    Loading your listings...
                  </p>
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
                  <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>
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
                <h3 style={{ marginTop: 0 }}>Your Sales History</h3>
                {isSalesLoading ? (
                  <p style={{ color: "var(--muted)" }}>Loading…</p>
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
                  <p style={{ color: "var(--muted)", textAlign: "center", padding: "30px 0" }}>
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
                <h3 style={{ marginTop: 0 }}>Your Purchase History</h3>
                {isPurchasesLoading ? (
                  <p style={{ color: "var(--muted)" }}>Loading…</p>
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
                  <p style={{ color: "var(--muted)", textAlign: "center", padding: "30px 0" }}>
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
                      <h3 style={{ marginTop: 0 }}>Open reports ({reports.length})</h3>
                      {isReportsLoading ? (
                        <p style={{ color: "var(--muted)" }}>Loading…</p>
                      ) : reports.length > 0 ? (
                        <Table
                          columns={[
                            {
                              key: "productName",
                              label: "Product",
                              render: (r) => (
                                <Link href={`/marketplace/products/${r.productId}`} style={{ color: "var(--brand)", fontWeight: 700 }}>
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
                                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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
                        <p style={{ color: "var(--muted)", textAlign: "center", padding: "30px 0" }}>All clear!</p>
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
        <p style={{ color: "var(--muted)", fontSize: 14 }}>You will be returned to the sign-in page.</p>
      </Dialog>
    </div>
  );
}

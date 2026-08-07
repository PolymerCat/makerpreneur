import { describe, it, expect } from "vitest";
import { mapProductRow, mapProfileToUser, ProfileRow } from "./mappers";

function profile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "u1",
    name: "",
    email: "",
    avatar_url: "",
    is_verified: false,
    ...overrides,
  };
}

describe("mapProfileToUser", () => {
  it("uses the profile name when set", () => {
    expect(mapProfileToUser(profile({ name: "Faiq Firdaus" })).name).toBe(
      "Faiq Firdaus"
    );
  });

  it("derives a display name from the email when name is empty", () => {
    expect(
      mapProfileToUser(
        profile({ email: "faiq.firdaus@student.usm.my" })
      ).name
    ).toBe("Faiq Firdaus");
  });

  it("falls back to Student when neither name nor email exists", () => {
    expect(mapProfileToUser(profile()).name).toBe("Student");
  });
});

describe("mapProductRow", () => {
  it("shows the seller's real name on listing cards, not Student", () => {
    const product = mapProductRow({
      id: "p1",
      name: "Calculator",
      description: "fx-570",
      price: 40,
      category_id: "c1",
      category_name: "Electronics",
      seller_id: "u1",
      image_urls: [],
      date_added: new Date().toISOString(),
      profiles: profile({ email: "nurul.aisyah@student.usm.my" }),
    });
    expect(product.seller.name).toBe("Nurul Aisyah");
  });
});

import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <Card className="auth-card">
        <div className="brand-block" style={{ marginBottom: "24px" }}>
          <img src="/logo-crest.webp" alt="USM Crest Logo" className="brand-mark" style={{ objectFit: "contain", padding: "2px", background: "#fff" }} />
          <div>
            <strong>StudentHub USM</strong>
            <span>Campus workspace</span>
          </div>
        </div>
        
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0", borderBottom: "2px solid var(--line)", marginBottom: "20px" }}>
          <img src="/logo-apex.webp" alt="USM APEX Branding" style={{ height: "48px", objectFit: "contain" }} />
        </div>

        <form className="form-stack">
          <label>
            Email or matric number
            <input defaultValue="julita@student.usm.my" />
          </label>
          <label>
            Password
            <input defaultValue="password" type="password" />
          </label>
          <ButtonLink href="/" icon="ti-login" variant="primary">
            Sign in
          </ButtonLink>
          <button className="secondary-button" type="button">
            <Icon name="ti-school" />
            Continue with USM ID
          </button>
        </form>
      </Card>
    </main>
  );
}

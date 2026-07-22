import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <Card className="auth-card">
        <div className="brand-block">
          <span className="brand-mark">SH</span>
          <div>
            <strong>StudentHub USM</strong>
            <span>Campus workspace</span>
          </div>
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

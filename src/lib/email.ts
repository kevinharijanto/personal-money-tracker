import { createTransport } from "nodemailer";

/**
 * NextAuth EmailProvider verification request sender (kept for compatibility).
 * Requires EMAIL_SERVER and EMAIL_FROM to be set.
 */
export async function sendVerificationRequest(params: {
  identifier: string;
  url: string;
  provider: any;
  theme?: any;
}) {
  const { identifier: email, url, provider } = params;
  const { server, from } = provider;
  const transport = createTransport(server);

  const result = await transport.sendMail({
    to: email,
    from,
    subject: "Sign in to Personal Money Tracker",
    text: `Sign in to Personal Money Tracker\n\n${url}\n\n`,
    html: `
      <div style="font-family: sans-serif;">
        <h3>Sign in to Personal Money Tracker</h3>
        <p>Click the link below to sign in:</p>
        <p><a href="${url}">${url}</a></p>
        <p>If you didn't request this email, you can safely ignore it.</p>
      </div>
    `,
  });

  const failed = result.rejected.filter(Boolean);
  if (failed.length) {
    throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`);
  }
}

/**
 * Internal: get Nodemailer transport and from-address from environment.
 * EMAIL_SERVER (SMTP URI) and EMAIL_FROM must be configured.
 */
function getTransport() {
  const server = process.env.EMAIL_SERVER;
  const from = process.env.EMAIL_FROM;
  if (!server || !from) {
    throw new Error("EMAIL_SERVER and EMAIL_FROM must be configured in environment");
  }
  return { transport: createTransport(server), from };
}

/**
 * Send account verification email after signup (credentials flow).
 * The link points to /api/auth/verify-email and expires per token policy.
 */
export async function sendAccountVerificationEmail(toEmail: string, token: string) {
  const { transport, from } = getTransport();
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:7777";
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  const result = await transport.sendMail({
    to: toEmail,
    from,
    subject: "Verify your email - Personal Money Tracker",
    text: `Welcome!\n\nPlease verify your email by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `
      <div style="font-family: sans-serif; line-height:1.6;">
        <h2>Welcome to Personal Money Tracker</h2>
        <p>Please verify your email address to activate your account.</p>
        <p>
          <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:6px;">
            Verify Email
          </a>
        </p>
        <p>If the button doesn't work, copy and paste this URL into your browser:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>This link expires in 24 hours.</p>
      </div>
    `,
  });

  const failed = result.rejected.filter(Boolean);
  if (failed.length) {
    throw new Error(`Verification email could not be sent to: ${failed.join(", ")}`);
  }
}

/**
 * Send household invitation email to a prospective member.
 * Includes inviter identity and a link to review/accept the invitation.
 */
export async function sendInvitationEmail(params: {
  toEmail: string;
  invitationToken: string;
  householdName: string;
  invitedBy: { name?: string | null; email: string };
}) {
  const { toEmail, invitationToken, householdName, invitedBy } = params;
  const { transport, from } = getTransport();
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:7777";
  const reviewUrl = `${baseUrl}/api/invitations/accept?token=${encodeURIComponent(invitationToken)}`;
  const inviterLabel = invitedBy.name ? `${invitedBy.name} <${invitedBy.email}>` : invitedBy.email;

  const result = await transport.sendMail({
    to: toEmail,
    from,
    subject: `Invitation to join household "${householdName}"`,
    text: `You have been invited to join the household "${householdName}" by ${inviterLabel}.\n\nReview the invitation:\n${reviewUrl}\n\nIf you don't have an account yet, sign up with this email, then open the link again to accept.`,
    html: `
      <div style="font-family: sans-serif; line-height:1.6;">
        <h2>Household Invitation</h2>
        <p>You have been invited to join the household <strong>${householdName}</strong>.</p>
        <p><strong>Invited by:</strong> ${inviterLabel}</p>
        <p>
          <a href="${reviewUrl}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;">
            Review Invitation
          </a>
        </p>
        <p>If you don't have an account yet, sign up using this email address, then click the link again to accept.</p>
        <p>If the button doesn't work, copy and paste this URL into your browser:</p>
        <p><a href="${reviewUrl}">${reviewUrl}</a></p>
      </div>
    `,
  });

  const failed = result.rejected.filter(Boolean);
  if (failed.length) {
    throw new Error(`Invitation email could not be sent to: ${failed.join(", ")}`);
  }
}
import { ResetPasswordForm } from "./ResetForm";

type ResetPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ResetPasswordPage({ params }: ResetPageProps) {
  const { token } = await params;
  return <ResetPasswordForm token={token} />;
}

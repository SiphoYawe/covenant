import { AppLayout } from '@/components/layout/app-layout';

export default function DeployLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}

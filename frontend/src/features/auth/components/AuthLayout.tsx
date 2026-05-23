import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function AuthLayout({ children }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">{children}</div>
  );
}

import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function AuthCard({ children }: Props) {
  return <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">{children}</div>;
}

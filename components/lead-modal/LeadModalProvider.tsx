"use client";

import { LeadModalProvider as Provider } from "./LeadModalContext";
import LeadModal from "./LeadModal";

export default function LeadModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Provider>
      {children}
      <LeadModal />
    </Provider>
  );
}
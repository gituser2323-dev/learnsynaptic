"use client";

import dynamic from "next/dynamic";
import { LeadModalProvider as Provider } from "./LeadModalContext";

// Code splitting (Module 10 performance audit): this provider — and so
// this import — is mounted once in the root layout, meaning it's part
// of every single page's bundle. LeadModal itself (+ LeadForm,
// SuccessScreen, framer-motion's AnimatePresence usage) is only ever
// visible after a user interacts with a trigger; splitting it into its
// own chunk keeps that weight out of the critical initial bundle.
// ssr: false because the modal starts closed and renders nothing on the
// server regardless — no hydration mismatch risk.
const LeadModal = dynamic(() => import("./LeadModal"), { ssr: false });

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
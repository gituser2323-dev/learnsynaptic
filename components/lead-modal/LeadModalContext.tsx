"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";

export interface LeadModalOptions {
  title?: string;
  subtitle?: string;
  program?: string;
  source?: string;
  cta?: string;
}

interface LeadModalContextType {
  open: boolean;
  options: LeadModalOptions;

  openModal: (options?: LeadModalOptions) => void;
  closeModal: () => void;
}

const LeadModalContext = createContext<
  LeadModalContextType | undefined
>(undefined);

export function LeadModalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const [options, setOptions] =
    useState<LeadModalOptions>({
      title: "Reserve Free Demo",
      subtitle:
        "Join India's fastest growing AI learning community.",
      cta: "Reserve My Seat",
    });

  function openModal(
    opts: LeadModalOptions = {}
  ) {
    setOptions((prev) => ({
      ...prev,
      ...opts,
    }));

    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  return (
    <LeadModalContext.Provider
      value={{
        open,
        options,
        openModal,
        closeModal,
      }}
    >
      {children}
    </LeadModalContext.Provider>
  );
}

export function useLeadModal() {
  const context = useContext(LeadModalContext);

  if (!context) {
    throw new Error(
      "useLeadModal must be used inside LeadModalProvider"
    );
  }

  return context;
}
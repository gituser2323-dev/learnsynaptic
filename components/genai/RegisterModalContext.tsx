"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface RegisterModalContextValue {
  isRegisterOpen: boolean;
  isSuccessOpen: boolean;
  registeredName: string;
  openRegister: () => void;
  closeRegister: () => void;
  openSuccess: (name: string) => void;
  closeSuccess: () => void;
}

const RegisterModalContext = createContext<RegisterModalContextValue | null>(null);

export function RegisterModalProvider({ children }: { children: React.ReactNode }) {
  const [isRegisterOpen, setRegisterOpen] = useState(false);
  const [isSuccessOpen, setSuccessOpen] = useState(false);
  const [registeredName, setRegisteredName] = useState("");

  const openRegister = useCallback(() => setRegisterOpen(true), []);
  const closeRegister = useCallback(() => setRegisterOpen(false), []);
  const openSuccess = useCallback((name: string) => {
    setRegisteredName(name);
    setRegisterOpen(false);
    setSuccessOpen(true);
  }, []);
  const closeSuccess = useCallback(() => setSuccessOpen(false), []);

  const value = useMemo(
    () => ({
      isRegisterOpen,
      isSuccessOpen,
      registeredName,
      openRegister,
      closeRegister,
      openSuccess,
      closeSuccess,
    }),
    [isRegisterOpen, isSuccessOpen, registeredName, openRegister, closeRegister, openSuccess, closeSuccess],
  );

  return <RegisterModalContext.Provider value={value}>{children}</RegisterModalContext.Provider>;
}

export function useRegisterModal() {
  const ctx = useContext(RegisterModalContext);
  if (!ctx) throw new Error("useRegisterModal must be used within RegisterModalProvider");
  return ctx;
}

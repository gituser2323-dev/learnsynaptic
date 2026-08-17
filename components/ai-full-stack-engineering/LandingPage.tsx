import dynamic from "next/dynamic";
import "./landing.css";
import { RegisterModalProvider } from "./RegisterModalContext";
import { FloatingCTA } from "./FloatingCTA";
import { Hero } from "./sections/Hero";
import { AwarenessCards } from "./sections/AwarenessCards";
import { ProblemAwareness } from "./sections/ProblemAwareness";
import { FounderIntroCTA } from "./sections/FounderIntroCTA";
import { AudienceComparison } from "./sections/AudienceComparison";
import { Testimonials } from "./sections/Testimonials";
import { ProjectsCurriculum } from "./sections/ProjectsCurriculum";
import { MentorBonuses } from "./sections/MentorBonuses";
import { FaqClosing } from "./sections/FaqClosing";

// Code splitting (Module 10 performance audit): both modals are only
// ever shown after a user interacts with a trigger elsewhere on this
// page — splitting them out of the main chunk keeps that weight off the
// critical initial bundle. No ssr:false here: this file is a Server
// Component (no "use client"), where next/dynamic disallows ssr:false —
// plain dynamic() still code-splits and stays SSR-compatible.
const RegistrationModal = dynamic(() => import("./RegistrationModal").then((mod) => mod.RegistrationModal));
const SuccessModal = dynamic(() => import("./SuccessModal").then((mod) => mod.SuccessModal));

export function AiFullStackLandingPage() {
  return (
    <RegisterModalProvider>
      <div className="aib-root">
        <div style={{ paddingBottom: 76 }}>
          <Hero />
          <AwarenessCards />
          <ProblemAwareness />
          <FounderIntroCTA />
          <AudienceComparison />
          <Testimonials />
          <ProjectsCurriculum />
          <MentorBonuses />
          <FaqClosing />
        </div>
        <FloatingCTA />
      </div>
      <RegistrationModal />
      <SuccessModal />
    </RegisterModalProvider>
  );
}

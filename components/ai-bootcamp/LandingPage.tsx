import "./ai-bootcamp.css";
import { RegisterModalProvider } from "./RegisterModalContext";
import { RegistrationModal } from "./RegistrationModal";
import { SuccessModal } from "./SuccessModal";
import { FloatingCTA } from "./FloatingCTA";
import { Hero } from "./sections/Hero";
import { ProblemAwareness } from "./sections/ProblemAwareness";
import { FounderIntroCTA } from "./sections/FounderIntroCTA";
import { AudienceComparison } from "./sections/AudienceComparison";
import { ProjectsCurriculum } from "./sections/ProjectsCurriculum";
import { MentorBonuses } from "./sections/MentorBonuses";
import { FaqClosing } from "./sections/FaqClosing";

export function AiBootcampLandingPage() {
  return (
    <RegisterModalProvider>
      <div className="aib-root">
        <div style={{ paddingBottom: 76 }}>
          <Hero />
          <ProblemAwareness />
          <FounderIntroCTA />
          <AudienceComparison />
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

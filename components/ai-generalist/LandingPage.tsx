import "./ai-generalist.css";
import { LanguageProvider } from "./LanguageContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { RegisterModalProvider } from "./RegisterModalContext";
import { RegistrationModal } from "./RegistrationModal";
import { SuccessModal } from "./SuccessModal";
import { FloatingCTA } from "./FloatingCTA";
import { Hero } from "./sections/Hero";
import { AwarenessCards } from "./sections/AwarenessCards";
import { ProblemAwareness } from "./sections/ProblemAwareness";
import { FounderIntroCTA } from "./sections/FounderIntroCTA";
import { AudienceComparison } from "./sections/AudienceComparison";
import { ProjectsCurriculum } from "./sections/ProjectsCurriculum";
import { MentorBonuses } from "./sections/MentorBonuses";
import { FaqClosing } from "./sections/FaqClosing";

export function AiGeneralistLandingPage() {
  return (
    <LanguageProvider>
      <RegisterModalProvider>
        <div className="aig-root">
          <LanguageSwitcher />
          <div style={{ paddingBottom: 76 }}>
            <Hero />
            <AwarenessCards />
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
    </LanguageProvider>
  );
}

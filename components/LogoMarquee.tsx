const partners = [
  "Wipro",
  "TCS",
  "Infosys",
  "Deloitte",
  "Accenture",
  "Cognizant",
  "HCL",
  "Tech Mahindra",
  "Persistent",
  "KPMG",
  "IBM",
  "Oracle",
  "Capgemini",
  "Mphasis",
  "Hexaware",
];

export function LogoMarquee() {
  const items = [...partners, ...partners];

  return (
    <section className="border-y border-slate-200 bg-white py-10 overflow-hidden">

      <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
        Our Graduates Are Working At
      </p>

      <div className="relative overflow-hidden">

        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent z-10" />

      <div className="flex animate-marquee gap-8 whitespace-nowrap">
  {items.map((company, index) => (
    <div
      key={`${company}-${index}`}
      className="flex items-center gap-8 shrink-0"
    >
      <span className="text-base font-medium text-slate-500 hover:text-slate-800 transition">
        {company}
      </span>

      <span className="text-slate-200 text-xl">•</span>
    </div>
  ))}
</div>

      </div>

    </section>
  );
}
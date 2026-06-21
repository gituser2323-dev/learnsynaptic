# LearnSynaptic Design Skill — SKILL.md
Read this file in full before building or modifying any UI. These rules
are FINAL and locked — do not introduce new colors, dark mode, 3D, or
bento grids regardless of what any other reference suggests.

Benchmarked against: Simplilearn, Edureka, Great Learning, Coursera.

---

## 1. Color tokens (FINAL — locked, do not deviate)

```css
--ls-blue-primary:   #1447E6   /* UPDATED — CTA buttons, links, active states */
--ls-blue-hover:     #0f3ac0   /* hover/active state of primary blue */
--ls-blue-tint:      #EFF6FF   /* badge pills, icon containers, light accents */
--ls-hero-bg:        #F6FAFE   /* UPDATED — hero section background only */
--ls-background:     #FFFFFF   /* primary background for all other sections */
--ls-background-alt: #F8FAFC   /* alternating section background */
--ls-text-primary:   #18181B   /* headlines, body text */
--ls-text-muted:      #71717A   /* secondary text, captions, subheadlines */
--ls-border:          #E4E4E7   /* card borders, dividers */
--ls-success:         #16A34A   /* placement %, positive stats only */
```

Hard rules:
- Light mode only. Never introduce a dark section, dark hero, or dark footer.
- Never use Three.js, WebGL, Canvas-based 3D, or any GPU-heavy visual.
- Never use a bento grid (mixed tile sizes). All grids are equal-sized cells.
- Never use Tailwind's default blue-500/600/indigo-600 etc. Always
  `#1447E6` exactly for CTAs/buttons/links, defined as a CSS variable or
  Tailwind theme color, never hardcoded inline in multiple places.
- Hero section background is `#F6FAFE` specifically — all other sections
  use `#FFFFFF` or `#F8FAFC` per the alternating pattern below.

---

## 2. Typography

- Font: Inter (or a near-identical clean grotesque sans). Load via
  next/font for performance.
- Headline weight: 700-800, tight tracking (-0.02em) on H1/H2 only.
- Body: 400-500 weight, line-height 1.6+, color `--ls-text-muted` for
  supporting text, `--ls-text-primary` for emphasis/headlines.
- Scale: H1 44-56px / H2 32-36px / H3 22-26px / body 16-18px / caption 13-14px.
- Numbers in stat bands get their own oversized treatment: 40-56px, bold,
  `--ls-blue-primary` or `--ls-text-primary`, with a small muted label below.

---

## 3. Layout and spacing (this is where "next-level" actually lives)

Generic AI output fails on RHYTHM, not color. These rules fix that:

- **8px base grid**, but vary section padding deliberately: hero gets
  100-140px vertical padding, standard sections 64-96px, dense
  content sections (curriculum, FAQ) 48-64px. Don't use the same
  padding everywhere — that sameness is what reads as templated.
- **Asymmetric width, not full-bleed-everything**: text content max-width
  640-720px for paragraphs even inside wide sections — long line lengths
  read as unpolished. Headlines can go wider (max-width 900-1000px).
- **Card grids**: equal-sized cells, but vary INTERNAL card padding by
  content density (a pricing card needs more breathing room than a
  feature-icon card). 24-32px gap between cards, never less than 20px.
- **One asymmetric or off-center element per page**, used deliberately,
  not everywhere: e.g. a program page's curriculum module list can be
  two-column with a sticky sidebar nav, not just stacked centered blocks.
  This single break from pure-center-everything is what separates a
  considered layout from a generated one.
- **Visual hierarchy via size + weight, not color**: don't reach for a
  new blue tint to create hierarchy. A heavier weight and larger size on
  the primary element, lighter/smaller/muted on secondary, is enough.

---

## 4. Component patterns

**Hero**: badge pill (`--ls-blue-tint` bg, `--ls-blue-primary` text) above
H1. Centered, max-width ~900px. H1 2 lines max, bold, `--ls-text-primary`.
Subheadline directly below, `--ls-text-muted`, max-width ~640px. Two CTAs
side by side: solid primary (`--ls-blue-primary` bg, white text) + outline
secondary (white bg, `--ls-border` border, `--ls-text-primary` text). Row
of 3 trust-stat checkmarks below CTAs, small icon + short stat text.

**Program cards**: badge/tag, title, rating stars + review count
(optional), duration chip, numbered "what you'll build" list (max 3
points), CTA pair ("Explore Program" + "Download Brochure"). White bg,
`--ls-border` border, subtle shadow ONLY on hover (box-shadow with low
opacity, transition 200ms) — never a permanent shadow, that's dated.

**Stat band**: 3-4 numbers in a row, oversized per Typography rules,
generous gap (48-64px between stat blocks), centered or left-aligned
consistently across the row.

**Testimonial cards**: avatar (or initials fallback), name, before-role
to now-role transition (explicit format: "Backend Dev at X -> Software
Engineer at Y"), short quote (2-3 lines max), outcome badge if relevant.

**Curriculum/module lists** (for program detail pages): numbered modules,
each with a short description and 3-5 bullet topics, collapsed/expandable
if the list exceeds ~6 modules to avoid overwhelming scroll length.

**FAQ**: accordion, grouped by category (Programs / Pricing / Placement),
plain border-bottom dividers between items, no card wrapping per item.

**Footer**: dense, SEO-structured — program links, resources, company,
legal, socials. 4-column on desktop. Include Pune address + pan-India
note in the company column.

---

## 5. Motion (Framer Motion only — no 3D)

- Entrance: fade + slight upward translate (12-16px) on scroll-into-view,
  staggered by 60-80ms per item in a grid/list. Duration 400-500ms,
  ease-out.
- Hover: card lift (translateY -2 to -4px) + shadow fade-in, 150-200ms.
- Hero headline: ONE subtle effect on page load only — word or line
  reveal, not on every scroll, not repeated on re-render.
- Never animate layout-shifting properties (width/height) on scroll —
  causes jank. Stick to opacity/transform.
- Respect prefers-reduced-motion — disable non-essential animation
  for users who request it.

---

## 6. Content and marketing psychology (apply throughout, don't overdo)

- **Social proof**: real-feeling stat bands, named testimonials with
  explicit role transitions, placement company logos/cards.
- **Authority**: founder section in first-person, specific numbers
  (batches run, years training) — not vague "expert mentors" language.
- **Urgency, used sparingly**: next-cohort dates or limited-seat framing
  on program pages and pricing — never more than one urgency element per
  page, never in a popup or sticky banner that feels aggressive.
- **Loss aversion in CTAs**: occasional phrasing like "Don't wait for the
  next cohort" — restrained, not present on every single button.
- Targeting: pan-India audience (students, 0-2 yr professionals), Pune
  origin mentioned naturally in About/Contact/footer — not the
  exclusive audience, just the credibility/origin story.

---

## 7. Anti-patterns (the actual "don't look generic" checklist)

- Don't use the same section padding value everywhere (see Layout rules)
- Don't make every grid item perfectly identical in internal spacing
- Don't add a permanent box-shadow to cards (hover-only)
- Don't use more than one accent color beyond the blue + success green
- Don't center every single element on every page — vary it once per page
- Don't skip real content for placeholder lorem-ipsum-style copy —
  write real, specific copy even in a first draft
- Don't apply dark mode, 3D, or bento grids under any circumstance —
  these are permanently out of scope for this project

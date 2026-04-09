import type { BusinessType, TemplateType } from "@prisma/client";
import type { StructuredProjectData } from "@/lib/types";

const baseStyles = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Inter, Arial, sans-serif;
    color: #111;
    background: #fff;
    line-height: 1.6;
  }
  .container {
    width: min(1100px, 92%);
    margin: 0 auto;
  }
  .hero {
    padding: 96px 0 72px;
    border-bottom: 1px solid #ececec;
  }
  .hero h1 {
    font-family: "Bebas Neue", Inter, Arial, sans-serif;
    letter-spacing: 0.02em;
    font-size: clamp(2.5rem, 9vw, 5.5rem);
    line-height: 0.95;
    margin: 0 0 18px;
  }
  .hero p {
    max-width: 700px;
    font-size: 1.08rem;
    color: #303030;
    margin: 0 0 26px;
  }
  .cta {
    display: inline-block;
    padding: 12px 20px;
    border-radius: 9999px;
    border: 1px solid #111;
    background: #111;
    color: #fff;
    text-decoration: none;
    font-weight: 600;
  }
  .section {
    padding: 70px 0;
    border-bottom: 1px solid #f1f1f1;
  }
  .section h2 {
    font-family: "Bebas Neue", Inter, Arial, sans-serif;
    letter-spacing: 0.02em;
    font-size: clamp(1.9rem, 5vw, 3.3rem);
    margin: 0 0 18px;
  }
  .grid {
    display: grid;
    gap: 18px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
  .card {
    border: 1px solid #e8e8e8;
    padding: 22px;
    border-radius: 14px;
    background: #fff;
  }
  .quote {
    border-left: 2px solid #111;
    margin: 0;
    padding: 0 0 0 16px;
    color: #222;
  }
  .footer {
    padding: 30px 0 50px;
    font-size: 0.92rem;
    color: #656565;
  }
  @media (max-width: 640px) {
    .hero {
      padding-top: 72px;
    }
  }
`;

function headingForBusinessType(type: BusinessType): string {
  switch (type) {
    case "LASH_ARTIST":
      return "Luxury Lash Artistry";
    case "LASH_EDUCATOR":
      return "Elite Lash Education";
    case "BEAUTY_ACADEMY":
      return "Beauty Academy";
    case "PERSONAL_BRAND":
      return "Beauty Personal Brand";
    case "SALON":
      return "Premium Salon Experience";
    case "PRODUCT_BRAND":
      return "Beauty Product Brand";
    default:
      return "Premium Beauty Brand";
  }
}

function servicesForType(type: BusinessType): string[] {
  switch (type) {
    case "LASH_ARTIST":
      return [
        "Classic Lash Sets",
        "Volume and Wispy Styling",
        "Refills and Maintenance Plans",
      ];
    case "LASH_EDUCATOR":
      return [
        "Beginner Lash Foundations",
        "Advanced Styling and Mapping",
        "Mentorship and Business Scaling",
      ];
    case "BEAUTY_ACADEMY":
      return [
        "Academy Programs",
        "Practical Certification Tracks",
        "Career Placement and Mentoring",
      ];
    case "PERSONAL_BRAND":
      return [
        "Signature Services",
        "Speaking and Masterclasses",
        "1:1 Strategic Consulting",
      ];
    case "SALON":
      return ["Lash and Brow Services", "Skin and Beauty Treatments", "VIP Membership Programs"];
    case "PRODUCT_BRAND":
      return ["Core Product Collection", "Pro Artist Kits", "Wholesale and Stockist Opportunities"];
    default:
      return ["Signature Services", "Premium Experience", "Results-focused Offers"];
  }
}

export function buildInitialWebsite(
  projectName: string,
  data: StructuredProjectData,
  template: TemplateType,
): { html: string; css: string; js: string } {
  const businessHeading = headingForBusinessType(data.businessType);
  const services = servicesForType(data.businessType);
  const heroTone =
    template === "EDITORIAL_LUXE"
      ? "Designed for modern beauty brands that lead with presence, precision, and premium results."
      : template === "MINIMAL_BOUTIQUE"
        ? "A refined digital home that turns your brand story into premium bookings and authority."
        : "Built to help your audience book, trust, and buy with confidence.";

  const html = `
  <main>
    <section class="hero">
      <div class="container">
        <h1>${projectName}</h1>
        <p>${businessHeading}. ${heroTone}</p>
        <a class="cta" href="#contact">${data.goalLabel || "Book your experience"}</a>
      </div>
    </section>

    <section class="section" id="about">
      <div class="container">
        <h2>About</h2>
        <p>${data.about || "We combine artistry, strategy, and premium client care to deliver standout beauty outcomes and a memorable brand experience."}</p>
      </div>
    </section>

    <section class="section" id="services">
      <div class="container">
        <h2>Signature Offers</h2>
        <div class="grid">
          ${services
            .map(
              (service) => `
            <article class="card">
              <h3>${service}</h3>
              <p>Crafted for clients who value expert execution and elevated results.</p>
            </article>
          `,
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="section" id="testimonials">
      <div class="container">
        <h2>Client Results</h2>
        <blockquote class="quote">“Absolutely premium from start to finish. The quality, detail, and professionalism are unmatched.”</blockquote>
      </div>
    </section>

    <section class="section" id="contact">
      <div class="container">
        <h2>Ready to Work Together?</h2>
        <p>${data.callToAction || "Let’s create your next beauty transformation."}</p>
      </div>
    </section>
  </main>
  `;

  return {
    html,
    css: baseStyles,
    js: "",
  };
}

function appendSection(html: string, title: string, content: string): string {
  const sectionMarkup = `
    <section class="section">
      <div class="container">
        <h2>${title}</h2>
        <p>${content}</p>
      </div>
    </section>
  `;
  return html.replace("</main>", `${sectionMarkup}\n</main>`);
}

function replaceHeroParagraph(html: string, paragraph: string): string {
  return html.replace(/<p>[\s\S]*?<\/p>/, `<p>${paragraph}</p>`);
}

export function applyConversationEdit(
  existing: { html: string; css: string; js: string },
  userMessage: string,
): { html: string; css: string; js: string; assistantReply: string } {
  const lower = userMessage.toLowerCase();
  let html = existing.html;
  let css = existing.css;
  let assistantReply = "I refined your site while preserving your structure and premium aesthetic.";

  if (lower.includes("luxury") || lower.includes("premium")) {
    css = `${css}
    .hero p { font-size: 1.14rem; max-width: 760px; }
    .section { padding: 86px 0; }
    .card { border-radius: 18px; padding: 26px; }
    `;
    assistantReply = "I elevated spacing, rhythm, and content presentation to feel more luxury and editorial.";
  }

  if (lower.includes("about") && (lower.includes("stronger") || lower.includes("improve"))) {
    html = html.replace(
      /(<section class="section" id="about">[\s\S]*?<p>)([\s\S]*?)(<\/p>)/,
      "$1Your brand blends technical excellence with thoughtful client experience, creating premium beauty outcomes that build trust, referrals, and long-term loyalty.$3",
    );
    assistantReply = "I strengthened your About section with clearer premium positioning and authority.";
  }

  if (lower.includes("add") && lower.includes("course")) {
    html = appendSection(
      html,
      "Course Overview",
      "This training is designed to help students master technique, client outcomes, and confident business execution with clear, practical frameworks.",
    );
    assistantReply = "I added a focused course section that fits naturally with your existing layout.";
  }

  if (lower.includes("gallery") || lower.includes("before/after")) {
    html = appendSection(
      html,
      "Before & After Gallery",
      "A curated gallery section has been reserved for your client transformations and portfolio highlights.",
    );
    assistantReply = "I added a gallery section to better showcase visual results.";
  }

  if (lower.includes("testimonial")) {
    html = appendSection(
      html,
      "Testimonials",
      "“Professional, polished, and results-focused. The client journey feels premium at every step.”",
    );
    assistantReply = "I added a stronger social proof section with testimonial styling.";
  }

  if (lower.includes("faq")) {
    html = appendSection(
      html,
      "Frequently Asked Questions",
      "Include your most common client questions around booking, prep, aftercare, training details, and policies.",
    );
    assistantReply = "I added a clear FAQ section to support conversions and reduce booking friction.";
  }

  if (lower.includes("reduce text") || lower.includes("less text")) {
    html = replaceHeroParagraph(html, "Premium beauty outcomes, crafted with precision and confidence.");
    assistantReply = "I tightened key copy to make your homepage cleaner and more impactful.";
  }

  if (lower.includes("book") && lower.includes("cta")) {
    html = html.replace(/Book your experience/g, "Book your appointment");
    assistantReply = "I updated your primary call-to-action to be more booking-focused.";
  }

  if (lower.includes("dramatic")) {
    css = `${css}
    .hero h1 { font-size: clamp(3rem, 10vw, 6.2rem); }
    `;
    assistantReply = "I made the homepage more dramatic with stronger heading scale and visual hierarchy.";
  }

  return { html, css, js: existing.js, assistantReply };
}

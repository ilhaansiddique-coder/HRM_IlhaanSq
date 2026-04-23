"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "How do I get started?",
    a: "Click 'Request access' and tell us about your business. Our team will review your request within 24 hours and provision a workspace for you. You'll receive login credentials by email.",
  },
  {
    q: "Why does it require approval?",
    a: "We manually review every workspace to ensure security, prevent abuse, and provide a high-quality experience. This also lets us preconfigure your workspace with the right plan and settings.",
  },
  {
    q: "Can I import data from my existing system?",
    a: "Yes. You can import products, customers and historical sales from CSV or directly from WooCommerce. Our team can help with bulk migrations on the Professional and Enterprise plans.",
  },
  {
    q: "What payment methods are supported?",
    a: "Cash, mobile banking (bKash, Nagad, Rocket), bank transfer and card payments. You can configure your own payment methods inside Settings.",
  },
  {
    q: "Which couriers do you integrate with?",
    a: "Steadfast and Pathao directly via API. Other couriers can be added via webhooks on the Enterprise plan.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All data is encrypted in transit and at rest. Each workspace is fully isolated using row-level security. We back up data daily and you can export your data anytime.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. There are no contracts. You can downgrade or cancel your subscription anytime from the billing page.",
  },
  {
    q: "Do you offer custom features?",
    a: "Enterprise customers get custom integrations, on-premise deployment options, and dedicated support. Reach out and we'll discuss your requirements.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-24 md:py-32 border-t border-border/60 bg-card/30">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Frequently asked
          </p>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
            Questions, answered.
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-12 space-y-2">
          {FAQS.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="rounded-xl border border-border/60 bg-card/60 px-5 data-[state=open]:bg-card"
            >
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

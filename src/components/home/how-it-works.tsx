import { Icon } from '@/components/icons';
import { steps } from '@/data/home';
import { SectionHeader } from './section-header';

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="mx-auto max-w-[1440px] scroll-mt-8 px-4 py-16 md:px-8 lg:px-16 lg:py-24"
    >
      <SectionHeader id="how-heading" title="Booked in three simple steps" />
      <ol className="mt-10 grid gap-6 md:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.title}
            className="bg-page shadow-card flex flex-col gap-4 rounded-lg p-8"
          >
            <span className="bg-dark text-on-dark inline-flex size-[52px] items-center justify-center rounded-full">
              <Icon name={step.icon} size={24} />
            </span>
            <h3 className="type-h3">{step.title}</h3>
            <p className="type-body-l text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

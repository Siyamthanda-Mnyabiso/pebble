// Plain data with no server imports, so client components can use it.
export const ADMIN_CHECKS = [
  { field: 'intro_video_reviewed', label: 'Intro video reviewed' },
  { field: 'portfolio_reviewed', label: 'Portfolio reviewed' },
  { field: 'contact_verified', label: 'Contact details verified' },
  { field: 'business_verified', label: 'Business info verified' },
  { field: 'category_requirements_met', label: 'Category requirements met' },
  { field: 'documents_checked', label: 'Documents checked' },
] as const;

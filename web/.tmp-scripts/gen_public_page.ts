import { PUBLIC_PAGE_TEMPLATES } from '../src/features/public-page-builder/templates';

const template = PUBLIC_PAGE_TEMPLATES.find((t) => t.id === 'beauty')!;
const doc = template.createDocument('zoomtestowner-page');

doc.slug = 'zoomtestowner';
doc.profile.displayName = 'Zoom Test Owner';
doc.profile.description = 'Zoom Marketplace review test account';
doc.seo.title = 'Zoom Test Owner — Book a session';
doc.seo.description = 'Test booking page for Zoom Marketplace app review.';

for (const section of doc.sections) {
  for (const block of section.blocks) {
    if (block.type === 'services') {
      (block.content as any).serviceIds = [23];
      (block.content as any).showBookingButton = true;
    }
    if (block.type === 'avatar') {
      (block.content as any).heading = 'Zoom Test Owner';
      (block.content as any).subtitle = 'Book a test session';
    }
  }
}

console.log(JSON.stringify(doc));

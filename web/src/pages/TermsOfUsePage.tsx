import { termsOfUseDocument } from '../content/legalDocuments';
import { LegalDocumentPage } from '../components/legal/LegalDocumentPage';

export function TermsOfUsePage() {
  return <LegalDocumentPage document={termsOfUseDocument} />;
}

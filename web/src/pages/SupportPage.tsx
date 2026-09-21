import { supportDocument } from '../content/legalDocuments';
import { LegalDocumentPage } from '../components/legal/LegalDocumentPage';

export function SupportPage() {
  return <LegalDocumentPage document={supportDocument} />;
}

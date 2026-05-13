import { privacyPolicyDocument } from '../content/legalDocuments';
import { LegalDocumentPage } from '../components/legal/LegalDocumentPage';

export function PrivacyPolicyPage() {
  return <LegalDocumentPage document={privacyPolicyDocument} />;
}

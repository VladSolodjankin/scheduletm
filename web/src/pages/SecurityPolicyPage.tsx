import { securityPolicyDocument } from '../content/legalDocuments';
import { LegalDocumentPage } from '../components/legal/LegalDocumentPage';

export function SecurityPolicyPage() {
  return <LegalDocumentPage document={securityPolicyDocument} />;
}

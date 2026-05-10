import type { Metadata } from 'next';

import { CadenceEditorView } from './cadence-editor-view';

export const metadata: Metadata = {
  title: 'Editar cadência',
};

interface PageProps {
  params: { id: string };
}

export default function CadenceDetailPage({ params }: PageProps) {
  return <CadenceEditorView id={params.id} />;
}

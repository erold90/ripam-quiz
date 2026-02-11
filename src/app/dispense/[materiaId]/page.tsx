import { DispensaMateriaClient } from '@/components/DispensaMateriaClient';

export default async function DispensaMateriaPage({
  params,
}: {
  params: Promise<{ materiaId: string }>;
}) {
  const { materiaId } = await params;
  return <DispensaMateriaClient materiaId={materiaId} />;
}

export function generateStaticParams() {
  return [
    { materiaId: 'diritto-ue' },
    { materiaId: 'contabilita-stato' },
    { materiaId: 'pubblico-impiego' },
  ];
}

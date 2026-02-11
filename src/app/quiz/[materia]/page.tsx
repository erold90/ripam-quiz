import QuizMateriaClient from './QuizMateriaClient';

// Genera i parametri statici per tutte le materie
export function generateStaticParams() {
  return [
    { materia: 'diritto-amministrativo' },
    { materia: 'diritto-penale' },
    { materia: 'trattamento-dati' },
    { materia: 'cad' },
    { materia: 'ordinamento' },
    { materia: 'inglese' },
    { materia: 'informatica' },
    { materia: 'contabilita-stato' },
    { materia: 'diritto-ue' },
    { materia: 'pubblico-impiego' },
    { materia: 'contratti-pubblici' },
    { materia: 'logica' },
    { materia: 'situazionali' },
  ];
}

export default function QuizMateriaPage({
  params,
}: {
  params: Promise<{ materia: string }>;
}) {
  return <QuizMateriaClient paramsPromise={params} />;
}

'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) { return <div className="access-notice" role="alert"><h1>Não foi possível carregar os dados</h1><p>Verifique se o banco de dados está disponível e tente novamente.</p><Button onClick={reset}>Tentar novamente</Button></div>; }

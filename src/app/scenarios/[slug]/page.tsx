import { notFound } from 'next/navigation';
import { scenarios } from '@/lib/scenarios';
import ScenarioChat from '@/components/scenario-chat';
export function generateStaticParams(){ return scenarios.map(scene=>({slug:scene.slug})); }
export default async function ScenarioRoom({params}:{params:Promise<{slug:string}>}){ const {slug}=await params; const scene=scenarios.find(item=>item.slug===slug); if(!scene)notFound(); return <ScenarioChat key={scene.slug} scene={scene}/>; }

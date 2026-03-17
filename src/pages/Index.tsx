import { Ribbon } from '@/components/Ribbon';
import { ComponentsSidebar } from '@/components/ComponentsSidebar';
import { PageCanvas } from '@/components/PageCanvas';
import { PropertiesPanel } from '@/components/PropertiesPanel';

const Index = () => {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Ribbon />
      <div className="flex flex-1 overflow-hidden">
        <ComponentsSidebar />
        <PageCanvas />
        <PropertiesPanel />
      </div>
    </div>
  );
};

export default Index;

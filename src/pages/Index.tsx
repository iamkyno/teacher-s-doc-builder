import { Ribbon } from '@/components/Ribbon';
import { ComponentsSidebar } from '@/components/ComponentsSidebar';
import { PageCanvas } from '@/components/PageCanvas';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { PanelLeft, PanelRight, X } from 'lucide-react';

const Index = () => {
  const isMobile = useIsMobile();
  const [leftOpen, setLeftOpen] = useState(!isMobile);
  const [rightOpen, setRightOpen] = useState(!isMobile);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Ribbon />

      {/* Mobile toggle bar */}
      <div className="no-print flex items-center gap-1 px-2 py-1 border-b border-panel-border bg-panel md:hidden">
        <button
          onClick={() => setLeftOpen((v) => !v)}
          className="p-1.5 rounded hover:bg-secondary transition-colors text-foreground"
          title="Toggle Components"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <span className="flex-1 text-center text-xs text-muted-foreground">
          {leftOpen ? 'Components' : rightOpen ? 'Properties' : 'Canvas'}
        </span>
        <button
          onClick={() => setRightOpen((v) => !v)}
          className="p-1.5 rounded hover:bg-secondary transition-colors text-foreground"
          title="Toggle Properties"
        >
          <PanelRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left sidebar - overlay on mobile */}
        {leftOpen && (
          <>
            {isMobile && (
              <div className="fixed inset-0 bg-black/30 z-30" onClick={() => setLeftOpen(false)} />
            )}
            <div className={`${isMobile ? 'fixed left-0 top-0 bottom-0 z-40 w-64 shadow-xl' : ''}`}>
              <ComponentsSidebar />
              {isMobile && (
                <button
                  onClick={() => setLeftOpen(false)}
                  className="absolute top-2 right-2 p-1 rounded hover:bg-secondary text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </>
        )}

        <PageCanvas />

        {/* Right sidebar - overlay on mobile */}
        {rightOpen && (
          <>
            {isMobile && (
              <div className="fixed inset-0 bg-black/30 z-30" onClick={() => setRightOpen(false)} />
            )}
            <div className={`${isMobile ? 'fixed right-0 top-0 bottom-0 z-40 w-60 shadow-xl' : ''}`}>
              <PropertiesPanel />
              {isMobile && (
                <button
                  onClick={() => setRightOpen(false)}
                  className="absolute top-2 left-2 p-1 rounded hover:bg-secondary text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Index;

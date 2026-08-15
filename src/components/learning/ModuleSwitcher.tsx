import { GraduationCap, Wrench } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { getNavigationModules } from '../../config/modules';
import { CollapsibleModuleGroup } from '../CollapsibleModuleGroup';

/**
 * Collapsible navigation component with organized module groups.
 * Features:
 * - Collapsible "A1 Learning" and "Practice Tools" groups
 * - Lucide SVG icons for group headers (GraduationCap, Wrench)
 * - Persists collapse state to localStorage
 * - Desktop: Icon + label for modules
 * - Mobile: Icon only with tooltips
 * - Responsive horizontal scrolling
 * - Dark mode support throughout
 */
export function ModuleSwitcher() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const modules = getNavigationModules();
  
  // Group modules by category
  const learningModules = modules.filter(m => m.category === 'learning');
  const practiceModules = modules.filter(m => m.category === 'practice');

  return (
    <nav
      aria-label="Module navigation"
      className="py-1"
    >
      <div className="flex flex-nowrap items-start gap-3 overflow-x-auto no-scrollbar sm:flex-wrap sm:overflow-visible sm:gap-4">
        {/* A1 Learning Modules Group */}
        <CollapsibleModuleGroup
          title="A1 Learning"
          titleDE="A1-Lernen"
          icon={GraduationCap}
          modules={learningModules}
          defaultExpanded={true}
          storageKey="nav-group-learning"
          isDE={isDE}
        />
        
        {/* Practice Tools Group */}
        <CollapsibleModuleGroup
          title="Practice Tools"
          titleDE="Übungswerkzeuge"
          icon={Wrench}
          modules={practiceModules}
          defaultExpanded={true}
          storageKey="nav-group-practice"
          isDE={isDE}
        />
      </div>
    </nav>
  );
}

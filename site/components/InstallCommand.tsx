import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { BRAND } from '../config';
import { CodeBlock } from './CodeBlock';

// The install command for each package manager. One place, so the landing
// page, the installation guide, the Markdown pages and the prompts all agree.
export const packageManagers = ['npm', 'pnpm', 'yarn', 'bun'] as const;
export type PackageManager = (typeof packageManagers)[number];

export const installCommand = (manager: PackageManager = 'npm', pkg: string = BRAND.packageName) =>
  ({ npm: `npm install ${pkg}`, pnpm: `pnpm add ${pkg}`, yarn: `yarn add ${pkg}`, bun: `bun add ${pkg}` })[manager];

/** Every manager's command as one Markdown block, for pages read without tabs. */
export const installMarkdown = (pkg: string = BRAND.packageName) =>
  ['```bash', ...packageManagers.map((m) => `${installCommand(m, pkg)}${m === 'npm' ? '' : `   # or, with ${m}`}`), '```'].join('\n');

const STORAGE_KEY = 'site:package-manager';

const stored = (): PackageManager => {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY) as PackageManager | null;
    return value && packageManagers.includes(value) ? value : 'npm';
  } catch {
    return 'npm';
  }
};

// Tabs for npm, pnpm, yarn and bun, each over its own copyable command. All
// four commands are in the HTML (the inactive panels are `hidden`), so a reader
// or an agent without JavaScript sees every one. The choice is remembered, so
// a pnpm user sees pnpm on every page. Keys follow the tabs pattern: Left and
// Right move between tabs, Home and End jump to the first and last.
export const InstallCommand = ({ pkg = BRAND.packageName }: { pkg?: string }) => {
  const [manager, setManager] = useState<PackageManager>(() => (typeof window === 'undefined' ? 'npm' : stored()));
  const id = useId();
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});

  const choose = (next: PackageManager, focus = false) => {
    setManager(next);
    if (focus) tabs.current[next]?.focus();
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const index = packageManagers.indexOf(manager);
    const last = packageManagers.length - 1;
    const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    choose(packageManagers[next]!, true);
  };

  return (
    <div className="install-command">
      <div className="tabs tabs--small install-command__tabs" role="tablist" aria-label="Package manager" onKeyDown={onKeyDown}>
        {packageManagers.map((m) => (
          <button
            key={m}
            ref={(el) => {
              tabs.current[m] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${m}`}
            aria-selected={manager === m}
            aria-controls={`${id}-panel-${m}`}
            tabIndex={manager === m ? 0 : -1}
            className={manager === m ? 'is-active' : ''}
            onClick={() => choose(m)}
          >
            {m}
          </button>
        ))}
      </div>
      {packageManagers.map((m) => (
        <div
          key={m}
          role="tabpanel"
          id={`${id}-panel-${m}`}
          aria-labelledby={`${id}-tab-${m}`}
          hidden={manager !== m}
          className="install-command__panel"
        >
          <CodeBlock code={installCommand(m, pkg)} label="bash" compact plain />
        </div>
      ))}
    </div>
  );
};

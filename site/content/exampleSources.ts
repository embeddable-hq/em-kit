import { aiChatWiringCode } from '../catalog/aiSnippets';
import { BRAND } from '../config';
import dashboardModule from '../examples/Dashboard.tsx?raw';

// The source printed on the example pages, shared by the HTML pages and the
// Markdown twins so the two cannot differ.

/** site/examples/Dashboard.tsx as a reader would paste it: the package, not this repository's src. */
export const dashboardSource = dashboardModule.replace(/from '\.\.\/\.\.\/src'/g, `from '${BRAND.packageName}'`).trim();

/** The chat example's message component: a whole module. */
export const chatSource = aiChatWiringCode;

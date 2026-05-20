import { router } from '../lib/trpc';
import { authRouter } from './auth';
import { agentsRouter } from './agents';
import { cardsRouter } from './cards';
import { approvalsRouter } from './approvals';
import { auditRouter } from './audit';
import { governanceRouter } from './governance';

export const appRouter = router({
  auth: authRouter,
  agents: agentsRouter,
  cards: cardsRouter,
  approvals: approvalsRouter,
  audit: auditRouter,
  governance: governanceRouter,
});

export type AppRouter = typeof appRouter;

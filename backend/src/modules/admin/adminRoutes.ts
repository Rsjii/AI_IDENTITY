import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { requireAdmin } from '../../middleware/admin';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  overview,
  users,
  userDetail,
  errors,
  logErrorEndpoint,
  performance,
  businessMetrics
} from './adminController';

const router = Router();
router.use(requireJWTFromCookie);
router.use(requireAdmin);

// A1: System overview
router.get('/overview', asyncHandler(overview));

// User management
router.get('/users', asyncHandler(users));
router.get('/users/:userId', asyncHandler(userDetail));

// A1: Error tracking & logging
router.get('/errors', asyncHandler(errors));
router.post('/errors/log', asyncHandler(logErrorEndpoint));

// A2: Performance monitoring
router.get('/performance', asyncHandler(performance));

// A3: Business metrics dashboard
router.get('/business-metrics', asyncHandler(businessMetrics));

export default router;

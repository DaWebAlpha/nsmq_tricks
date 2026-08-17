import express from "express";
import { adminController } from "../../controllers/admin/admin.page.controller.js";
import { notesController } from "../../controllers/notes/notes.controller.js";
import { usersController } from "../../controllers/admin/users.controller.js";
import { failedLoginLogController } from "../../controllers/admin/failedLoginLogs.controller.js";
import { loginLogController } from "../../controllers/admin/loginLogs.controller.js";
import { securityController } from "../../controllers/admin/security.controller.js";

import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { roleMiddleware } from "../../middlewares/role.middleware.js";
import { adminActionRateLimit } from "../../middlewares/authRateLimit.middleware.js";
import { csrfMiddleware } from "../../middlewares/csrf.middleware.js";

const adminRouter = express.Router();

const adminAccess = roleMiddleware("moderator", "admin", "superadmin");
const adminOnly = roleMiddleware("admin", "superadmin");
const superAdminOnly = roleMiddleware("superadmin");

adminRouter.use(authMiddleware);

adminRouter.get("/home", adminAccess, adminController.adminHomePage);
adminRouter.get("/dashboard", adminAccess, usersController.getDashboard);
adminRouter.get("/profile", adminAccess, adminController.adminProfilePage);
adminRouter.get("/settings", adminAccess, adminController.adminSettingsPage);

adminRouter.get("/security", adminAccess, securityController.getAllSecurityRecords);

adminRouter.get(
    "/security/:securityId",
    adminAccess,
    securityController.getSingleSecurityRecord
);

adminRouter.post("/security/:securityId/activate", adminActionRateLimit, adminOnly, csrfMiddleware, securityController.activateAccount);
adminRouter.post("/security/:securityId/pending", adminActionRateLimit, adminOnly, csrfMiddleware, securityController.setPendingAccount);
adminRouter.post("/security/:securityId/suspend", adminActionRateLimit, adminOnly, csrfMiddleware, securityController.suspendAccount);
adminRouter.post("/security/:securityId/ban", adminActionRateLimit, adminOnly, csrfMiddleware, securityController.banAccount);
adminRouter.post("/security/:securityId/unban", adminActionRateLimit, adminOnly, csrfMiddleware, securityController.unbanAccount);
adminRouter.post("/security/:securityId/unlock", adminActionRateLimit, adminOnly, csrfMiddleware, securityController.unlockAccount);
adminRouter.post("/security/:securityId/warn", adminActionRateLimit, adminOnly, csrfMiddleware, securityController.addBanWarning);
adminRouter.post("/security/:securityId/warnings/reset", adminActionRateLimit, adminOnly, csrfMiddleware, securityController.resetBanWarnings);
adminRouter.post("/security/:securityId/login-attempts/reset", adminActionRateLimit, adminOnly, csrfMiddleware, securityController.resetLoginAttempts);
adminRouter.post("/security/:securityId/sessions/invalidate", adminActionRateLimit, adminOnly, csrfMiddleware, securityController.bumpAuthVersion);

adminRouter.get("/users", adminAccess, usersController.getAllUsers);
adminRouter.get("/users/active", adminAccess, usersController.getAllActiveUsers);
adminRouter.get("/users/deleted", adminAccess, usersController.getAllDeletedUsers);
adminRouter.get("/users/:userId", adminAccess, usersController.getSingleUser);

adminRouter.post("/users", adminActionRateLimit, adminOnly, csrfMiddleware, usersController.createUser);
adminRouter.post("/users/:userId/update", adminActionRateLimit, adminOnly, csrfMiddleware, usersController.updateUser);
adminRouter.post("/users/:userId/delete", adminActionRateLimit, adminOnly, csrfMiddleware, usersController.deleteUser);
adminRouter.post("/users/:userId/restore", adminActionRateLimit, adminOnly, csrfMiddleware, usersController.restoreUser);
adminRouter.post("/users/:userId/role", adminActionRateLimit, superAdminOnly, csrfMiddleware, usersController.updateUserRole);
adminRouter.post("/users/:userId/subscription/activate", adminActionRateLimit, adminOnly, csrfMiddleware, usersController.activateSubscription);
adminRouter.post("/users/:userId/subscription/cancel", adminActionRateLimit, adminOnly, csrfMiddleware, usersController.cancelSubscription);

adminRouter.get("/notes", adminAccess, notesController.getAllNotes);
adminRouter.get("/notes/active", adminAccess, notesController.getAllActiveNotes);
adminRouter.get("/notes/deleted", adminAccess, notesController.getAllDeletedNotes);
adminRouter.get("/notes/create", adminAccess, notesController.getCreateNotesPage);
adminRouter.get("/notes/:noteId", adminAccess, notesController.getSingleNote);
adminRouter.get("/notes/:noteId/edit", adminAccess, notesController.getEditNotePage);

adminRouter.post("/notes", adminActionRateLimit, adminAccess, csrfMiddleware, notesController.createNote);
adminRouter.post("/notes/:noteId/update", adminActionRateLimit, adminAccess, csrfMiddleware, notesController.updateNote);
adminRouter.post("/notes/:noteId/delete", adminActionRateLimit, adminAccess, csrfMiddleware, notesController.deleteNote);
adminRouter.post("/notes/:noteId/restore", adminActionRateLimit, adminOnly, csrfMiddleware, notesController.restoreNote);
adminRouter.post("/notes/:noteId/permanent-delete", adminActionRateLimit, adminOnly, csrfMiddleware, notesController.hardDeleteNote);

adminRouter.get("/failed-login-logs", adminAccess, failedLoginLogController.getAllFailedLoginLogs);
adminRouter.get("/login-logs", adminAccess, loginLogController.getAllLoginLogs);

export { adminRouter };
export default adminRouter;